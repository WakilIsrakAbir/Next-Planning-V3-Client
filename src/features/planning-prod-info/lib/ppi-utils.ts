// ==========================================================
// Planning & Production Info (PPI) report helpers.
// Ported from the old app's js/planning-prod-info.js (HEAD cfa95b1): date / lead-day / OTT helpers,
// tolerant column lookups, item ids, the department plan status resolver (with the same row matching
// as the department screens), the colour-wise summary and the Excel sheet layout.
// ==========================================================

export type PPIRecord = Record<string, unknown>;

export interface PPISavedPlanItem extends PPIRecord {
  itemId?: string;
  itemData?: PPIRecord;
  planType?: string;
  floorPlanType?: string;
  startDate?: string;
  endDate?: string;
  floorStartDate?: string;
  floorEndDate?: string;
  yarnDate?: string;
}

export interface PPIActual extends PPIRecord {
  actualStart?: string;
  actualEnd?: string;
  failReason?: string;
  remarks?: string;
  relatedDept?: string;
  yarnDate?: string;
}

export interface PPIPlanData extends PPIRecord {
  knitting?: PPISavedPlanItem[];
  dyeing?: PPISavedPlanItem[];
  delivery?: PPISavedPlanItem[];
  knittingActual?: PPIActual;
  dyeingActual?: PPIActual;
  deliveryActual?: PPIActual;
  deliveryfloorActual?: PPIActual;
}

export interface PPIOrder extends PPIRecord {
  _id?: string;
  orderNo?: string;
  buyer?: string;
  status?: string;
  bookingDate?: string;
  yarnDate?: string;
  knitStart?: string;
  knitEnd?: string;
  dyeStart?: string;
  dyeEnd?: string;
  deliStart?: string;
  deliEnd?: string;
  knittingItems?: PPIRecord[];
  dyeingItems?: PPIRecord[];
  deliveryItems?: PPIRecord[];
}

// ==========================================
// Small value helpers (JS `||` semantics without `any`)
// ==========================================

/** Same as JS `a || b || c`: the first truthy value, otherwise the last value. */
export function firstTruthy(...values: unknown[]): unknown {
  for (const v of values) if (v) return v;
  return values[values.length - 1];
}

/** String form of a value; null / undefined become ''. */
export function toText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

/** Excel cell form of a value: numbers stay numbers, everything else becomes text. */
function toCell(value: unknown): string | number {
  return typeof value === 'number' ? value : toText(value);
}

// ==========================================
// Date, Lead Day & OTT helpers
// ==========================================
const isBlankDate = (v: unknown) => !v || v === '—' || v === '-';

function toDate(value: unknown): Date {
  const s = String(value);
  return new Date(s.includes('T') ? s : `${s}T00:00:00`);
}

