import { harnessState } from '../harness/state';
import { PlanCheckListServer, STANDARD, formatDhakaDateTime, type FakeResponse, type Item, type MockUser } from '../plan-check-list/mock-server';
import { GUIDE_DATE_KEYS, TNA_KEYS, computeLead, isIsoDay, type GuideDates } from '@/features/planning/guide/lib/plan-guide';

/*
 * In-memory stand-in for the parts of the Next Planning V3 server the Planning Guide card uses. Each part is a port
 * of the server code (Next Planning V3 Server, src/), with the same status codes, bodies and messages:
 *   GET /api/plan-check-list          the Plan Check List server of tests/plan-check-list/mock-server.ts
 *   PUT /api/orders/:orderNo/plan-guide   services/plan-guide.service.ts PlanGuideService.save (parseBody,
 *                                     version check, checkYesIds, lead and snapshots, 404, 400 INVALID, 409 CONFLICT)
 *   GET /api/orders/:orderNo          services/order.service.ts getOrderDetails: {order, planData, fingerprints,
 *                                     deptFlags, guide}
 *   authentication                    middleware/auth.middleware.ts (401 without or with an unknown token)
 *   any other route                   Express's default 404 page
 * The lead is computed with the client's copy of the rules, which tests/plan-guide/plan-guide-vectors.test.ts proves
 * equal to the server's.
 */

export const API_ORIGIN = 'http://api.test';
export const guidePath = (orderNo: string) => `/api/orders/${encodeURIComponent(orderNo)}/plan-guide`;

export interface StoredGuide {
  _id: string;
  orderNo: string;
  yesIds: string[];
  dates: GuideDates;
  lead: ReturnType<typeof computeLead>;
  checks: Item[];
  tna: Record<string, string>;
  checklistVersion: number;
  version: number;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoggedRequest {
  method: string;
  path: string;
  query: string;
  auth: string | null;
  body?: unknown;
}

export interface ScriptedReply {
  /** Only for the next request with this method (GET, PUT); any request when left out. */
  method?: string;
  status?: number;
  json?: unknown;
  text?: string;
  networkError?: boolean;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function reply(status: number, payload: { json?: unknown; text?: string }): FakeResponse {
  const text = payload.text !== undefined ? payload.text : JSON.stringify(payload.json);
  const type = payload.text !== undefined ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8';
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? type : null) },
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

const expressNotFoundPage = (method: string, path: string) =>
  `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot ${method} ${path}</pre>\n</body>\n</html>\n`;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string
  ) {
    super(message);
  }
  body(): Record<string, unknown> {
    return this.code ? { code: this.code, message: this.message } : { message: this.message };
  }
}
const invalid = (message: string) => new HttpError(400, message, 'INVALID');

export class GuideServer {
  readonly log: LoggedRequest[] = [];
  readonly lists: PlanCheckListServer;
  /** orders: orderNo -> the Order document (its T&A fields). */
  readonly orders = new Map<string, Record<string, unknown>>();
  /** orderplanguides: orderNo -> the stored guide. */
  readonly guides = new Map<string, StoredGuide>();
  /** Without the Planning Guide routes (an older server). */
  oldServer = false;
  private readonly users = new Map<string, MockUser>();
  private readonly scripted: ScriptedReply[] = [];
  // Held answers: the next request with the method waits for the gate before its answer is delivered.
  private readonly gates: Array<{ method: string; gate: Promise<void> }> = [];
  private clock = new Date('2026-11-21T00:00:00.000Z').getTime();

  constructor(options: { list?: Item[] } = {}) {
    this.lists = new PlanCheckListServer({ stored: { value: options.list ?? STANDARD, version: 1 } });
  }

  install(): this {
    harnessState().fetchHandler = (input, init) => this.handle(input, init);
    return this;
  }

  addUser(token: string, user: MockUser): this {
    this.users.set(token, user);
    this.lists.addUser(token, user);
    return this;
  }

  addOrder(order: Record<string, unknown>): this {
    this.orders.set(String(order.orderNo), clone(order));
    return this;
  }

  scriptNext(answer: ScriptedReply): void {
    this.scripted.push(answer);
  }

  /**
   * The answer of the next `method` request waits until the returned function is called. The request is still
   * handled when it arrives (a PUT is stored then), as a slow network delays only the answer.
   */
  holdNext(method: string): () => void {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    this.gates.push({ method, gate });
    return () => release();
  }

  requests(method?: string, pathStart = '/api/orders/'): LoggedRequest[] {
    return this.log.filter((r) => (!method || r.method === method) && r.path.startsWith(pathStart));
  }

  /** Someone else's save straight into the "database" (as from their own browser), through the same rules. */
  saveDirectly(orderNo: string, body: { yesIds: string[]; dates: GuideDates }, username: string): StoredGuide {
    const stored = this.guides.get(orderNo);
    return this.saveGuide({ username, role: 'Planner' }, orderNo, { ...body, version: stored?.version });
  }

