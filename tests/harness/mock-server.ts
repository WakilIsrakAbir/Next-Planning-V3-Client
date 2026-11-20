import type { FixtureDb, Loose, ScriptedReply } from './types';

/*
 * In-memory stand-in for the Next Planning V3 server, limited to what the order page calls.
 * Each handler is a port of the server code (Next Planning V3 Server, src/):
 *   GET  /api/orders/:orderNo        controllers/order.controller.ts getSingleOrder + services/order.service.ts getOrderDetails
 *   POST /api/orders/save-dates      order.controller.ts saveDates + order.service.ts savePlanningDates
 *                                    + services/status-engine.service.ts recalcSingleOrder
 *   GET  /api/dropdowns              controllers/dropdown.controller.ts getAll + services/dropdown.service.ts getAllDropdowns
 *   any other route                  Express's default 404 page (there is no custom 404 handler in src/app.ts)
 * Every request needs `Authorization: Bearer <token>` (middleware/auth.middleware.ts), like the real API.
 * Replies are JSON round-tripped, so the page never shares objects with the server's documents.
 */

export const API_BASE = 'http://api.test';
export const TEST_TOKEN = 'test-token';

const DEPTS = ['knitting', 'dyeing', 'finishing', 'delivery', 'yd'];
const DEFAULT_UNITS = ['EFL', 'EKL', 'Ext', 'Outside'];
const DEFAULT_PROCESSES = ['Solid', 'Dyeing Wash', 'HTR', 'Pluvia', 'SB', 'WH', 'DF'];

export interface LoggedRequest {
  method: string;
  url: string;
  auth: string | null;
  body?: Loose;
}

export interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<Loose>;
  text: () => Promise<string>;
}

type ReplyKind = 'detail' | 'saveDates' | 'dropdowns' | 'other';

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

const ACTUAL_KEYS = ['knittingActual', 'dyeingActual', 'finishingActual', 'deliveryActual', 'ydActual', 'deliveryfloorActual'];

/** models/OrderDate.model.ts defaults, for the paths a document lacks. */
function withOrderDateDefaults(doc: Loose): Loose {
  const out = { ...doc };
  for (const d of DEPTS) if (!(d in out)) out[d] = [];
  for (const d of DEPTS) if (!(`${d}Status` in out)) out[`${d}Status`] = 'On Process';
  for (const d of DEPTS) if (!(`${d}CompletedDate` in out)) out[`${d}CompletedDate`] = null;
  for (const key of ACTUAL_KEYS) if (!(key in out)) out[key] = null;
  return out;
}

