import { API_BASE } from '@/lib/constants';
import { cachedOrderDetails, type ICachedOrderDetail } from '@/features/planning/lib/planning-cache';
import {
  GUIDE_DATE_KEYS,
  TNA_KEYS,
  isIsoDay,
  type GuideDates,
  type GuideLead,
  type PlanCheck,
  type TnaKey,
} from '@/features/planning/guide/lib/plan-guide';

/*
 * Server access for the order page's Checkpoint & Planning Guide (Next Planning V3 Server, S3):
 * - GET /api/orders/:orderNo answers `guide` with the order's details: the stored guide, or null before its first
 *   save. The guide is read only from that full detail answer, never from a plan-list row.
 * - PUT /api/orders/:orderNo/plan-guide {yesIds, dates, version?}: any signed-in user. `version` is the version of
 *   the guide the page shows (none before the first save); when someone saved in between, the server answers
 *   409 {code: 'CONFLICT'} and writes nothing. 400 {code: 'INVALID'} and 404 carry a message to show. The answer is
 *   the guide as stored, with the lead and the snapshots the server computed itself.
 */

/** An order's Checkpoint & Planning Guide as the server stores it (collection orderplanguides). */
export interface PlanGuide {
  orderNo: string;
  /** Ids of the criteria set to Yes; any other criterion is No. */
  yesIds: string[];
  /** The ten dates as saved: 'YYYY-MM-DD' or ''. */
  dates: GuideDates;
  /** The lead the server computed at save time from the Plan Check List of that moment. */
  lead: GuideLead;
  /** The Plan Check List at save time, plus (inactive) any Yes criterion it no longer had. */
  checks: PlanCheck[];
  /** The order's T&A values at save time, raw ('' when absent). */
  tna: Record<TnaKey, string>;
  /** The Plan Check List version the lead came from. */
  checklistVersion: number;
  /** Goes up by one on every save; a save must send the version it is based on. */
  version: number;
  updatedBy: string;
  /** When it was saved last (ISO time), '' when unknown. */
  updatedAt: string;
}

/** The body of a save: what the card shows. */
export interface PlanGuideSaveBody {
  yesIds: string[];
  dates: GuideDates;
  /** The version of the guide the shown values are based on; left out before the first save. */
  version?: number;
}

/**
 * A failed request. `code` is the server's code (INVALID, CONFLICT), or NETWORK (no answer), NOT_DEPLOYED (a server
 * without the Planning Guide), UNEXPECTED (an answer the page cannot use), NOT_READY (the order is still loading),
 * INPUTS_CHANGED (the order's T&A or the Plan Check List changed after the page loaded them; nothing was sent) or
 * '' for any other error. `message` is ready to show.
 */
export class PlanGuideError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'PlanGuideError';
    this.status = status;
    this.code = code;
  }
}

/** The route keys the order details are cached under (`<dept>_<orderNo>`): the five departments and, since US-11, the Delivery Floor and Lock routes. */
export const PLAN_DEPTS = ['yd', 'knitting', 'dyeing', 'finishing', 'delivery', 'deliveryfloor', 'deliverylock'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const text = (value: unknown): string => (value === undefined || value === null ? '' : String(value));

/**
 * A guide from a server answer, checked and filled in just enough that the page can always use it; null when the
 * value is not a guide (no guide yet, or a server without the Planning Guide).
 */
export function readPlanGuide(value: unknown): PlanGuide | null {
  if (!isRecord(value) || typeof value.version !== 'number' || !Number.isFinite(value.version)) return null;
  const rawDates = isRecord(value.dates) ? value.dates : {};
  const dates = {} as GuideDates;
  for (const key of GUIDE_DATE_KEYS) {
    const day = rawDates[key];
    dates[key] = isIsoDay(day) ? day : '';
  }
  const rawLead = isRecord(value.lead) ? value.lead : {};
  const rawTna = isRecord(value.tna) ? value.tna : {};
  const tna = {} as Record<TnaKey, string>;
  for (const key of TNA_KEYS) tna[key] = text(rawTna[key]);
  return {
    orderNo: text(value.orderNo ?? value._id),
    yesIds: strings(value.yesIds),
    dates,
    lead: {
      startDays: count(rawLead.startDays),
      endDays: count(rawLead.endDays),
      startFrom: strings(rawLead.startFrom),
      endFrom: strings(rawLead.endFrom),
      startFromIds: strings(rawLead.startFromIds),
      endFromIds: strings(rawLead.endFromIds),
    },
    checks: (Array.isArray(value.checks) ? value.checks : []).filter(isRecord).map((check) => ({
      id: text(check.id),
      name: text(check.name),
      startDays: count(check.startDays),
      endDays: count(check.endDays),
      active: check.active === true,
    })),
    tna,
    checklistVersion: count(value.checklistVersion),
    version: value.version,
    updatedBy: text(value.updatedBy),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
  };
}

/** True when `next` is a newer stored guide than `current` (versions only go up). */
export function isNewerGuide(next: PlanGuide | null, current: PlanGuide | null): boolean {
  return !!next && (!current || next.version > current.version);
}

function storedToken(): string {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
}

const orderPath = (orderNo: string) => `${API_BASE}/api/orders/${encodeURIComponent(orderNo)}`;

// One request with the stored token. The order page keeps its unsaved work on screen: a refused request shows the
// server's message (an ended session included) and never signs the user out from here.
async function request(url: string, init: RequestInit = {}): Promise<Record<string, unknown> | null> {
  const headers: Record<string, string> = { Authorization: `Bearer ${storedToken()}` };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, cache: 'no-store' });
  } catch {
    throw new PlanGuideError(`Cannot reach the server (${API_BASE}). Check the connection and try again.`, 0, 'NETWORK');
  }
  let data: Record<string, unknown> | null = null;
  try {
    const json: unknown = await response.json();
    data = isRecord(json) ? json : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = typeof data?.message === 'string' ? data.message : '';
    const code = typeof data?.code === 'string' ? data.code : '';
    if (response.status === 404 && !message) {
      throw new PlanGuideError(
        'This server does not have the Planning Guide yet. Deploy the updated Next Planning V3 server to save the Planning Guide.',
        404,
        'NOT_DEPLOYED'
      );
    }
    throw new PlanGuideError(message || `Server error ${response.status}.`, response.status, code);
  }
  return data;
}

