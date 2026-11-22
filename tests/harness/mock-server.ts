import { createHash } from 'node:crypto';
import type { FixtureDb, Loose, ScriptedReply } from './types';

/*
 * In-memory stand-in for the Next Planning V3 server, limited to what the order page calls.
 * Each handler is a port of the server code (Next Planning V3 Server, src/):
 *   GET  /api/orders/:orderNo        controllers/order.controller.ts getSingleOrder + services/order.service.ts getOrderDetails
 *                                    (+ `fingerprints`, utils/plan-fingerprint.ts, and `deptFlags`)
 *   POST /api/orders/save-dates      order.controller.ts saveDates + order.service.ts savePlanningDates
 *                                    + services/status-engine.service.ts recalcSingleOrder
 *   POST /api/orders/save-plans      order.controller.ts savePlans + services/plan-save.service.ts (SPEC S1)
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

/* ---- utils/plan-fingerprint.ts ---- */
export const PLAN_DEPTS = ['yd', 'knitting', 'dyeing', 'finishing', 'delivery'];
const FP_ITEM_FIELDS = [
  'itemId',
  'planType',
  'startDate',
  'endDate',
  'floorStartDate',
  'floorEndDate',
  'floorPlanType',
  'yarnDate',
  'yarnOkDate',
  'matchingOptionDate',
  'limitation',
  'remarks',
  'unit',
  'processName',
  'barrierQty',
  'workableQty',
];
const FP_ITEM_DATA_FIELDS = ['Unit', 'ProcessName', 'Process Name', 'Barrier Qty.', 'Workable Qty.'];
const fpNorm = (value: unknown): string => (value === undefined || value === null ? '' : String(value));

export function fingerprintDept(planDoc: Loose, dept: string): string {
  const rows = planDoc?.[dept];
  const content: Record<string, unknown> = {
    status: fpNorm(planDoc?.[`${dept}Status`]),
    items: (Array.isArray(rows) ? rows : []).map((item: Loose) => {
      const fields: Record<string, string> = {};
      for (const key of FP_ITEM_FIELDS) fields[key] = fpNorm(item?.[key]);
      for (const key of FP_ITEM_DATA_FIELDS) fields[`itemData.${key}`] = fpNorm(item?.itemData?.[key]);
      return fields;
    }),
  };
  // US-11 (SERVER plan-fingerprint.ts): the extras count only when they hold a non-empty value.
  const extras = normaliseExtras(planDoc?.planExtras?.[dept]);
  if (extras.length) content.extras = extras;
  return createHash('sha1').update(JSON.stringify(content)).digest('hex');
}

function normaliseExtras(extras: unknown): [string, [string, string][]][] {
  const isObj = (v: unknown): v is Record<string, Loose> => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(extras)) return [];
  const result: [string, [string, string][]][] = [];
  for (const itemId of Object.keys(extras).sort()) {
    const fields = extras[itemId];
    if (!isObj(fields)) continue;
    const pairs = Object.keys(fields)
      .sort()
      .map((field): [string, string] => [field, fpNorm(fields[field])])
      .filter(([, value]) => value !== '');
    if (pairs.length) result.push([itemId, pairs]);
  }
  return result;
}

export function fingerprintAllDepts(planDoc: Loose): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of PLAN_DEPTS) out[d] = fingerprintDept(planDoc, d);
  return out;
}

const UNSAVED_FINGERPRINT = fingerprintDept(null, 'knitting');

function isUnsavedDept(planDoc: Loose, dept: string): boolean {
  const rows = planDoc?.[dept];
  const status = planDoc?.[`${dept}Status`];
  const noRows = rows === undefined || rows === null || (Array.isArray(rows) && rows.length === 0);
  return noRows && (status === undefined || status === null || status === '' || status === 'On Process');
}

const DEPT_NAMES: Record<string, string> = { yd: 'YD', knitting: 'Knitting', dyeing: 'Dyeing', finishing: 'Finishing', delivery: 'Delivery' };