function expressNotFoundPage(method: string, path: string): string {
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot ${method} ${path}</pre>\n</body>\n</html>\n`;
}

function makeResponse(status: number, payload: { json?: Loose; text?: string }): FakeResponse {
  const text = payload.text !== undefined ? payload.text : JSON.stringify(payload.json);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

export class MockServer {
  readonly db: FixtureDb;
  readonly log: LoggedRequest[] = [];
  private readonly replies: Record<ReplyKind, ScriptedReply[]> = { detail: [], saveDates: [], dropdowns: [], other: [] };
  private readonly held: Array<() => void> = [];
  private idCounter = 0;

  constructor(db: FixtureDb) {
    this.db = clone(db);
  }

  /** The next request of this kind gets `reply` instead of the server's normal answer. */
  scriptNext(kind: ReplyKind, reply: ScriptedReply): void {
    this.replies[kind].push(reply);
  }

  /** Replies held by `hold`; a `release` step lets them through, in order. */
  get heldCount(): number {
    return this.held.length;
  }

  releaseHeld(): void {
    const all = this.held.splice(0);
    all.forEach((release) => release());
  }

  pendingScripts(): string[] {
    return (Object.keys(this.replies) as ReplyKind[]).filter((k) => this.replies[k].length > 0);
  }

  fetch = async (input: unknown, init: unknown): Promise<FakeResponse> => {
    const url = String(input);
    const opts = (init || {}) as { method?: string; headers?: Record<string, string>; body?: string };
    const method = (opts.method || 'GET').toUpperCase();
    if (!url.startsWith(API_BASE + '/')) throw new Error(`Mocked server: unexpected URL ${url}`);
    const pathAndQuery = url.slice(API_BASE.length);
    const headers = opts.headers || {};
    const auth = headers.Authorization ?? headers.authorization ?? null;
    const entry: LoggedRequest = { method, url: pathAndQuery, auth };
    if (opts.body !== undefined) {
      try {
        entry.body = JSON.parse(opts.body);
      } catch {
        entry.body = opts.body;
      }
    }
    this.log.push(entry);

    const [path, query = ''] = pathAndQuery.split('?');
    const kind = this.kindOf(method, path);
    const scripted = this.replies[kind].shift();
    if (scripted?.networkError) throw new TypeError('Failed to fetch');

    const respond = (): FakeResponse => {
      if (scripted && (scripted.status !== undefined || scripted.json !== undefined || scripted.text !== undefined)) {
        return makeResponse(scripted.status ?? 200, { json: scripted.json, text: scripted.text });
      }
      return this.handle(method, path, query, auth, entry.body);
    };

    if (scripted?.hold) {
      // The server does its work now; the browser sees the reply only when the step releases it.
      const response = respond();
      return new Promise<FakeResponse>((resolve) => {
        this.held.push(() => resolve(response));
      });
    }
    return respond();
  };

  private kindOf(method: string, path: string): ReplyKind {
    if (method === 'GET' && path === '/api/dropdowns') return 'dropdowns';
    if (method === 'POST' && path === '/api/orders/save-dates') return 'saveDates';
    if (method === 'GET' && /^\/api\/orders\/[^/]+$/.test(path)) return 'detail';
    return 'other';
  }

  private handle(method: string, path: string, query: string, auth: string | null, body: Loose): FakeResponse {
    // middleware/auth.middleware.ts (the page always sends "Bearer <localStorage token>")
    const token = auth && auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    if (!token) return makeResponse(401, { json: { message: 'Authentication required. No token provided.' } });
    if (token !== TEST_TOKEN) return makeResponse(401, { json: { message: 'Invalid or corrupted token.' } });

    const kind = this.kindOf(method, path);
    if (kind === 'dropdowns') return this.getAllDropdowns();
    if (kind === 'saveDates') return this.saveDates(body);
    if (kind === 'detail') {
      const orderNo = decodeURIComponent(path.slice('/api/orders/'.length));
      const dept = new URLSearchParams(query).get('dept') || undefined;
      return this.getSingleOrder(orderNo, dept);
    }
    return makeResponse(404, { text: expressNotFoundPage(method, path) });
  }

  private now(): string {
    return new Date(Date.now()).toISOString();
  }

  private nextObjectId(): string {
    this.idCounter += 1;
    return `fe00000000000000${String(this.idCounter).padStart(8, '0')}`;
  }

  // OrderController.getSingleOrder -> OrderService.getOrderDetails (always fresh: a save clears the server cache)
  private getSingleOrder(orderNo: string, dept?: string): FakeResponse {
    void dept; // only part of the server's cache key
    const orderRaw = clone(this.db.orders.find((o) => o.orderNo === orderNo));
    const planDataRaw = clone(this.db.orderDates.find((d) => d.orderNo === orderNo)) ?? null;
    if (!orderRaw) return makeResponse(404, { json: { message: `Order "${orderNo}" not found.` } });

    const order = orderRaw;
    const allItems = [
      ...(order.knittingItems || []),
      ...(order.dyeingItems || []),
      ...(order.finishingItems || []),
      ...(order.deliveryItems || []),
      ...(order.ydItems || []),
    ];
    if ((!order.requiredQtyKgs || order.requiredQtyKgs === '') && allItems.length > 0) {
      const sum = allItems.reduce((acc: number, it: Loose) => {
        const q = Number(it.RequiredQtyKgs || it.requiredQtyKgs || it['Req Qty'] || it.Qty || 0);
        return acc + (isNaN(q) ? 0 : q);
      }, 0);
      if (sum > 0) order.requiredQtyKgs = sum;
    }
    if (!order.buyer && allItems.length > 0) {
      const bItem = allItems.find((it: Loose) => it.Buyer || it.BuyerName || it.Customer);
      if (bItem) order.buyer = bItem.Buyer || bItem.BuyerName || bItem.Customer || '';
    }
    if (!order.style && allItems.length > 0) {
      const sItem = allItems.find((it: Loose) => it.Style || it.style);
      if (sItem) order.style = sItem.Style || sItem.style || '';
    }
    if (!order.gmtUnit && allItems.length > 0) {
      const uItem = allItems.find((it: Loose) => it.Unit || it['Booking Unit'] || it.GmtUnit);
      if (uItem) order.gmtUnit = uItem.Unit || uItem['Booking Unit'] || uItem.GmtUnit || '';
    }
    if (!order.floor && allItems.length > 0) {
      const fItem = allItems.find((it: Loose) => it.Floor || it.floor);
      if (fItem) order.floor = fItem.Floor || fItem.floor || '';
    }
    return makeResponse(200, { json: { order, planData: planDataRaw } });
  }

  // OrderController.saveDates -> OrderService.savePlanningDates (+ StatusEngineService.recalcSingleOrder)
  private saveDates(body: Loose): FakeResponse {
    const { orderNo, department, fabricItems, orderStatus, completedDate, actualData } = body || {};
    const updateObj: Record<string, Loose> = {};
    if (actualData) {
      updateObj[department] = actualData;
    } else if (fabricItems) {
      updateObj[department] = fabricItems;
    }
    if (orderStatus) updateObj[`${department}Status`] = orderStatus;
    if (completedDate !== undefined) updateObj[`${department}CompletedDate`] = completedDate;

    // OrderDate.findOneAndUpdate({orderNo}, {$set}, {upsert: true, returnDocument: 'after'}):
    // an insert stores the schema defaults; an update changes only the $set fields.
    const now = this.now();
    let record = this.db.orderDates.find((d) => d.orderNo === orderNo);
    if (!record) {
      record = withOrderDateDefaults({ _id: this.nextObjectId(), orderNo, ...clone(updateObj) });
      record.createdAt = now;
      record.updatedAt = now;
      record.__v = 0;
      this.db.orderDates.push(record);
    } else {
      Object.assign(record, clone(updateObj));
      record.updatedAt = now;
    }

    // StatusEngineService.recalcSingleOrder(orderNo, department, fabricItems || [], orderStatus)
    const items = fabricItems || [];
    const dept = String(department).replace('Actual', '');
    if (DEPTS.includes(dept)) {
      let calculatedStatus = 'Pending';
      if (orderStatus === 'Completed') {
        calculatedStatus = 'Completed';
      } else if (items && Array.isArray(items) && items.length > 0) {
        let hasSelect = false;
        let hasTentative = false;
        let confirmCount = 0;
        items.forEach((item: Loose) => {
          const pt = item.planType;
          if (!pt || pt === '' || pt === 'Select') hasSelect = true;
          else if (pt === 'Tentative') hasTentative = true;
          else if (pt === 'Confirm') confirmCount++;
        });
        if (hasSelect) calculatedStatus = 'Pending';
        else if (hasTentative) calculatedStatus = 'Tentative';
        else if (confirmCount === items.length) calculatedStatus = 'Confirm';
        else calculatedStatus = 'Pending';
      }
      const order = this.db.orders.find((o) => o.orderNo === orderNo);
      if (order) {
        order[`${dept}PlanStatus`] = calculatedStatus;
        order.updatedAt = now;
      }
    }
    if (actualData && String(department).includes('Actual')) {
      const order = this.db.orders.find((o) => o.orderNo === orderNo);
      if (order) order[`${String(department).replace('Actual', '')}ActualEnd`] = actualData.actualEnd || '';
    }

    // The returned Mongoose document shows the schema defaults for paths the stored document lacks.
    return makeResponse(200, { json: { message: 'Planning Data saved successfully!', data: withOrderDateDefaults(record) } });
  }

  // DropdownController.getAll -> DropdownService.getAllDropdowns (seeds the defaults into an empty collection)
  private getAllDropdowns(): FakeResponse {
    if (this.db.dropdownmasters.length === 0) {
      const now = this.now();
      DEFAULT_UNITS.forEach((name) =>
        this.db.dropdownmasters.push({ _id: this.nextObjectId(), type: 'UNIT', name, status: 'ACTIVE', deletedAt: null, createdAt: now, updatedAt: now, __v: 0 })
      );
      DEFAULT_PROCESSES.forEach((name) =>
        this.db.dropdownmasters.push({ _id: this.nextObjectId(), type: 'PROCESS', name, status: 'ACTIVE', deletedAt: null, createdAt: now, updatedAt: now, __v: 0 })
      );
    }
    const items = this.db.dropdownmasters;
    const units = items.filter((it) => it.type === 'UNIT');
    const processes = items.filter((it) => it.type === 'PROCESS');
    return makeResponse(200, { json: { units, processes, totalUnits: units.length, totalProcesses: processes.length } });
  }
}
