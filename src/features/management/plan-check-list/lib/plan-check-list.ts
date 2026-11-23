import { useEffect, useState, useSyncExternalStore } from 'react';
import { API_BASE } from '@/lib/constants';
import { sharedRequest } from '@/lib/shared-request';

/*
 * Plan Check List (Data Management > Plan Check List): the criteria an order's Checkpoint & Planning Guide offers
 * as Yes/No. When criteria are Yes, Knitting Start moves by the largest Start days among them and Knitting End by
 * the largest End days (each column on its own).
 *
 * Server (Next Planning V3 Server, routes/plan-check-list.routes.ts):
 * - GET /api/plan-check-list: every signed-in user (order pages read it); it never answers 403.
 *   {items, version, updatedBy, updatedAt, defaults, canEdit, usage?}; `usage` (orders with each id set to Yes) is
 *   sent only to users who may edit.
 * - PUT /api/plan-check-list {items, version}: Admin or menus.dataManagement.planCheckList. The whole list is saved
 *   at once. 400 {code: 'INVALID'} names the row, 409 {code: 'CONFLICT'} when someone saved first, 403
 *   {code: 'PERMISSION'} without the permission.
 *
 * This module holds the one shared copy of the list. The Plan Check List page and the order pages read it through
 * loadPlanCheckList() / usePlanCheckList(), and a save replaces it, so an open order page picks the change up.
 * Requests use their own fetch, not apiClient (which signs the user out on any 403): only a 401, or a 403 that is not
 * code PERMISSION (an inactive account), signs out.
 */

/** One criterion. Its id never changes, so a rename keeps every order that set it to Yes linked to it. */
export interface PlanCheckItem {
  id: string;
  name: string;
  /** Days added to the T&A Knitting Start when the criterion is Yes on an order. */
  startDays: number;
  /** Days added to the T&A Knitting End when the criterion is Yes on an order. */
  endDays: number;
  /** Inactive criteria are not offered on order pages and never add lead time. */
  active: boolean;
}

/** GET /api/plan-check-list, and the answer of a save. */
export interface PlanCheckList {
  /** The criteria in display order. */
  items: PlanCheckItem[];
  /** Goes up by one on every save; a save must send the version it was based on. */
  version: number;
  /** Who saved last ('system' when the standard list was created on first use). */
  updatedBy: string;
  /** When it was saved last (ISO time), null when unknown. */
  updatedAt: string | null;
  /** The standard list, for "Reset to Standard". */
  defaults: PlanCheckItem[];
  /** The signed-in user may save the list. */
  canEdit: boolean;
  /** Users who may edit only: the number of orders that set each criterion id to Yes. */
  usage?: Record<string, number>;
}

/** One row of a save request. A row without `id` (or with an id the server does not know) gets a new id. */
export interface PlanCheckSaveItem {
  id?: string;
  name: string;
  /** Normally a whole number; anything else is sent as typed, so the server's message names the row. */
  startDays: number | string;
  endDays: number | string;
  active: boolean;
}

/**
 * A failed request. `code` is the server's code (INVALID, CONFLICT, PERMISSION), or SESSION (the user was signed
 * out), NETWORK (no answer), NOT_DEPLOYED (a server without this API) or '' for any other error.
 * `message` is ready to show.
 */
export class PlanCheckListError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'PlanCheckListError';
    this.status = status;
    this.code = code;
  }
}

export const PLAN_CHECK_LIST_PATH = '/api/plan-check-list';
/** A cached copy younger than this is used as it is (loadPlanCheckList() without `fresh`). */
export const PLAN_CHECK_LIST_MAX_AGE_MS = 60 * 1000;

const SESSION_KEYS = ['token', 'user', 'username', 'role', 'permissions', 'status', 'sessionExpiresAt'];

function storedToken(): string {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
}