export function formatPPIDate(dateStr?: unknown): string {
  if (!dateStr || dateStr === '-' || dateStr === 'N/A' || dateStr === '—' || dateStr === 'undefined') return '—';
  // If already formatted like DD-MMM-YYYY
  if (/^\d{2}-[A-Za-z]{3,4}-\d{4}$/.test(String(dateStr))) return String(dateStr);
  const d = toDate(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

export function calcPPILeadDay(planStr?: unknown, actStr?: unknown): string {
  if (isBlankDate(planStr) || isBlankDate(actStr)) return '—';
  const pDate = toDate(planStr);
  const aDate = toDate(actStr);
  if (isNaN(pDate.getTime()) || isNaN(aDate.getTime())) return '—';
  const diffDays = Math.round((aDate.setHours(0, 0, 0, 0) - pDate.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `+${diffDays}`;
  if (diffDays === 0) return '0';
  return `${diffDays}`;
}

export interface PPIOTTResult {
  text: string;
  isPass: boolean;
  isFail: boolean;
}

export function getPPIOTTResult(planStr?: unknown, actStr?: unknown): PPIOTTResult {
  const none = { text: '—', isPass: false, isFail: false };
  if (isBlankDate(planStr)) return none;
  const pDate = toDate(planStr);
  if (isNaN(pDate.getTime())) return none;

  if (!isBlankDate(actStr)) {
    const aDate = toDate(actStr);
    if (!isNaN(aDate.getTime())) {
      const pass = aDate.setHours(0, 0, 0, 0) <= pDate.setHours(0, 0, 0, 0);
      return { text: pass ? 'Pass' : 'Fail', isPass: pass, isFail: !pass };
    }
  }

  // When actual is empty, check if plan date is past
  const today = new Date().setHours(0, 0, 0, 0);
  if (pDate.setHours(0, 0, 0, 0) < today) return { text: 'Fail', isPass: false, isFail: true };
  return none;
}

// ==========================================
// Tolerant column lookups (old ppiGetNum / ppiGetString)
// ==========================================
const normKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

function parsePPINumber(value: unknown): number {
  return parseFloat(String(value).replace(/,/g, '').replace(/%/g, '').trim());
}

/**
 * First numeric value among the candidate columns: exact names first, then names compared without case,
 * spaces or punctuation. A candidate whose value is not a number is skipped (the next one is tried).
 */
export function ppiGetNum(item: PPIRecord | null | undefined, fieldNames: string[]): number {
  if (!item) return 0;
  for (const f of fieldNames) {
    const v = item[f];
    if (v !== undefined && v !== null && v !== '') {
      const num = parsePPINumber(v);
      if (!isNaN(num)) return num;
    }
  }
  const keys = Object.keys(item);
  for (const f of fieldNames) {
    const norm = normKey(f);
    const found = keys.find((k) => normKey(k) === norm);
    if (found) {
      const v = item[found];
      if (v !== undefined && v !== null && v !== '') {
        const num = parsePPINumber(v);
        if (!isNaN(num)) return num;
      }
    }
  }
  return 0;
}

/** First non-blank text among the candidate columns (exact names first, then normalized names). */
export function ppiGetString(item: PPIRecord | null | undefined, fieldNames: string[]): string {
  if (!item) return '';
  for (const f of fieldNames) {
    const v = item[f];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  const keys = Object.keys(item);
  for (const f of fieldNames) {
    const norm = normKey(f);
    const found = keys.find((k) => normKey(k) === norm);
    if (found) {
      const v = item[found];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
  }
  return '';
}

// ==========================================
// Item ID & Department Plan Status Resolvers
// ==========================================
export type PPIDept = 'knitting' | 'dyeing' | 'finishing' | 'delivery' | 'yd';

const COLOR_FIELDS = ['Color', 'Colour', 'Fab Color', 'color', 'colour'];
const normId = (v: unknown) => String(v).toLowerCase().replace(/\s+/g, '');

export function getPPIItemId(item: PPIRecord | null | undefined, dept: PPIDept, orderNo?: string): string {
  if (!item) return '';
  if (item.itemId) return normId(item.itemId);

  const bNo = ppiGetString(item, ['BookingNo', 'OrderNo', 'EWO', 'Booking', 'Order No', 'Booking No']) || orderNo || 'N/A';
  const color = ppiGetString(item, COLOR_FIELDS) || 'N/A';

  if (dept === 'knitting' || dept === 'delivery') {
    const fabConst =
      ppiGetString(item, ['FabricConstruction', 'Fabric Construction', 'Construction', 'Fab Const', 'Fabric']) || 'N/A';
    const gsm = ppiGetString(item, ['GSM', 'G.S.M', 'Body GSM', 'gsm']) || 'N/A';
    return normId(`${bNo}_${color}_${fabConst}_${gsm}`);
  }
  if (dept === 'yd') {
    const type = ppiGetString(item, ['Booking Type', 'Type', 'YD Type', 'BookingType']) || 'N/A';
    const ydb = ppiGetString(item, ['YDB', 'YD B']) || 'N/A';
    return normId(`${bNo}_${type}_${ydb}`);
  }
  // dyeing, finishing
  const procName = ppiGetString(item, ['Process Name', 'ProcessName', 'Process', 'processName']) || 'N/A';
  return normId(`${bNo}_${color}_${procName}`);
}

/** Id of a saved plan row: its stored itemId, otherwise the id built from its item data. */
function getSavedPlanId(p: PPISavedPlanItem, dept: PPIDept, orderNo?: string): string {
  return p.itemId ? normId(p.itemId) : getPPIItemId(p.itemData || p, dept, orderNo);
}

export interface PPIDeptPlanInfo {
  planType: string;
  startDate: unknown;
  endDate: unknown;
}

const hasDate = (v: unknown) => !!v && v !== '—' && v !== '-';

/**
 * Plan type and plan start / end of one department, evaluated from the order's current (uploaded) items.
 * Every current item is matched to its saved plan row; the department is Confirm only when every item is
 * Confirm, Tentative when none is pending but one is Tentative, otherwise Pending. Dates are the earliest
 * start and latest end of the Confirm / Tentative rows, falling back to the order's T&A dates.
 */
export function resolveDepartmentPlanInfo(
  currentItems: PPIRecord[] | null | undefined,
  savedPlanItems: PPISavedPlanItem[] | null | undefined,
  dept: PPIDept,
  defaultStart: unknown,
  defaultEnd: unknown,
  orderNo?: string
): PPIDeptPlanInfo {
  const items = currentItems || [];
  const savedList = savedPlanItems || [];

  if (items.length === 0) {
    return {
      planType: hasDate(defaultStart) ? 'T&A' : 'Pending',
      startDate: defaultStart || '—',
      endDate: defaultEnd || '—',
    };
  }

  // Map saved plan items by itemId
  const planMap = new Map<string, PPISavedPlanItem>();
  savedList.forEach((p) => {
    const id = getSavedPlanId(p, dept, orderNo);
    if (id) planMap.set(id, p);
  });

  let hasPendingOrMissing = false;
  let hasTentative = false;
  let confirmCount = 0;
  let matchCount = 0;
  const validStarts: string[] = [];
  const validEnds: string[] = [];

  // A saved row is matched the same way the department screens and the upload sync match it: exact id,
  // then the id without a trailing '_n/a' or '_', then by Color (dyeing/finishing) or YDB (yd). Without
  // these steps one row that did not match made the whole department "Pending" with the T&A dates.
  const findSaved = (item: PPIRecord, itemId: string): PPISavedPlanItem | undefined => {
    const exact = planMap.get(itemId);
    if (exact || savedList.length === 0) return exact;
    const cleanId = itemId.replace(/(_n\/a|_)$/i, '').toLowerCase();
    for (const [id, p] of planMap) {
      if (id.replace(/(_n\/a|_)$/i, '') === cleanId) return p;
    }
    if (dept === 'dyeing' || dept === 'finishing') {
      const color = ppiGetString(item, COLOR_FIELDS).toLowerCase();
      if (color) {
        return savedList.find((p) => ppiGetString(p.itemData || p, ['Color', 'Colour', 'Fab Color']).toLowerCase() === color);
      }
    }
    if (dept === 'yd') {
      const ydb = ppiGetString(item, ['YDB', 'YD B']).toLowerCase();
      if (ydb && ydb !== 'n/a') {
        return savedList.find((p) => ppiGetString(p.itemData || p, ['YDB', 'YD B']).toLowerCase() === ydb);
      }
    }
    return undefined;
  };

  const isDelivery = dept === 'delivery';

  items.forEach((item, idx) => {
    const itemId = getPPIItemId(item, dept, orderNo) || `item_${idx}`;
    const saved = findSaved(item, itemId);
    if (saved) matchCount++;

    const pType = isDelivery ? firstTruthy(saved?.floorPlanType, saved?.planType, '') : firstTruthy(saved?.planType, '');

    const pStart = isDelivery
      ? firstTruthy(
          saved?.floorStartDate,
          saved?.['Delivery Plan Start (Floor)'],
          saved?.startDate,
          saved?.['Plan Start Date'],
          saved?.['Start Date'],
          ''
        )
      : firstTruthy(
          saved?.startDate,
          saved?.['Plan Start Date'],
          saved?.['Plan Start'],
          saved?.['Start Date'],
          saved?.['Knit Start Date'],
          saved?.['Dyeing Start Date'],
          ''
        );

    const pEnd = isDelivery
      ? firstTruthy(
          saved?.floorEndDate,
          saved?.['Delivery Plan End (Floor)'],
          saved?.endDate,
          saved?.['Plan End Date'],
          saved?.['End Date'],
          ''
        )
      : firstTruthy(
          saved?.endDate,
          saved?.['Plan End Date'],
          saved?.['Plan End'],
          saved?.['End Date'],
          saved?.['Knit End Date'],
          saved?.['Dyeing End Date'],
          ''
        );

    const cleanType = String(pType).trim();

    if (!cleanType || cleanType === 'Select' || cleanType === 'Pending' || cleanType === '—' || cleanType === '-') {
      hasPendingOrMissing = true;
    } else if (cleanType === 'Tentative' || cleanType === 'Confirm') {
      if (cleanType === 'Tentative') hasTentative = true;
      else confirmCount++;
      if (hasDate(pStart)) validStarts.push(String(pStart));
      if (hasDate(pEnd)) validEnds.push(String(pEnd));
    } else {
      hasPendingOrMissing = true;
    }
  });

  let overallType = 'Pending';
  if (matchCount === 0) {
    overallType = savedList.length > 0 ? 'Pending' : hasDate(defaultStart) ? 'T&A' : 'Pending';
  } else if (hasPendingOrMissing) {
    overallType = 'Pending';
  } else if (hasTentative) {
    overallType = 'Tentative';
  } else if (confirmCount === items.length && items.length > 0) {
    overallType = 'Confirm';
  }

  validStarts.sort();
  validEnds.sort();

  return {
    planType: overallType,
    startDate: validStarts.length > 0 ? validStarts[0] : defaultStart || '—',
    endDate: validEnds.length > 0 ? validEnds[validEnds.length - 1] : defaultEnd || '—',
  };
}

// ==========================================
// Section 2: Milestones (Plan vs Actual)
// ==========================================
export type PPIMilestoneKey = 'yarn' | 'knitStart' | 'knitEnd' | 'dyeStart' | 'dyeEnd' | 'deliStart' | 'deliEnd';
export const PPI_MILESTONE_KEYS: PPIMilestoneKey[] = ['yarn', 'knitStart', 'knitEnd', 'dyeStart', 'dyeEnd', 'deliStart', 'deliEnd'];

export interface PPIMilestones {
  planned: Record<PPIMilestoneKey, string>;
  planTypes: { yarn: string; knit: string; dye: string; deli: string };
  actual: Record<PPIMilestoneKey, string>;
  leadDays: Record<PPIMilestoneKey, string>;
  ott: Record<PPIMilestoneKey, PPIOTTResult>;
  reasons: { yarn: string; knit: string; dye: string; deli: string };
}

function mapKeys<T>(fn: (key: PPIMilestoneKey) => T): Record<PPIMilestoneKey, T> {
  const out = {} as Record<PPIMilestoneKey, T>;
  PPI_MILESTONE_KEYS.forEach((k) => {
    out[k] = fn(k);
  });
  return out;
}

function buildMilestones(
  plan: Record<PPIMilestoneKey, unknown>,
  act: Record<PPIMilestoneKey, unknown>,
  planTypes: PPIMilestones['planTypes'],
  reasons: PPIMilestones['reasons']
): PPIMilestones {
  return {
    planned: mapKeys((k) => formatPPIDate(plan[k])),
    planTypes,
    actual: mapKeys((k) => formatPPIDate(act[k])),
    leadDays: mapKeys((k) => calcPPILeadDay(plan[k], act[k])),
    ott: mapKeys((k) => getPPIOTTResult(plan[k], act[k])),
    reasons,
  };
}

function getActuals(pd: PPIPlanData): { actKnit: PPIActual; actDye: PPIActual; actDeli: PPIActual } {
  const none: PPIActual = {};
  return {
    actKnit: pd.knittingActual || none,
    actDye: pd.dyeingActual || none,
    actDeli: pd.deliveryfloorActual || pd.deliveryActual || none,
  };
}

/**
 * Actual yarn date: the yarn date entered on the knitting plan rows, otherwise the knitting actual's.
 * With activeOnly, only saved rows whose id matches a current knitting item are considered.
 */
function resolveActualYarnDate(o: PPIOrder, pd: PPIPlanData, activeOnly: boolean): unknown {
  let actYarnDate: unknown = '';
  const saved = pd.knitting || [];
  if (saved.length > 0) {
    let source = saved;
    if (activeOnly) {
      const kItems = o.knittingItems || [];
      const activeIds = new Set(kItems.map((item, idx) => getPPIItemId(item, 'knitting', o.orderNo) || `item_${idx}`));
      source = saved.filter((i) => activeIds.has(getSavedPlanId(i, 'knitting', o.orderNo)));
    }
    const found = source.map((i) => i.yarnDate).find(Boolean);
    if (found) actYarnDate = found;
  }
  if (!actYarnDate && pd.knittingActual && pd.knittingActual.yarnDate) {
    actYarnDate = pd.knittingActual.yarnDate;
  }
  return actYarnDate;
}

/** Milestones shown on the report screen and printed: department plans resolved from the current items. */
export function computePPIMilestones(order: PPIOrder, planData: PPIPlanData | null | undefined): PPIMilestones {
  const o = order;
  const pd = planData || {};

  const knit = resolveDepartmentPlanInfo(o.knittingItems, pd.knitting, 'knitting', o.knitStart, o.knitEnd, o.orderNo);
  const dye = resolveDepartmentPlanInfo(o.dyeingItems, pd.dyeing, 'dyeing', o.dyeStart, o.dyeEnd, o.orderNo);
  const deli = resolveDepartmentPlanInfo(o.deliveryItems, pd.delivery, 'delivery', o.deliStart, o.deliEnd, o.orderNo);

  const actYarnDate = resolveActualYarnDate(o, pd, true);
  const { actKnit, actDye, actDeli } = getActuals(pd);

  const fmtRsn = (reason?: unknown, dept?: unknown) => {
    if (!reason && !dept) return '—';
    if (reason && dept) return `${toText(reason)} - ${toText(dept)}`;
    return toText(reason || dept);
  };

  return buildMilestones(
    {
      yarn: o.yarnDate,
      knitStart: knit.startDate,
      knitEnd: knit.endDate,
      dyeStart: dye.startDate,
      dyeEnd: dye.endDate,
      deliStart: deli.startDate,
      deliEnd: deli.endDate,
    },
    {
      yarn: actYarnDate,
      knitStart: actKnit.actualStart,
      knitEnd: actKnit.actualEnd,
      dyeStart: actDye.actualStart,
      dyeEnd: actDye.actualEnd,
      deliStart: actDeli.actualStart,
      deliEnd: actDeli.actualEnd,
    },
    { yarn: 'T&A', knit: knit.planType, dye: dye.planType, deli: deli.planType },
    {
      yarn: '—',
      knit: fmtRsn(actKnit.failReason || actKnit.remarks, actKnit.relatedDept),
      dye: fmtRsn(actDye.failReason || actDye.remarks, actDye.relatedDept),
      deli: fmtRsn(actDeli.failReason || actDeli.remarks, actDeli.relatedDept),
    }
  );
}

/**
 * Milestones written by the old exportPPIToExcel at HEAD: commit 9f5779d reverted the Excel export to the
 * earlier extraction over all saved plan rows (the report screen keeps the resolver above).
 */
function computeExcelMilestones(order: PPIOrder, planData: PPIPlanData | null | undefined): PPIMilestones {
  const o = order;
  const pd = planData || {};

  const fromSaved = (
    saved: PPISavedPlanItem[] | undefined,
    defStart: unknown,
    defEnd: unknown,
    startOf: (i: PPISavedPlanItem) => unknown,
    endOf: (i: PPISavedPlanItem) => unknown,
    typeOf: (i: PPISavedPlanItem) => unknown,
    pickSource: (list: PPISavedPlanItem[]) => PPISavedPlanItem[] = (list) => list
  ) => {
    let start = defStart;
    let end = defEnd;
    let planType = 'T&A';
    if (saved && saved.length > 0) {
      const source = pickSource(saved);
      const starts = source.map(startOf).filter(Boolean).map(String).sort();
      const ends = source.map(endOf).filter(Boolean).map(String).sort();
      if (starts.length) {
        start = starts[0];
        end = ends[ends.length - 1];
      }
      const savedType = source.map(typeOf).find(Boolean);
      if (savedType && savedType !== 'Select') planType = String(savedType);
    }
    return { start, end, planType };
  };

  const knit = fromSaved(
    pd.knitting,
    o.knitStart,
    o.knitEnd,
    (i) => firstTruthy(i.startDate, i['Plan Start Date'], i['Plan Start'], i['Start Date'], i['Knit Start Date']),
    (i) => firstTruthy(i.endDate, i['Plan End Date'], i['Plan End'], i['End Date'], i['Knit End Date']),
    (i) => i.planType
  );
  const dye = fromSaved(
    pd.dyeing,
    o.dyeStart,
    o.dyeEnd,
    (i) => firstTruthy(i.startDate, i['Plan Start Date'], i['Plan Start'], i['Start Date'], i['Dyeing Start Date']),
    (i) => firstTruthy(i.endDate, i['Plan End Date'], i['Plan End'], i['End Date'], i['Dyeing End Date']),
    (i) => i.planType
  );
  const deli = fromSaved(
    pd.delivery,
    o.deliStart,
    o.deliEnd,
    (i) => firstTruthy(i.floorStartDate, i['Delivery Plan Start (Floor)'], i.startDate, i['Delivery Plan Start']),
    (i) => firstTruthy(i.floorEndDate, i['Delivery Plan End (Floor)'], i.endDate, i['Delivery Plan End']),
    (i) => firstTruthy(i.floorPlanType, i.planType),
    (list) => {
      const floorItems = list.filter((i) => {
        const type = firstTruthy(i.floorPlanType, i['Delivery Plan Type (Floor)'], '');
        return type === 'Confirm' || type === 'Tentative';
      });
      return floorItems.length ? floorItems : list;
    }
  );

  const actYarnDate = resolveActualYarnDate(o, pd, false);
  const { actKnit, actDye, actDeli } = getActuals(pd);

  const rsn = (a: PPIActual) =>
    a.failReason ? `${toText(a.failReason)}${a.relatedDept ? ` - ${toText(a.relatedDept)}` : ''}` : '—';

  return buildMilestones(
    {
      yarn: o.yarnDate,
      knitStart: knit.start,
      knitEnd: knit.end,
      dyeStart: dye.start,
      dyeEnd: dye.end,
      deliStart: deli.start,
      deliEnd: deli.end,
    },
    {
      yarn: actYarnDate,
      knitStart: actKnit.actualStart,
      knitEnd: actKnit.actualEnd,
      dyeStart: actDye.actualStart,
      dyeEnd: actDye.actualEnd,
      deliStart: actDeli.actualStart,
      deliEnd: actDeli.actualEnd,
    },
    { yarn: 'T&A', knit: knit.planType, dye: dye.planType, deli: deli.planType },
    { yarn: '—', knit: rsn(actKnit), dye: rsn(actDye), deli: rsn(actDeli) }
  );
}

// ==========================================
// Section 3: Colour-wise summary
// ==========================================
export interface PPIColorAgg {
  allowances: number[];
  allocQty: number;
  yarnBal: number;
  knitProd: number;
  knitBal: number;
  dyeOk: number;
  dyeBal: number;
  bookingQty: number;
  receivedQty: number;
  deliveredQty: number;
  deliBal: number;
  rfd: number;
  slowMoving: number;
}

type PPISummedField = Exclude<keyof PPIColorAgg, 'allowances'>;

export interface PPIMetric {
  label: string;
  isPercent?: boolean;
  isAvg?: boolean;
  getValue: (agg: PPIColorAgg) => number;
}

export const PPI_METRICS: PPIMetric[] = [
  {
    label: 'Allowance %',
    isPercent: true,
    isAvg: true,
    getValue: (agg) => (agg.allowances.length ? agg.allowances.reduce((a, b) => a + b, 0) / agg.allowances.length : 0),
  },
  { label: 'Allocated Qty', getValue: (agg) => agg.allocQty },
  { label: 'Yarn bala.', getValue: (agg) => agg.yarnBal },
  { label: 'Knit Prod.', getValue: (agg) => agg.knitProd },
  { label: 'Knit. Bala.', getValue: (agg) => agg.knitBal },
  { label: 'Dyeing ok', getValue: (agg) => agg.dyeOk },
  { label: 'Dyeing Bal.', getValue: (agg) => agg.dyeBal },
  { label: 'Booking qty', getValue: (agg) => agg.bookingQty },
  { label: 'Received Qty.', getValue: (agg) => agg.receivedQty },
  { label: 'Delivered Qty', getValue: (agg) => agg.deliveredQty },
  { label: 'Deli. Bala.', getValue: (agg) => agg.deliBal },
  { label: 'RFD', getValue: (agg) => agg.rfd },
  { label: 'Slow moving', getValue: (agg) => agg.slowMoving },
];

interface PPIColorFieldMap {
  allowance: string[];
  knitting: Partial<Record<PPISummedField, string[]>>;
  dyeing: Partial<Record<PPISummedField, string[]>>;
  delivery: Partial<Record<PPISummedField, string[]>>;
}

const ALLOWANCE_FIELDS = ['Allowance %', 'Allowance', 'Wastage %', 'Wastage', 'Allow %', 'Allow'];

/** Column mapping of the report screen (old renderPPIColorSummary). */
const SCREEN_COLOR_FIELDS: PPIColorFieldMap = {
  allowance: ALLOWANCE_FIELDS,
  knitting: {
    allocQty: ['Allocated Qty', 'Allocated Qty ', 'AllocatedQty'],
    yarnBal: ['Yarn bala.', 'Yarn Bala', 'YarnBala'],
    knitProd: ['Knit Prod.', 'KnitProd'],
    knitBal: ['Knit. Bala.', 'KnitBala', 'Knit Bala'],
  },
  dyeing: {
    dyeOk: ['Dyeing ok', 'Dyeing Prod.', 'DyeingProd'],
    dyeBal: ['Dyeing Bal.', 'Dyeing Bala.', 'DyeingBala'],
  },
  delivery: {
    bookingQty: ['RequiredQtyKgs', 'Required Qty Kgs', 'Booking qty'],
    receivedQty: ['NetReceivedQtyKgs', 'Net Received Qty', 'Received Qty'],
    deliveredQty: ['NetDeliveryQtyKgs', 'Net Delivery Qty', 'Delivered Qty'],
    deliBal: ['Deli. Bal.', 'Deli. Bala.', 'DeliBal'],
    rfd: ['RFD'],
    slowMoving: ['Slowmoving', 'Slow Moving'],
  },
};

/** Column mapping of the Excel export (old exportPPIToExcel; Dyeing ok also falls back to BP Qty). */
const EXCEL_COLOR_FIELDS: PPIColorFieldMap = {
  allowance: ALLOWANCE_FIELDS,
  knitting: {
    allocQty: ['Allocated Qty', 'Allocated Qty ', 'AllocatedQty'],
    yarnBal: ['Yarn bala.', 'Yarn Bala', 'YarnBala'],
    knitProd: ['Knit Prod.', 'KnitProd'],
    knitBal: ['Knit. Bala.', 'KnitBala'],
  },
  dyeing: {
    dyeOk: ['Dyeing ok', 'Dyeing Prod.', 'DyeingProd', 'BP Qty', 'BPQty'],
    dyeBal: ['Dyeing Bal.', 'Dyeing Bala.', 'DyeingBala'],
  },
  delivery: {
    bookingQty: ['RequiredQtyKgs', 'Booking qty'],
    receivedQty: ['NetReceivedQtyKgs', 'Received Qty'],
    deliveredQty: ['NetDeliveryQtyKgs', 'Delivered Qty'],
    deliBal: ['Deli. Bal.', 'Deli. Bala.'],
    rfd: ['RFD'],
    slowMoving: ['Slowmoving'],
  },
};

export interface PPIColorSummary {
  colors: { key: string; label: string }[];
  colorAggs: Record<string, PPIColorAgg>;
  metrics: PPIMetric[];
}

const emptyAgg = (): PPIColorAgg => ({
  allowances: [],
  allocQty: 0,
  yarnBal: 0,
  knitProd: 0,
  knitBal: 0,
  dyeOk: 0,
  dyeBal: 0,
  bookingQty: 0,
  receivedQty: 0,
  deliveredQty: 0,
  deliBal: 0,
  rfd: 0,
  slowMoving: 0,
});

function buildColorSummary(order: PPIOrder, fields: PPIColorFieldMap): PPIColorSummary {
  const kItems = order.knittingItems || [];
  const dItems = order.dyeingItems || [];
  const delItems = order.deliveryItems || [];

  const getColorName = (item: PPIRecord) => ppiGetString(item, COLOR_FIELDS);
  const colorKey = (name: string) => name.toLowerCase().replace(/\s+/g, ' ');

  const colorMap = new Map<string, string>();
  [kItems, dItems, delItems].forEach((items) => {
    items.forEach((item) => {
      const col = getColorName(item);
      if (!col) return;
      const key = colorKey(col);
      if (!colorMap.has(key)) colorMap.set(key, col);
    });
  });

  const colors = Array.from(colorMap.entries()).map(([key, label], idx) => ({ key, label: label || `Col-${idx + 1}` }));
  const colorAggs: Record<string, PPIColorAgg> = {};
  colors.forEach((col) => {
    colorAggs[col.key] = emptyAgg();
  });

  const accumulate = (
    items: PPIRecord[],
    sums: Partial<Record<PPISummedField, string[]>>,
    withAllowance: boolean
  ) => {
    items.forEach((item) => {
      const colName = getColorName(item);
      if (!colName) return;
      const agg = colorAggs[colorKey(colName)];
      if (!agg) return;
      if (withAllowance) {
        const allow = ppiGetNum(item, fields.allowance);
        if (allow > 0) agg.allowances.push(allow > 1 ? allow / 100 : allow);
      }
      (Object.keys(sums) as PPISummedField[]).forEach((field) => {
        agg[field] += ppiGetNum(item, sums[field] || []);
      });
    });
  };

  accumulate(kItems, fields.knitting, true);
  accumulate(dItems, fields.dyeing, false);
  accumulate(delItems, fields.delivery, false);

  return { colors, colorAggs, metrics: PPI_METRICS };
}

/** Colour-wise summary as shown on the report screen. */
export function computePPIColorSummary(order: PPIOrder): PPIColorSummary {
  return buildColorSummary(order, SCREEN_COLOR_FIELDS);
}

/** Total of one metric over all colours (Allowance % is the mean of the colours that have one). */
export function ppiMetricTotal(metric: PPIMetric, summary: PPIColorSummary): number {
  const vals = summary.colors.map((col) => metric.getValue(summary.colorAggs[col.key]));
  const sum = vals.reduce((a, b) => a + b, 0);
  if (!metric.isAvg) return sum;
  const count = vals.filter((v) => v > 0).length;
  return count ? sum / count : 0;
}

export function formatPPIPercent(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

// ==========================================
// Excel export sheet (old exportPPIToExcel layout)
// ==========================================
export interface PPIExcelSheet {
  rows: (string | number)[][];
  cols: { wch: number }[];
}

export function buildPPIExcelSheet(order: PPIOrder, planData: PPIPlanData | null | undefined): PPIExcelSheet {
  const o = order;
  const kItems = o.knittingItems || [];
  const dItems = o.dyeingItems || [];
  const delItems = o.deliveryItems || [];
  const firstItem = kItems[0] || dItems[0] || delItems[0] || {};

  const bodyFabric = firstTruthy(
    o.bodyFabric,
    o['Body Fabric'],
    ppiGetString(firstItem, ['FabricConstruction', 'Fabric Construction', 'BodyFabric', 'Body Fabric', 'Fabric'])
  );
  const bodyGsm = firstTruthy(o.bodyGsm, o['Body GSM'], ppiGetString(firstItem, ['GSM', 'Gsm', 'Body GSM']));
  const programType = firstTruthy(
    o.programType,
    o['Program type'],
    ppiGetString(firstItem, ['Process Name', 'ProcessName', 'ProgramType', 'Program Type']),
    'SOLID'
  );
  const c = (...values: unknown[]) => toCell(firstTruthy(...values));

  const m = computeExcelMilestones(o, planData);
  const row = (label: string, vals: Record<PPIMilestoneKey, string>) => [label, ...PPI_MILESTONE_KEYS.map((k) => vals[k])];

  const rows: (string | number)[][] = [
    ['Booking Specification'],
    ['Booking No.', c(o.orderNo, ''), '', 'Buyer Name', c(o.buyer, ''), '', 'Buyer Team', c(o.buyerTeam, '')],
    [
      'Booking Date',
      formatPPIDate(o.bookingDate),
      '',
      'Event Day',
      c(o.eventDay, ''),
      '',
      'Style',
      c(o.style, o['Style'], o.finalConfirmation, ''),
    ],
    ['PMC', c(o.pmc, ''), '', 'Merchant', c(o.bookingBy, o.bookedBy, ''), '', 'Unit', c(o.floor, o.unit, 'EFL')],
    [
      'Gmt Unit',
      c(o.gmtUnit, ''),
      '',
      'Program type',
      toCell(programType),
      '',
      'Order Qty (KG)',
      o.requiredQtyKgs ? `${Number(o.requiredQtyKgs).toLocaleString()} KG` : '',
    ],
    ['Batch Plan', c(o.bpStatus, 'Pending'), '', 'Body Fabric', toCell(bodyFabric), '', 'Body GSM', toCell(bodyGsm)],
    [
      'Brush',
      c(o.brush, o['Brush'], 'NO'),
      '',
      'Peach',
      c(o.peach, o['Peach'], 'NO'),
      '',
      'Heatset',
      c(o.heatset, o['Heatset'], 'NO'),
    ],
    [
      'ALD',
      c(o.ald, o['ALD'], o.eventDay ? `${toText(o.eventDay)} ok out of ${toText(o.eventDay)}` : ''),
      '',
      'PMC Notes',
      c(o.pmcNotes, o['PMC Notes'], o.fabricNotes, ''),
      '',
      'Fabric Notes',
      c(o.fabricNotes, ''),
    ],
    [],
    ['Booking Planning'],
    ['Timeline Phase', 'Yarn Date', 'Knit Start', 'Knit End', 'Dye Start', 'Dye End', 'Deli Start (Floor)', 'Deli End (Floor)'],
    row('Planned', m.planned),
    [
      'Plan Type',
      m.planTypes.yarn,
      m.planTypes.knit,
      m.planTypes.knit,
      m.planTypes.dye,
      m.planTypes.dye,
      m.planTypes.deli,
      m.planTypes.deli,
    ],
    row('Actual', m.actual),
    row('Lead Day', m.leadDays),
    ['OTT Result', ...PPI_MILESTONE_KEYS.map((k) => m.ott[k].text)],
    ['Reason & Dept', m.reasons.yarn, m.reasons.knit, '', m.reasons.dye, '', m.reasons.deli, ''],
  ];

  // Section 3 Color Summary
  const summary = buildColorSummary(o, EXCEL_COLOR_FIELDS);
  const { colors, colorAggs, metrics } = summary;
  rows.push([]);
  rows.push(['Details Booking Summary (Color-Wise)']);
  rows.push(['Color', ...metrics.map((mt) => mt.label)]);

  const excelValue = (mt: PPIMetric, v: number) => (mt.isPercent ? formatPPIPercent(v) : Math.round(v));
  colors.forEach((col) => {
    const agg = colorAggs[col.key];
    rows.push([col.label, ...metrics.map((mt) => excelValue(mt, mt.getValue(agg)))]);
  });
  rows.push(['Total', ...metrics.map((mt) => excelValue(mt, ppiMetricTotal(mt, summary)))]);

  return { rows, cols: [{ wch: 18 }, ...metrics.map(() => ({ wch: 14 }))] };
}
