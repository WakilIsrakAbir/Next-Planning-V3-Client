import { harnessState } from '../harness/state';

/*
 * In-memory stand-in for the Plan Check List API of the Next Planning V3 server. Each part is a port of the server
 * code (Next Planning V3 Server, src/), with the same status codes, bodies and messages:
 *   authentication           middleware/auth.middleware.ts authenticateToken (401 without or with a bad token,
 *                            403 {message} for an inactive account)
 *   GET  /api/plan-check-list   controllers/plan-check-list.controller.ts get + services/plan-check-list.service.ts
 *                            (ensure() creates the standard list on first use; usage only for users who may edit)
 *   PUT  /api/plan-check-list   middleware/role.middleware.ts requirePlanCheckListPermission (403 {code: PERMISSION})
 *                            + controller save + service save (parseSaveBody, validatePlanCheckItems, version check,
 *                            409 {code: CONFLICT} naming who saved and when, Bangladesh time)
 *   any other route          Express's default 404 page
 * The standard list is constants/plan-check-list-defaults.ts. Replies are JSON text, so the page never shares
 * objects with the stored list.
 */

export const API_ORIGIN = 'http://api.test';
export const LIST_URL = `${API_ORIGIN}/api/plan-check-list`;

export interface Item {
  id: string;
  name: string;
  startDays: number;
  endDays: number;
  active: boolean;
}

export interface MockUser {
  username: string;
  role: 'Admin' | 'Approver' | 'Planner' | 'Viewer';
  status?: 'active' | 'inactive';
  permissions?: Record<string, unknown>;
}

export interface LoggedRequest {
  method: string;
  url: string;
  auth: string | null;
  body?: unknown;
}

export const STANDARD: Item[] = [
  { id: 'heatset', name: 'Heatset', startDays: 10, endDays: 7, active: true },
  { id: 'peach_brush', name: 'Peach/brush', startDays: 0, endDays: 0, active: true },
  { id: 'cpb', name: 'CPB', startDays: 12, endDays: 9, active: true },
  { id: 'singeing', name: 'Singeing', startDays: 7, endDays: 7, active: true },
  { id: 'subcontract', name: 'Subcontract', startDays: 0, endDays: 0, active: true },
  { id: 'yd_pre', name: 'YD Pre', startDays: 6, endDays: 4, active: true },
  { id: 'yd_post', name: 'YD Post', startDays: 6, endDays: 4, active: true },
  { id: 'mercerized', name: 'Mercerized', startDays: 11, endDays: 9, active: true },
  { id: 'semibleach', name: 'Semibleach', startDays: 6, endDays: 5, active: true },
];

const MAX_CRITERIA = 100;
const MAX_NAME_LENGTH = 60;
const MAX_DAYS = 365;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isDays = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_DAYS;

/** utils/dhaka-time.ts formatDhakaDateTime: '21-Nov-2026 14:05'. */
export function formatDhakaDateTime(value: Date | null | undefined): string {
  if (!value) return '';
  const time = value.getTime();
  if (!Number.isFinite(time)) return '';
  const dhaka = new Date(time + 6 * 60 * 60 * 1000);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(dhaka.getUTCDate())}-${MONTHS[dhaka.getUTCMonth()]}-${dhaka.getUTCFullYear()} ${two(dhaka.getUTCHours())}:${two(dhaka.getUTCMinutes())}`;
}

class HttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }

  body(): Record<string, unknown> {
    return this.code ? { code: this.code, message: this.message } : { message: this.message };
  }
}
const invalid = (message: string) => new HttpError(400, message, 'INVALID');

export interface FakeResponse {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

function reply(status: number, payload: { json?: unknown; text?: string }, headers: Record<string, string> = {}): FakeResponse {
  const text = payload.text !== undefined ? payload.text : JSON.stringify(payload.json);
  const all: Record<string, string> = {
    'content-type': payload.text !== undefined ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    ...headers,
  };
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => all[name.toLowerCase()] ?? null },
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

function expressNotFoundPage(method: string, path: string): string {
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot ${method} ${path}</pre>\n</body>\n</html>\n`;
}

interface StoredList {
  value: Item[];
  version: number;
  updatedBy: string;
  updatedAt: Date;
}

/** A scripted answer to the next request (instead of the server's own). */
export interface ScriptedReply {
  status?: number;
  json?: unknown;
  text?: string;
  /** fetch() rejects with TypeError('Failed to fetch'), as a browser does when the server cannot be reached. */
  networkError?: boolean;
}

export class PlanCheckListServer {
  readonly log: LoggedRequest[] = [];
  /** token -> user (authenticateToken loads the user of the token). */
  readonly users = new Map<string, MockUser>();
  /** orderplanguides: the yesIds of each order's guide (for `usage`). */
  guides: Array<{ orderNo: string; yesIds: string[] }> = [];
  private stored: StoredList | null;
  private clock: number;
  private idCounter = 0;
  private readonly scripted: ScriptedReply[] = [];
  // Gates for the next requests: request n waits for gate n (if any) before its answer is delivered.
  private readonly gates: Array<Promise<void>> = [];