// The session is over (401, or a 403 without code PERMISSION such as an inactive account): back to the login page.
function signOut(): void {
  for (const key of SESSION_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  // A full page load on purpose, as apiClient does: nothing of the ended session stays in memory.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = '/login?expired=true';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const itemList = (value: unknown): PlanCheckItem[] =>
  Array.isArray(value) ? (value.filter(isRecord) as unknown as PlanCheckItem[]) : [];

// The answer of GET or PUT, checked just enough that the page can always draw it.
function readList(data: Record<string, unknown> | null): PlanCheckList {
  if (!data || !Array.isArray(data.items) || typeof data.version !== 'number') {
    throw new PlanCheckListError('The server sent an unexpected answer for the Plan Check List.', 200, '');
  }
  const list: PlanCheckList = {
    items: itemList(data.items),
    version: data.version,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    defaults: itemList(data.defaults),
    canEdit: data.canEdit === true,
  };
  if (isRecord(data.usage)) list.usage = data.usage as Record<string, number>;
  return list;
}

async function request(method: 'GET' | 'PUT', body?: { items: PlanCheckSaveItem[]; version: number }): Promise<PlanCheckList> {
  const headers: Record<string, string> = { Authorization: `Bearer ${storedToken()}` };
  if (body) headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(API_BASE + PLAN_CHECK_LIST_PATH, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new PlanCheckListError(`Cannot reach the server (${API_BASE}). Check the connection and try again.`, 0, 'NETWORK');
  }
  let data: Record<string, unknown> | null = null;
  try {
    const json: unknown = await response.json();
    data = isRecord(json) ? json : null;
  } catch {
    data = null;
  }
  const code = typeof data?.code === 'string' ? data.code : '';
  if (response.status === 401 || (response.status === 403 && code !== 'PERMISSION')) {
    signOut();
    throw new PlanCheckListError('Your session has ended. Please log in again.', response.status, 'SESSION');
  }
  if (!response.ok) {
    const message = typeof data?.message === 'string' ? data.message : '';
    if (response.status === 404 && !message) {
      throw new PlanCheckListError(
        'This server does not have the Plan Check List yet. Deploy the updated Next Planning V3 server, then reload this page.',
        404,
        'NOT_DEPLOYED'
      );
    }
    throw new PlanCheckListError(message || `Server error ${response.status}.`, response.status, code);
  }
  return readList(data);
}

/* ---------- the shared copy ---------- */
let cachedList: PlanCheckList | null = null;
let cachedAt = 0;
// Goes up by one each time the copy is replaced.
let generation = 0;
const listeners = new Set<() => void>();

function store(list: PlanCheckList): void {
  cachedList = list;
  cachedAt = Date.now();
  generation += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

/** The shared copy: the list as last loaded or saved in this tab, or null before the first load. */
export function getCachedPlanCheckList(): PlanCheckList | null {
  return cachedList;
}

/** Calls `listener` whenever the shared copy is replaced (a load or a save). Returns the unsubscribe function. */
export function subscribePlanCheckList(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The Plan Check List. A cached copy younger than a minute is returned as it is, unless `fresh` is set; requests
 * made while one is running share it (a `fresh` call always starts its own). The result replaces the shared copy,
 * except a read that a save overtook (the saved list is newer: versions only go up).
 */
export function loadPlanCheckList(options: { fresh?: boolean } = {}): Promise<PlanCheckList> {
  const fresh = options.fresh === true;
  if (!fresh && cachedList && Date.now() - cachedAt < PLAN_CHECK_LIST_MAX_AGE_MS) return Promise.resolve(cachedList);
  return sharedRequest(
    `GET ${API_BASE}${PLAN_CHECK_LIST_PATH}`,
    async () => {
      const startedAt = generation;
      const list = await request('GET');
      if (generation !== startedAt && cachedList && list.version < cachedList.version) return cachedList;
      store(list);
      return list;
    },
    fresh
  );
}

/**
 * Saves the whole list (PUT). `version` is the version the rows are based on: when someone saved in between, the
 * server answers 409 and nothing is written. The saved list (as the server stores it) replaces the shared copy.
 * Throws PlanCheckListError.
 */
export async function savePlanCheckList(items: PlanCheckSaveItem[], version: number): Promise<PlanCheckList> {
  const saved = await request('PUT', { items, version });
  store(saved);
  return saved;
}

/** The text to show for a failed request. */
export function planCheckListErrorText(error: unknown, fallback = 'Could not load the Plan Check List.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * For pages that use the list (the order page's Planning Guide): the shared copy at once (null until it is
 * loaded), loaded when it is missing or older than a minute, and drawn again whenever the list is saved or
 * reloaded anywhere in this tab. `error` is the text of a failed load ('' otherwise).
 */
export function usePlanCheckList(): { list: PlanCheckList | null; error: string } {
  const list = useSyncExternalStore(subscribePlanCheckList, getCachedPlanCheckList, () => null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    loadPlanCheckList().then(
      () => {
        if (live) setError('');
      },
      (err: unknown) => {
        if (live) setError(planCheckListErrorText(err));
      }
    );
    return () => {
      live = false;
    };
  }, []);
  return { list, error };
}