/* ---- services/status-engine.service.ts computeSaveStatus (= recalcSingleOrder's rule) ---- */
function computeSaveStatus(items: Loose, orderStatus: Loose): string {
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
  return calculatedStatus;
}

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
    // A scenario's `save` step scripts the reply of the page's save request, which is now save-plans.
    if (method === 'POST' && path === '/api/orders/save-plans') return 'saveDates';
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
    if (kind === 'saveDates') return path === '/api/orders/save-plans' ? this.savePlans(body) : this.saveDates(body);
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
    // deptFlags: a department list (DeptValidOrders) that is missing or empty shows every order.
    const deptFlags: Record<string, { inLatestFile: boolean; hasItems: boolean }> = {};
    for (const d of PLAN_DEPTS) {
      const latest = this.db.deptValidOrders?.[d] || [];
      const items = order[`${d}Items`];
      deptFlags[d] = { inLatestFile: latest.length === 0 || latest.includes(orderNo), hasItems: Array.isArray(items) && items.length > 0 };
    }
    return makeResponse(200, {
      json: { order, planData: planDataRaw, fingerprints: fingerprintAllDepts(planDataRaw), deptFlags, guide: null },
    });
  }

  // OrderController.savePlans -> PlanSaveService.savePlans (SPEC S1, as implemented on the server branch)
  private savePlans(body: Loose): FakeResponse {
    const invalid = (message: string) => makeResponse(400, { json: { code: 'INVALID', message } });
    const isObject = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v);
    if (!isObject(body)) return invalid('Invalid input');
    const { orderNo, plans, base } = body;
    if (typeof orderNo !== 'string' || orderNo.trim() === '') return invalid('orderNo: The order number is required.');
    if (!Array.isArray(plans) || plans.length === 0) return invalid('plans: At least one department is required.');
    if (plans.length > PLAN_DEPTS.length) return invalid(`plans: at most ${PLAN_DEPTS.length} departments can be saved at once.`);
    const seen = new Set<string>();
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      if (!isObject(plan) || !PLAN_DEPTS.includes(plan.department)) return invalid(`plans.${i}.department: Invalid option`);
      if (seen.has(plan.department)) return invalid(`plans.${i}.department: Each department may appear only once.`);
      seen.add(plan.department);
      if (!Array.isArray(plan.fabricItems) || plan.fabricItems.length === 0) return invalid(`plans.${i}.fabricItems: At least one item is required.`);
      const bad = plan.fabricItems.findIndex((it: unknown) => !isObject(it));
      if (bad >= 0) return invalid(`plans.${i}.fabricItems.${bad}: Each item must be an object.`);
    }
    if (base !== undefined && !isObject(base)) return invalid('base: Invalid input');

    if (!this.db.orders.some((o) => o.orderNo === orderNo)) {
      return makeResponse(404, { json: { message: `Order "${orderNo}" not found.` } });
    }

    // OrderService.buildDeptSet for each department, in one $set
    const set: Record<string, Loose> = {};
    for (const plan of plans) {
      set[plan.department] = plan.fabricItems;
      if (plan.orderStatus) set[`${plan.department}Status`] = plan.orderStatus;
      if (plan.completedDate !== undefined) set[`${plan.department}CompletedDate`] = plan.completedDate;
    }
    // US-11: V3 extras replace the department's whole planExtras map, in the same write as its rows.
    const extrasSet: Record<string, Loose> = {};
    for (const plan of plans) {
      if (plan.extras === undefined) continue;
      if (!isObject(plan.extras) || !['knitting', 'dyeing'].includes(plan.department)) return invalid(`plans.${plans.indexOf(plan)}.extras: Invalid input`);
      extrasSet[plan.department] = plan.extras;
    }
    const withExtras = (doc: Loose): Loose =>
      Object.keys(extrasSet).length ? { ...doc, planExtras: { ...(doc?.planExtras || {}), ...extrasSet } } : doc;

    // The conflict check of the departments that have a `base`
    let record = this.db.orderDates.find((d) => d.orderNo === orderNo);
    const changed = plans
      .map((plan: Loose) => plan.department as string)
      .filter((d: string) => base && base[d] !== undefined)
      .filter((d: string) => {
        const stored = fingerprintDept(record ?? null, d);
        if (stored === base[d]) return false;
        if (base[d] === UNSAVED_FINGERPRINT && isUnsavedDept(record ?? null, d)) return false;
        if (stored === fingerprintDept(withExtras({ ...(record || {}), ...set }), d)) return false;
        return true;
      });
    if (changed.length > 0) {
      const ordered = PLAN_DEPTS.filter((d) => changed.includes(d));
      const names = ordered.map((d) => DEPT_NAMES[d]);
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
      return makeResponse(409, {
        json: {
          message: `${list} ${names.length > 1 ? 'were' : 'was'} changed by someone else after this order was opened.`,
          code: 'CONFLICT',
          departments: ordered,
        },
      });
    }

    // OrderDate.create (with the schema defaults) or one $set of the stored document
    const now = this.now();
    if (!record) {
      record = withOrderDateDefaults({ _id: this.nextObjectId(), orderNo, ...clone(set) });
      if (Object.keys(extrasSet).length) record.planExtras = clone(extrasSet);
      record.createdAt = now;
      record.updatedAt = now;
      record.__v = 0;
      this.db.orderDates.push(record);
    } else {
      Object.assign(record, clone(set));
      if (Object.keys(extrasSet).length) record.planExtras = { ...(record.planExtras || {}), ...clone(extrasSet) };
      record.updatedAt = now;
    }

    // computeSaveStatus per department, one Order update
    const planStatuses: Record<string, string> = {};
    const order = this.db.orders.find((o) => o.orderNo === orderNo);
    for (const plan of plans) {
      const status = computeSaveStatus(plan.fabricItems, plan.orderStatus);
      planStatuses[plan.department] = status;
      if (order) order[`${plan.department}PlanStatus`] = status;
    }
    if (order) order.updatedAt = now;

    return makeResponse(200, {
      json: {
        message: 'Planning Data saved successfully!',
        planData: clone(record),
        planStatuses,
        statusSynced: true,
        fingerprints: fingerprintAllDepts(record),
      },
    });
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