  constructor(options: { stored?: Partial<StoredList> & { value: Item[] }; now?: Date } = {}) {
    this.clock = (options.now ?? new Date('2026-11-21T00:00:00.000Z')).getTime();
    this.stored = options.stored
      ? {
          value: clone(options.stored.value),
          version: options.stored.version ?? 1,
          updatedBy: options.stored.updatedBy ?? 'system',
          updatedAt: options.stored.updatedAt ?? new Date(this.clock),
        }
      : null;
  }

  /** Routes the page's fetch() here (tests/setup/setup.ts sends every fetch to the harness handler). */
  install(): this {
    harnessState().fetchHandler = (input, init) => this.handle(input, init);
    return this;
  }

  addUser(token: string, user: MockUser): this {
    this.users.set(token, user);
    return this;
  }

  /** The stored list as the database holds it (null before the first read creates it). */
  get list(): { value: Item[]; version: number; updatedBy: string; updatedAt: string } | null {
    return this.stored ? clone({ ...this.stored, updatedAt: this.stored.updatedAt.toISOString() }) : null;
  }

  /** Another user's save straight into the "database" (as if they saved from their own browser). */
  saveDirectly(items: Item[], username: string): void {
    this.ensure();
    const stored = this.stored as StoredList;
    this.clock += 60 * 1000;
    this.stored = { value: clone(items), version: stored.version + 1, updatedBy: username, updatedAt: new Date(this.clock) };
  }

  scriptNext(answer: ScriptedReply): void {
    this.scripted.push(answer);
  }

  /**
   * The answer of the next request waits until the returned function is called. The request is still handled when
   * it arrives (a GET reads the list as it is then), as a slow network delays only the answer.
   */
  holdNext(): () => void {
    let release: () => void = () => {};
    this.gates.push(new Promise<void>((resolve) => (release = resolve)));
    return () => release();
  }

  /** Requests of a method, oldest first. */
  requests(method?: string): LoggedRequest[] {
    return this.log.filter((r) => !method || r.method === method);
  }

  async handle(input: unknown, init: unknown): Promise<FakeResponse> {
    const url = String(input);
    const options = (init || {}) as { method?: string; headers?: Record<string, string>; body?: string };
    const method = (options.method || 'GET').toUpperCase();
    const auth = options.headers?.Authorization ?? options.headers?.authorization ?? null;
    const body = options.body === undefined ? undefined : JSON.parse(options.body);
    this.log.push(body === undefined ? { method, url, auth } : { method, url, auth, body });

    const gate = this.gates.shift();
    const scripted = this.scripted.shift();
    if (scripted?.networkError) {
      await gate;
      throw new TypeError('Failed to fetch');
    }
    const answer = scripted
      ? reply(scripted.status ?? 200, scripted.text !== undefined ? { text: scripted.text } : { json: scripted.json })
      : this.route(method, url, auth, body);
    await gate;
    return answer;
  }

  private route(method: string, url: string, auth: string | null, body: unknown): FakeResponse {
    const path = new URL(url).pathname;
    if (path !== '/api/plan-check-list' || (method !== 'GET' && method !== 'PUT')) {
      return reply(404, { text: expressNotFoundPage(method, path) });
    }
    // authenticateToken
    const token = auth && auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    if (!token) return reply(401, { json: { message: 'Authentication required. No token provided.' } });
    const user = this.users.get(token);
    if (!user) return reply(401, { json: { message: 'Invalid or corrupted token.' } });
    if (user.status === 'inactive') {
      return reply(403, { json: { message: 'Account is inactive. Please contact your system administrator.' } });
    }

    if (method === 'GET') {
      this.ensure();
      return reply(200, { json: this.view(user) }, { 'cache-control': 'no-store' });
    }
    // requirePlanCheckListPermission
    if (!this.canEdit(user)) {
      return reply(403, { json: { code: 'PERMISSION', message: 'Access forbidden: Plan Check List permission required.' } });
    }
    try {
      return reply(200, { json: this.save(user, body) }, { 'cache-control': 'no-store' });
    } catch (err) {
      if (err instanceof HttpError) return reply(err.status, { json: err.body() }, { 'cache-control': 'no-store' });
      throw err;
    }
  }

  private canEdit(user: MockUser): boolean {
    const menus = (user.permissions as { menus?: { dataManagement?: { planCheckList?: unknown } } } | undefined)?.menus;
    return user.role === 'Admin' || menus?.dataManagement?.planCheckList === true;
  }

  // PlanCheckListService.ensure(): the standard list, version 1, by 'system', on first use only.
  private ensure(): void {
    if (this.stored) return;
    this.stored = { value: clone(STANDARD), version: 1, updatedBy: 'system', updatedAt: new Date(this.clock) };
  }