/**
 * Saves the guide (PUT) and returns it as the server stored it. Throws PlanGuideError: code CONFLICT when someone
 * saved the guide since the shown version (nothing is written then), INVALID with the server's message, and so on.
 */
export async function savePlanGuide(orderNo: string, body: PlanGuideSaveBody): Promise<PlanGuide> {
  const data = await request(`${orderPath(orderNo)}/plan-guide`, { method: 'PUT', body: JSON.stringify(body) });
  const saved = readPlanGuide(data);
  if (!saved) throw new PlanGuideError('The server sent an unexpected answer for the Planning Guide.', 200, 'UNEXPECTED');
  return saved;
}

/** The order's T&A values as the server stores them on the Order (the fields the guide reads). */
export type PlanGuideOrderTna = Partial<Record<TnaKey, unknown>> & { orderNo: string };

/** What a guide is computed from, as the server has it now. */
export interface LatestGuideInputs {
  /** The stored guide (null when the order has none yet). */
  guide: PlanGuide | null;
  /** The order's T&A values: the same Order fields the server snapshots when it saves the guide. */
  order: PlanGuideOrderTna;
}

/**
 * The order's stored guide and its T&A values as the server has them now: the full order details, read past the
 * server's 60-second details cache. Throws PlanGuideError.
 */
export async function fetchLatestGuideInputs(orderNo: string): Promise<LatestGuideInputs> {
  const data = await request(`${orderPath(orderNo)}?fresh=1`);
  if (!isRecord(data?.order)) {
    throw new PlanGuideError('The server sent an unexpected answer for the order details.', 200, 'UNEXPECTED');
  }
  const source = data.order;
  const order: PlanGuideOrderTna = { orderNo: text(source.orderNo) || orderNo };
  for (const key of TNA_KEYS) if (key in source) order[key] = source[key];
  return { guide: readPlanGuide(data.guide), order };
}

/** A cached order detail that also holds the guide of its detail answer. */
type CachedDetailWithGuide = ICachedOrderDetail & { guide?: PlanGuide | null };

/**
 * Puts a guide the server answered into this order's cached details under all five department keys, so any
 * department page of the order shows it at once. Only entries that exist are changed (they keep their age), and a
 * newer guide already there is kept.
 */
export function storeGuideInDetailCache(orderNo: string, guide: PlanGuide): void {
  const target = String(orderNo).trim();
  for (const dept of PLAN_DEPTS) {
    const key = `${dept}_${target}`;
    const entry = cachedOrderDetails.get(key) as CachedDetailWithGuide | undefined;
    if (!entry) continue;
    const cached = readPlanGuide(entry.guide);
    if (cached && cached.version > guide.version) continue;
    const next: CachedDetailWithGuide = { ...entry, guide };
    cachedOrderDetails.set(key, next);
  }
}

/**
 * The order page's step after a guide save (SPEC C4): the guide goes into the cached details under ALL five
 * department keys. Entries that exist get it as in storeGuideInDetailCache (a newer guide there is kept); a key without
 * an entry gets a copy of this order's latest cached entry, guide included (one detail answer holds every
 * department; the copy keeps that entry's age). Nothing is cached when the order has no entry at all.
 */
export function storeGuideInAllDetailKeys(orderNo: string, guide: PlanGuide): void {
  storeGuideInDetailCache(orderNo, guide);
  const target = String(orderNo).trim();
  let latest: ICachedOrderDetail | undefined;
  for (const dept of PLAN_DEPTS) {
    const entry = cachedOrderDetails.get(`${dept}_${target}`);
    if (entry && (!latest || entry.timestamp > latest.timestamp)) latest = entry;
  }
  if (!latest) return;
  for (const dept of PLAN_DEPTS) {
    const key = `${dept}_${target}`;
    if (!cachedOrderDetails.has(key)) cachedOrderDetails.set(key, { ...latest });
  }
}
