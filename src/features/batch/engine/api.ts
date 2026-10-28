/* Batch Plan module: server access and permissions (port of the old js/batch/batch-api.js).
   GET /api/batch/state loads everything the pages need; POST /api/batch/commit saves changed plans,
   Setup tables and batch cards. The server checks the same permission keys as `BatchApi.has`. */
import { API_BASE } from '@/lib/constants';
import { S, navigateTo, notify } from './state';
import type { BatchCommitPayload, BatchCommitResult, BatchStateResponse, BatchUser } from './types';

function token(): string {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
}

function backToLogin(): void {
  for (const key of ['token', 'user', 'username', 'role', 'permissions', 'status', 'sessionExpiresAt']) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  // A full page load on purpose: it drops the Batch state that belonged to the expired session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = '/login?expired=true';
}

type Json = { message?: string; code?: string } & Record<string, unknown>;

async function request<T>(path: string, options: RequestInit = {}, onHeaders?: (response: Response) => void): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_BASE + '/api/batch' + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      cache: 'no-store',
    });
  } catch {
    throw new Error('Cannot reach the server (' + API_BASE + '). Check the internet connection and reload.');
  }
  if (onHeaders) {
    try {
      onHeaders(response);
    } catch {
      /* ignore */
    }
  }
  let data: Json | null = null;
  try {
    data = (await response.json()) as Json;
  } catch {
    data = null;
  }
  // A permission refusal (code PERMISSION) is shown on the page; an expired or inactive session logs out.
  if (
    response.status === 401 ||
    (response.status === 403 && !(data && data.code === 'PERMISSION') && /token|inactive|expired/i.test(String(data?.message || '')))
  ) {
    backToLogin();
    throw new Error('Session expired. Please log in again.');
  }
  if (response.status === 404 && !data) {
    throw new Error('The server does not have the Batch Plan module yet. Deploy the updated Next Planning V3 server, then reload this page.');
  }
  if (!response.ok) throw new Error((data && data.message) || 'Server error ' + response.status);
  return data as T;
}

/* ---------- loading with progress text and timings (shown on the loading screen and the header badge) ---------- */
function fetchState(): Promise<BatchStateResponse> {
  const started = performance.now();
  let headersAt = 0;
  let serverTiming = '';
  S.loadingText = 'Connecting to the server…';
  notify();
  return request<BatchStateResponse>('/state', {}, (response) => {
    headersAt = performance.now();
    serverTiming = response.headers.get('server-timing') || '';
    S.loadingText = 'Downloading orders, saved plans and setup tables…';
    notify();
  }).then((data) => {
    const parsedAt = performance.now();
    S.loadingText = 'Preparing the lists…';
    S.loadSummary =
      `Loaded in ${((parsedAt - started) / 1000).toFixed(1)} s · server ${Math.round(headersAt - started)} ms · ` +
      `download and parse ${Math.round(parsedAt - headersAt)} ms` +
      (serverTiming ? ' · server: ' + serverTiming : '');
    try {
      console.info('[Batch Plan] ' + S.loadSummary);
    } catch {
      /* ignore */
    }
    notify();
    return data;
  });
}

/* ---------- permissions ---------- */
function has(path: string): boolean {
  const user = S.user;
  if (!user) return false;
  if (user.role === 'Admin') return true;
  let node: unknown = user.permissions;
  for (const part of path.split('.')) node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
  return node === true;
}

/** CSS flags on the feature root (old body.perm-no-*): a button without permission is hidden. */
export function permissionClasses(): string {
  const flags: [string, string][] = [
    ['edit', 'actions.batchEdit'],
    ['tentative', 'actions.batchTentative'],
    ['confirm', 'actions.batchConfirm'],
    ['internal', 'actions.batchInternalChange'],
    ['pending', 'actions.batchMovePending'],
    ['card', 'actions.batchCardGenerate'],
    ['dyeingmc', 'menus.dataManagement.dyeingMc'],
    ['flat', 'menus.dataManagement.flatAllowance'],
    ['unit', 'menus.dataManagement.unitSetup'],
    ['plan-print', 'downloads.batchPlanPrint'],
    ['card-print', 'downloads.batchCardPrint'],
    ['dyeable-excel', 'downloads.dyeableExcel'],
    ['summary-excel', 'downloads.dyeableSummaryExcel'],
    ['daily-excel', 'downloads.dailyConfirmExcel'],
  ];
  return flags
    .filter(([, path]) => !has(path))
    .map(([name]) => 'perm-no-' + name)
    .join(' ');
}

export const BatchApi = {
  loadState: fetchState,
  commit(payload: BatchCommitPayload): Promise<BatchCommitResult> {
    return request<BatchCommitResult>('/commit', { method: 'POST', body: JSON.stringify(payload) });
  },
  has,
  applyPermissions(user: BatchUser | null | undefined): void {
    S.user = user || null;
    notify();
  },
  /** The page moved to another unit (unit tab, floor jump, search result): the URL follows. */
  syncRoute(route: string): void {
    navigateTo('/batch/' + route, { replace: true });
  },
  /** The data is loaded: the requested page can be shown. */
  ready(): void {
    S.loading = false;
    S.loadError = '';
    notify();
  },
  /** The data could not be loaded: the banner stays, every edit is blocked (S.storageReady is false). */
  failed(error: unknown): void {
    S.loading = false;
    S.loadError = (error instanceof Error && error.message) || String(error);
    notify();
  },
  /** Unsaved work: an edited plan report or a Setup table draft (asked before a reload). */
  hasUnsavedChanges(): boolean {
    return !!((S.reportDraft && S.reportDraft.dirty) || (S.unitSetupDraft && S.unitSetupDraft.size) || S.setupDirty || S.flatAllowanceDirty);
  },
};