  private usage(items: Item[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) counts[item.id] = 0;
    for (const guide of this.guides) {
      for (const id of new Set(guide.yesIds)) counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }

  private view(user: MockUser): Record<string, unknown> {
    const stored = this.stored as StoredList;
    const canEdit = this.canEdit(user);
    const view: Record<string, unknown> = {
      items: clone(stored.value),
      version: stored.version,
      updatedBy: stored.updatedBy,
      updatedAt: stored.updatedAt.toISOString(),
      defaults: clone(STANDARD),
      canEdit,
    };
    if (canEdit) view.usage = this.usage(stored.value);
    return view;
  }

  // PlanCheckListService.save()
  private save(user: MockUser, body: unknown): Record<string, unknown> {
    if (!isPlainObject(body)) throw invalid('Invalid Plan Check List data.');
    if (!Array.isArray(body.items)) throw invalid('items: the list of criteria is required.');
    if (typeof body.version !== 'number' || !Number.isInteger(body.version) || body.version < 0) {
      throw invalid('version: the version of the list you loaded is required.');
    }
    this.ensure();
    const stored = this.stored as StoredList;
    const knownIds = new Set([...stored.value.map((item) => item.id), ...STANDARD.map((item) => item.id)]);
    const value = this.validate(body.items, knownIds);
    if (stored.version !== body.version) {
      const who = stored.updatedBy || 'another user';
      const when = formatDhakaDateTime(stored.updatedAt);
      throw new HttpError(
        409,
        `The Plan Check List was changed by ${who}${when ? ` at ${when}` : ''}. Reload the page to see the latest values.`,
        'CONFLICT'
      );
    }
    this.clock += 60 * 1000;
    this.stored = { value, version: stored.version + 1, updatedBy: user.username, updatedAt: new Date(this.clock) };
    return this.view(user);
  }

  // validatePlanCheckItems()
  private validate(items: unknown[], knownIds: Set<string>): Item[] {
    if (items.length > MAX_CRITERIA) throw invalid(`The Plan Check List can have at most ${MAX_CRITERIA} criteria.`);
    const rowsByName = new Map<string, { row: number; name: string }>();
    const usedIds = new Set<string>();
    return items.map((raw, index) => {
      const row = index + 1;
      if (!isPlainObject(raw)) throw invalid(`Row ${row}: Invalid criteria data.`);
      const name = typeof raw.name === 'string' ? raw.name.trim().replace(/\s+/g, ' ') : '';
      const length = Array.from(name).length;
      if (length < 1 || length > MAX_NAME_LENGTH) throw invalid(`Row ${row}: Criteria name must be 1 to ${MAX_NAME_LENGTH} characters.`);
      const label = `Row ${row} (${name})`;
      const first = rowsByName.get(name.toLowerCase());
      if (first) throw invalid(`${label}: The name is already used in row ${first.row} (${first.name}).`);
      rowsByName.set(name.toLowerCase(), { row, name });
      if (!isDays(raw.startDays)) throw invalid(`${label}: Start days must be a whole number from 0 to ${MAX_DAYS}.`);
      if (!isDays(raw.endDays)) throw invalid(`${label}: End days must be a whole number from 0 to ${MAX_DAYS}.`);
      if (typeof raw.active !== 'boolean') throw invalid(`${label}: Active must be true or false.`);
      let id: string;
      if (typeof raw.id === 'string' && knownIds.has(raw.id) && !usedIds.has(raw.id)) {
        id = raw.id;
      } else {
        this.idCounter += 1;
        id = `chk_${String(this.idCounter).padStart(24, '0')}`;
      }
      usedIds.add(id);
      return { id, name, startDays: raw.startDays + 0, endDays: raw.endDays + 0, active: raw.active };
    });
  }
}

/* ---------- signed-in users, stored the way LoginScreen.tsx stores them ---------- */
export const SESSION_KEYS = ['token', 'user', 'username', 'role', 'permissions', 'status', 'sessionExpiresAt'];

export function signIn(token: string, user: MockUser): void {
  localStorage.clear();
  const permissions = user.permissions ?? {};
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify({ id: `u-${user.username}`, username: user.username, role: user.role, status: 'active', permissions }));
  localStorage.setItem('username', user.username);
  localStorage.setItem('role', user.role);
  localStorage.setItem('permissions', JSON.stringify(permissions));
  localStorage.setItem('status', 'active');
  localStorage.setItem('sessionExpiresAt', '1795197600000');
}

export const ADMIN: MockUser = { username: 'admin', role: 'Admin', permissions: {} };
/** A Planner with the Plan Check List permission ticked. */
export const EDITOR: MockUser = {
  username: 'planner1',
  role: 'Planner',
  permissions: { menus: { dataManagement: { view: true, planCheckList: true } } },
};
/** A Planner without it (Data Management > Source File Upload only). */
export const PLANNER: MockUser = { username: 'planner2', role: 'Planner', permissions: { menus: { dataManagement: { view: true } } } };