  async handle(input: unknown, init: unknown): Promise<FakeResponse> {
    const url = new URL(String(input));
    if (url.pathname.startsWith('/api/plan-check-list')) return this.lists.handle(input, init);
    const options = (init || {}) as { method?: string; headers?: Record<string, string>; body?: string };
    const method = (options.method || 'GET').toUpperCase();
    const auth = options.headers?.Authorization ?? options.headers?.authorization ?? null;
    const body = options.body === undefined ? undefined : JSON.parse(options.body);
    const entry: LoggedRequest = { method, path: url.pathname, query: url.search, auth };
    if (body !== undefined) entry.body = body;
    this.log.push(entry);

    const scriptedAt = this.scripted.findIndex((answer) => !answer.method || answer.method === method);
    const scripted = scriptedAt >= 0 ? this.scripted.splice(scriptedAt, 1)[0] : undefined;
    const gateAt = this.gates.findIndex((held) => held.method === method);
    const gate = gateAt >= 0 ? this.gates.splice(gateAt, 1)[0].gate : undefined;
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

  private route(method: string, url: URL, auth: string | null, body: unknown): FakeResponse {
    const guideMatch = /^\/api\/orders\/([^/]+)\/plan-guide$/.exec(url.pathname);
    const detailMatch = /^\/api\/orders\/([^/]+)$/.exec(url.pathname);
    const known = (method === 'PUT' && guideMatch && !this.oldServer) || (method === 'GET' && detailMatch);
    if (!known) return reply(404, { text: expressNotFoundPage(method, url.pathname) });

    // authenticateToken
    const token = auth && auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    if (!token) return reply(401, { json: { message: 'Authentication required. No token provided.' } });
    const user = this.users.get(token);
    if (!user) return reply(401, { json: { message: 'Invalid or corrupted token.' } });

    if (guideMatch) {
      try {
        return reply(200, { json: this.saveGuide(user, decodeURIComponent(guideMatch[1]), body) });
      } catch (err) {
        if (err instanceof HttpError) return reply(err.status, { json: err.body() });
        throw err;
      }
    }
    // getOrderDetails (controller: any error -> 404 {message})
    const orderNo = decodeURIComponent((detailMatch as RegExpExecArray)[1]);
    const order = this.orders.get(orderNo);
    if (!order) return reply(404, { json: { message: `Order "${orderNo}" not found.` } });
    const depts = ['yd', 'knitting', 'dyeing', 'finishing', 'delivery'];
    const answer: Record<string, unknown> = {
      order: clone(order),
      planData: null,
      fingerprints: Object.fromEntries(depts.map((d) => [d, 'fp'])),
      deptFlags: Object.fromEntries(depts.map((d) => [d, { inLatestFile: true, hasItems: true }])),
    };
    if (!this.oldServer) answer.guide = this.guides.has(orderNo) ? clone(this.guides.get(orderNo)) : null;
    return reply(200, { json: answer });
  }

  // PlanGuideService.save()
  private saveGuide(user: MockUser, orderNo: string, body: unknown): StoredGuide {
    const order = this.orders.get(orderNo);
    if (!order) throw new HttpError(404, `Order "${orderNo}" not found.`);

    // parseBody
    if (!isPlainObject(body)) throw invalid('Invalid Planning Guide data.');
    if (!isPlainObject(body.dates)) throw invalid('dates: the guide dates are required.');
    const dates = {} as GuideDates;
    for (const key of GUIDE_DATE_KEYS) {
      const value = body.dates[key];
      if (value !== '' && !isIsoDay(value)) throw invalid(`dates.${key}: must be empty or a date (YYYY-MM-DD).`);
      dates[key] = value as string;
    }
    let version: number | undefined;
    if (body.version !== undefined && body.version !== null) {
      if (typeof body.version !== 'number' || !Number.isInteger(body.version) || body.version < 1) {
        throw invalid('version: must be the version of the guide you loaded.');
      }
      version = body.version;
    }

    const stored = this.guides.get(orderNo);
    const list = this.lists.list as { value: Item[]; version: number };
    if (stored && version !== stored.version) {
      const when = formatDhakaDateTime(new Date(stored.updatedAt));
      throw new HttpError(
        409,
        `The Planning Guide of this order was changed by ${stored.updatedBy || 'another user'}${when ? ` at ${when}` : ''}. Reload the page to see the latest values.`,
        'CONFLICT'
      );
    }

    // checkYesIds
    if (!Array.isArray(body.yesIds)) throw invalid('yesIds: the list of checkpoints set to Yes is required.');
    const byId = new Map(list.value.map((check) => [check.id, check]));
    const storedYes = new Set(stored?.yesIds ?? []);
    const seen = new Set<string>();
    for (const id of body.yesIds) {
      if (typeof id !== 'string' || id === '') throw invalid('yesIds: each entry must be a checkpoint id.');
      const check = byId.get(id);
      const label = check?.name || id;
      if (seen.has(id)) throw invalid(`Checkpoint "${label}" is set to Yes more than once.`);
      seen.add(id);
      if (check?.active === true || storedYes.has(id)) continue;
      throw invalid(
        check ? `Checkpoint "${label}" is inactive in the Plan Check List, so it cannot be set to Yes.` : `Checkpoint "${label}" is not in the Plan Check List.`
      );
    }
    const yesIds = body.yesIds as string[];

    // checksSnapshot + tnaSnapshot
    const checks: Item[] = list.value.map(({ id, name, startDays, endDays, active }) => ({ id, name, startDays, endDays, active }));
    for (const id of yesIds) {
      if (checks.some((check) => check.id === id)) continue;
      const old = stored?.checks.find((check) => check.id === id);
      if (old) checks.push({ id, name: old.name, startDays: old.startDays, endDays: old.endDays, active: false });
    }
    const tna: Record<string, string> = {};
    for (const key of TNA_KEYS) tna[key] = order[key] === undefined || order[key] === null ? '' : String(order[key]);

    this.clock += 60 * 1000;
    const now = new Date(this.clock).toISOString();
    const saved: StoredGuide = {
      _id: orderNo,
      orderNo,
      yesIds: [...yesIds],
      dates,
      lead: computeLead(list.value, yesIds),
      checks,
      tna,
      checklistVersion: list.version,
      version: stored ? stored.version + 1 : 1,
      updatedBy: user.username,
      createdAt: stored ? stored.createdAt : now,
      updatedAt: now,
    };
    this.guides.set(orderNo, saved);
    return clone(saved);
  }
}
