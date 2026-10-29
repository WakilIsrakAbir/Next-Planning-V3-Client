// ==========================================================
// Load Calculation data pipeline
// Port of the legacy app's js/load-calculation.js (resolveItemPlanDates,
// buildLoadRowFromItem, processOrdersForLoadDepartment) so the load numbers
// and the Detailed Load Excel match the legacy app for the same data.
// ==========================================================

export type LoadRecord = Record<string, unknown>;

/** A saved plan item from OrderDate[dept] (planMap). */
export interface SavedPlanItem extends LoadRecord {
  itemId?: string;
  itemData?: LoadRecord;
  planType?: string;
  startDate?: string;
  endDate?: string;
  floorPlanType?: string;
  floorStartDate?: string;
  floorEndDate?: string;
}

/** An order from GET /api/orders/report/:dept (Excel items live in `${dept}Items`). */
export interface LoadReportOrder extends LoadRecord {
  orderNo: string;
  buyer?: string;
}

export type LoadPlanMap = Record<string, Record<string, unknown> | null | undefined>;

export interface LoadReportResponse {
  orders?: LoadReportOrder[];
  planMap?: LoadPlanMap;
  total?: number;
}

export interface LoadPlanDates {
  planStart: unknown;
  planEnd: unknown;
  planType: string;
}

export type LoadRow = LoadRecord & LoadPlanDates;

export function loadNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/,/g, '').replace(/\s*Kg$/i, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

// ----------------------------------------------------------
// Legacy column lookup (js/utils.js getColData).
// Deliberately NOT the shared `getColData` from data-utils: the legacy version
// returns the first candidate whose column exists even when its value is empty,
// never looks into a nested itemData, and caches each row's key map on first
// use (columns added to a row afterwards are not seen). The load rows depend
// on all three behaviours, so they are kept here to produce identical numbers.
// ----------------------------------------------------------
const legacyNormCache = new Map<string, string>();

function legacyNorm(key: string): string {
  const cached = legacyNormCache.get(key);
  if (cached !== undefined) return cached;
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  legacyNormCache.set(key, normalized);
  return normalized;
}

const legacyRowMapCache = new WeakMap<object, Record<string, string>>();

function legacyRowMap(row: LoadRecord): Record<string, string> {
  const cached = legacyRowMapCache.get(row);
  if (cached) return cached;
  const map: Record<string, string> = {};
  for (const rk in row) {
    map[legacyNorm(rk)] = rk;
  }
  legacyRowMapCache.set(row, map);
  return map;
}

function colData(row: LoadRecord, keys: string[]): unknown {
  const map = legacyRowMap(row);
  for (const k of keys) {
    const actual = map[legacyNorm(k)];
    if (actual !== undefined) {
      const val = row[actual];
      return val === undefined || val === null ? '' : val;
    }
  }
  return '';
}

// Legacy formatExcelDate() for numeric Excel serials -> "DD-Mon-YYYY".
const LEGACY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatExcelSerialDate(serial: number): unknown {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  // Legacy formatDateDisplay hands back its (invalid) input unchanged.
  if (Number.isNaN(d.getTime())) return d;
  return `${String(d.getDate()).padStart(2, '0')}-${LEGACY_MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function serialToDisplay(value: unknown): unknown {
  return typeof value === 'number' ? formatExcelSerialDate(value) : value;
}

// Legacy generateItemId (js/data-processing.js).
function legacyGenerateItemId(itemData: LoadRecord, tabId: string): string {
  const currentDept = tabId.replace('_report', '');
  const pick = (value: unknown, fallback: unknown) => (value !== undefined && value !== null ? value : fallback);
  const bNo = String(pick(itemData.OrderNo, 'N/A')).trim();
  const color = String(pick(itemData.Color, 'N/A')).trim();

  if (currentDept === 'knitting' || currentDept === 'delivery') {
    const fabConst = String(pick(itemData.FabricConstruction, 'N/A')).trim();
    const gsm = String(pick(itemData.GSM, 'N/A')).trim();
    return `${bNo}_${color}_${fabConst}_${gsm}`.toLowerCase().replace(/\s+/g, '');
  }
  if (currentDept === 'yd') {
    const type = String(pick(itemData['Booking Type'], 'N/A')).trim();
    const ydb = String(pick(itemData.YDB, 'N/A')).trim();
    return `${bNo}_${type}_${ydb}`.toLowerCase().replace(/\s+/g, '');
  }
  let procName = String(pick(itemData.ProcessName, pick(itemData['Process Name'], ''))).trim();
  if (procName.toLowerCase() === 'n/a' || procName === '-') procName = '';
  return `${bNo}_${color}_${procName}`.toLowerCase().replace(/\s+/g, '');
}

const isPlanned = (type: unknown) => type === 'Confirm' || type === 'Tentative';

const YD_TNA_START_KEYS = ['YD T&A Start', 'T&A Start', 'YD T&A Start Date', 'YD TNA Start', 'TNA Start', 'Start Date'];
const YD_TNA_END_KEYS = ['YD T&A End', 'T&A End', 'YD T&A End Date', 'YD TNA End', 'TNA End', 'End Date'];
const DELI_TNA_START_KEYS = ['TADeliStart', 'T&A Deli. Start', 'DeliStart'];
const DELI_TNA_END_KEYS = ['TADeliEnd', 'T&A Deli. End', 'DeliEnd'];

function deliveryTnADates(itemData: LoadRecord, order: LoadReportOrder): LoadPlanDates | null {
  const start = serialToDisplay(colData(itemData, DELI_TNA_START_KEYS) || order.deliStart || '');
  const end = serialToDisplay(colData(itemData, DELI_TNA_END_KEYS) || order.deliEnd || '');
  return start && end ? { planStart: start, planEnd: end, planType: 'T&A' } : null;
}

/**
 * Resolve plan start, end and planType for one item using the department
 * fallback rules: saved Confirm/Tentative dates first, then T&A / Floor dates.
 */
export function resolveItemPlanDates(
  dept: string,
  savedItem: SavedPlanItem | null | undefined,
  itemData: LoadRecord,
  order: LoadReportOrder
): LoadPlanDates {
  const empty: LoadPlanDates = { planStart: '', planEnd: '', planType: '' };

  if (dept === 'yd') {
    // Priority 1: Tentative & Confirm YD dates from the plan list
    const sType = savedItem?.planType || itemData?.planType;
    const sStart = savedItem?.startDate || itemData?.startDate;
    const sEnd = savedItem?.endDate || itemData?.endDate;
    if (isPlanned(sType) && sStart && sEnd) {
      return { planStart: sStart, planEnd: sEnd, planType: sType as string };
    }
    // Priority 2: YD T&A Start / End (Pending list), then the order's yarn date
    const ydTnAStart = serialToDisplay(
      colData(itemData, YD_TNA_START_KEYS) ||
        (savedItem?.itemData ? colData(savedItem.itemData, YD_TNA_START_KEYS) : '') ||
        order.ydStart ||
        ''
    );
    const ydTnAEnd = serialToDisplay(
      colData(itemData, YD_TNA_END_KEYS) ||
        (savedItem?.itemData ? colData(savedItem.itemData, YD_TNA_END_KEYS) : '') ||
        order.ydEnd ||
        ''
    );
    if (ydTnAStart && ydTnAEnd) return { planStart: ydTnAStart, planEnd: ydTnAEnd, planType: 'T&A' };
    if (order.yarnDate) return { planStart: order.yarnDate, planEnd: order.yarnDate, planType: 'T&A' };
    return empty;
  }

  if (dept === 'knitting' || dept === 'dyeing') {
    // Priority 1: Tentative & Confirm dates from the plan list
    if (savedItem && isPlanned(savedItem.planType) && savedItem.startDate && savedItem.endDate) {
      return { planStart: savedItem.startDate, planEnd: savedItem.endDate, planType: savedItem.planType as string };
    }
    // Priority 2: T&A Start / End from Order management
    const isKnit = dept === 'knitting';
    const start = serialToDisplay(
      colData(itemData, isKnit ? ['TAKnittingStart', 'T&A Knitting Start', 'KnitStart'] : ['TADyeingStart', 'T&A Dyeing Start', 'DyeStart']) ||
        (isKnit ? order.knitStart : order.dyeStart) ||
        ''
    );
    const end = serialToDisplay(
      colData(itemData, isKnit ? ['TAKnittingEnd', 'T&A Knitting End', 'KnitEnd'] : ['TADyeingEnd', 'T&A Dyeing End', 'DyeEnd']) ||
        (isKnit ? order.knitEnd : order.dyeEnd) ||
        ''
    );
    return start && end ? { planStart: start, planEnd: end, planType: 'T&A' } : empty;
  }

  if (dept === 'delivery') {
    // Priority 1: Tentative & Confirm Delivery dates from the plan list
    if (savedItem && isPlanned(savedItem.planType) && savedItem.startDate && savedItem.endDate) {
      return { planStart: savedItem.startDate, planEnd: savedItem.endDate, planType: savedItem.planType as string };
    }
    // Priority 2: Delivery Planning (Floor) Start / End
    const floorStart = serialToDisplay(
      savedItem?.floorStartDate || colData(itemData, ['floorStartDate', 'Delivery Plan Start (Floor)', 'Floor Start']) || ''
    );
    const floorEnd = serialToDisplay(
      savedItem?.floorEndDate || colData(itemData, ['floorEndDate', 'Delivery Plan End (Floor)', 'Floor End']) || ''
    );
    if (floorStart && floorEnd) {
      return {
        planStart: floorStart,
        planEnd: floorEnd,
        planType: savedItem && isPlanned(savedItem.floorPlanType) ? (savedItem.floorPlanType as string) : 'Floor',
      };
    }
    // Priority 3: T&A Deli. Start / End
    return deliveryTnADates(itemData, order) || empty;
  }

  if (dept === 'deliveryfloor') {
    // Priority 1: Tentative & Confirm Delivery Planning (Floor) dates
    if (savedItem && isPlanned(savedItem.floorPlanType) && savedItem.floorStartDate && savedItem.floorEndDate) {
      return { planStart: savedItem.floorStartDate, planEnd: savedItem.floorEndDate, planType: savedItem.floorPlanType as string };
    }
    // Priority 2: T&A Deli. Start / End
    return deliveryTnADates(itemData, order) || empty;
  }

  return empty;
}

const isBlank = (value: unknown) => value === '' || value === null || value === undefined;

/** Normalize one item into a load row (column mappings + pending balance fallbacks). */
export function buildLoadRowFromItem(order: LoadReportOrder, itemData: LoadRecord, planDates: LoadPlanDates): LoadRow {
  const row: LoadRecord = {};
  row.OrderNo = order.orderNo;
  row.Buyer = colData(itemData, ['Buyer', 'BuyerName', 'Customer']) || order.buyer || '';
  row.Color = colData(itemData, ['Color', 'Colour', 'Fab Color']);
  row.FabricConstruction = colData(itemData, ['FabricConstruction', 'Construction', 'Fab Const', 'Fabric']);
  row.GSM = colData(itemData, ['GSM', 'G.S.M']);
  row.RequiredQtyKgs = colData(itemData, ['RequiredQtyKgs', 'Req Qty', 'Qty', 'Order Qty']);
  row.Allowance = colData(itemData, ['Allowance %', 'Allowance', 'Wastage %', 'Wastage', 'Allow %', 'Allow']);
  row.YarnReq = colData(itemData, ['Yarn req.', 'YarnReq', 'Yarn Req', 'Yarn Req.']);
  row.AllocatedQty = colData(itemData, ['Allocated Qty', 'Allocated Qty ', 'AllocatedQty', 'Alloc Qty']);
  row.YarnBala = colData(itemData, ['Yarn bala.', 'YarnBala', 'Yarn Bala', 'Yarn Balance']);
  row.GreyReq = colData(itemData, ['Grey Req.', 'GreyReq', 'Grey Req']);
  row.KnitProd = colData(itemData, ['Knit Prod.', 'KnitProd', 'Knit Prod', 'Knit Production']);
  row.KnitBala = colData(itemData, ['Knit. Bala.', 'KnitBala', 'Knit Bala.', 'Knit Bala', 'Knit. Bal.']);
  row.BPQty = colData(itemData, ['BP Qty', 'BPQty', 'BP_Qty']);
  row.DyeingProd = colData(itemData, ['Dyeing Prod.', 'DyeingProd', 'Dyeing Prod', 'Dyeing ok', 'Dyeing Production']);
  row.DyeingBala = colData(itemData, ['Dyeing Bala.', 'DyeingBala', 'Dyeing Bala', 'Dyeing Bal.']);
  row.NetReceivedQtyKgs = colData(itemData, ['NetReceivedQtyKgs', 'NetReceivedQty', 'ReceivedQty']);
  row.NetDeliveryQtyKgs = colData(itemData, ['NetDeliveryQtyKgs', 'NetDeliveryQty', 'DeliveryQty']);
  row.DeliBal = colData(itemData, ['Deli. Bal.', 'Deli Bal.', 'DeliBal', 'Delivery Balance', 'Deli. Bala.']);
  row.RFD = colData(itemData, ['RFD']);
  row.Slowmoving = colData(itemData, ['Slowmoving', 'Slow Moving']);
  row.FFStock = colData(itemData, ['FF Stock', 'FFStock', 'FF_Stock']);
  row.Unit = colData(itemData, ['Unit']);
  row.ProcessName = colData(itemData, ['Process Name', 'ProcessName', 'Process']);

  // YD fields
  row['Booking Type'] = colData(itemData, ['Booking Type', 'Type', 'YD Type']);
  row.YDB = colData(itemData, ['YDB', 'YD B']);
  row['YD REQ.'] = colData(itemData, ['YD REQ.', 'YD REQ', 'Requirement']);
  row.DYED = colData(itemData, ['DYED', 'Dyed']);
  row['YD BALANCE'] = colData(itemData, ['YD BALANCE', 'YD Balance']);
  row['YD Delivered'] = colData(itemData, ['YD Delivered', 'Delivered']);
  row['YD DELIVERY BALANCE'] = colData(itemData, [
    'YD DELIVERY BALANCE',
    'YD Delivery Balance',
    'YD Balance_1',
    'YD Balance 2',
    'YD Balance',
    'YD BALANCE',
  ]);

  // Fallbacks for pending balance quantities if not populated directly
  if (isBlank(row.DeliBal)) {
    const req = loadNumber(row.RequiredQtyKgs);
    const del = loadNumber(row.NetDeliveryQtyKgs);
    if (req > 0 && del > 0) row.DeliBal = Math.max(0, req - del);
    else if (req > 0) row.DeliBal = req;
  }
  if (isBlank(row.KnitBala)) {
    const req = loadNumber(row.GreyReq);
    const prod = loadNumber(row.KnitProd);
    if (req > 0 && prod > 0) row.KnitBala = Math.max(0, req - prod);
    else if (req > 0) row.KnitBala = req;
  }
  if (isBlank(row.DyeingBala)) {
    const req = loadNumber(row.RequiredQtyKgs) || loadNumber(row.BPQty);
    const prod = loadNumber(row.DyeingProd);
    if (req > 0 && prod > 0) row.DyeingBala = Math.max(0, req - prod);
    else if (req > 0) row.DyeingBala = req;
  }
  if (isBlank(row['YD DELIVERY BALANCE'])) {
    const req = loadNumber(row['YD REQ.']);
    const del = loadNumber(row['YD Delivered']);
    if (req > 0 && del > 0) row['YD DELIVERY BALANCE'] = Math.max(0, req - del);
    else if (req > 0) row['YD DELIVERY BALANCE'] = req;
    else if (!isBlank(row['YD BALANCE'])) row['YD DELIVERY BALANCE'] = row['YD BALANCE'];
  }

  return { ...row, planStart: planDates.planStart, planEnd: planDates.planEnd, planType: planDates.planType };
}

const lowerTrim = (value: unknown) => String(value || '').trim().toLowerCase();
const itemColor = (item: LoadRecord) => lowerTrim(item.Color || item.Colour || item['Fab Color']);

/**
 * Build load rows for a department from the report payload. Excel items drive
 * the rows (fresh production data) and are matched to saved plan items for the
 * plan dates; orders without Excel items fall back to their saved plan items.
 * `deliveryfloor` reads the delivery data with Floor date rules.
 */
export function processOrdersForLoadDepartment(
  orders: LoadReportOrder[] | null | undefined,
  planMap: LoadPlanMap | null | undefined,
  dept: string
): LoadRow[] {
  const results: LoadRow[] = [];
  const actualDept = dept === 'deliveryfloor' ? 'delivery' : dept;
  const itemsField = `${actualDept}Items`;

  (orders || []).forEach((order) => {
    const planData = planMap && planMap[order.orderNo] ? planMap[order.orderNo] : null;
    const savedItems: SavedPlanItem[] =
      planData && Array.isArray(planData[actualDept]) ? (planData[actualDept] as SavedPlanItem[]) : [];
    const excelItems: LoadRecord[] = Array.isArray(order[itemsField]) ? (order[itemsField] as LoadRecord[]) : [];
    const knittingItems: LoadRecord[] = Array.isArray(order.knittingItems) ? (order.knittingItems as LoadRecord[]) : [];

    // Excel rows when present (merged with their saved plan item), otherwise the saved plan items
    const baseItems: LoadRecord[] = excelItems.length > 0 ? excelItems : savedItems;

    baseItems.forEach((baseItem) => {
      const itemData: LoadRecord = baseItem.itemData ? { ...(baseItem.itemData as LoadRecord) } : { ...baseItem };
      let savedItem: SavedPlanItem | null | undefined = null;

      if (excelItems.length > 0) {
        const myOrderNo = String(itemData.OrderNo || order.orderNo || '').trim();
        const myColor = itemColor(itemData);
        const myConst = lowerTrim(itemData.FabricConstruction || itemData.Construction || itemData.Fabric);
        const myGsm = lowerTrim(itemData.GSM || itemData['G.S.M']);
        const myType = String(colData(itemData, ['Booking Type', 'Type', 'YD Type']) || '').trim();
        const myYdb = String(colData(itemData, ['YDB', 'YD B']) || '').trim();
        const myProcess = String(colData(itemData, ['Process Name', 'ProcessName', 'Process']) || '').trim();

        const exId = legacyGenerateItemId(
          {
            OrderNo: myOrderNo,
            Color: myColor,
            FabricConstruction: myConst,
            GSM: myGsm,
            'Booking Type': myType,
            YDB: myYdb,
            ProcessName: myProcess,
          },
          actualDept
        );

        if (actualDept === 'yd') {
          const normType = myType.toLowerCase();
          const normYdb = myYdb.toLowerCase();
          const savedYdb = (s: SavedPlanItem) => lowerTrim(s.itemData?.YDB || s.itemData?.['YD B']);
          savedItem =
            savedItems.find((s) => s.itemId === exId) ||
            savedItems.find((s) => {
              const sType = lowerTrim(s.itemData?.['Booking Type'] || s.itemData?.Type || s.itemData?.['YD Type']);
              return normType && normYdb && sType === normType && savedYdb(s) === normYdb;
            }) ||
            savedItems.find((s) => normYdb && savedYdb(s) === normYdb) ||
            (savedItems.length === 1 ? savedItems[0] : null);
        } else {
          const savedColor = (s: SavedPlanItem) => lowerTrim(s.itemData?.Color || s.itemData?.Colour);
          savedItem =
            savedItems.find((s) => s.itemId === exId) ||
            savedItems.find((s) => {
              const sColor = savedColor(s);
              const sConst = lowerTrim(s.itemData?.FabricConstruction || s.itemData?.Construction);
              const sGsm = lowerTrim(s.itemData?.GSM);
              return sColor && sColor === myColor && (!myConst || sConst === myConst) && (!myGsm || sGsm === myGsm);
            }) ||
            savedItems.find((s) => {
              const sColor = savedColor(s);
              return sColor && sColor === myColor;
            });
        }

        // Only merge user planning inputs from the saved item; never overwrite fresh Excel production data
        const saved = savedItem?.itemData;
        if (saved) {
          if (saved.Unit) itemData.Unit = saved.Unit;
          if (saved.ProcessName) itemData.ProcessName = saved.ProcessName;
          if (saved['Process Name']) itemData['Process Name'] = saved['Process Name'];
          if (saved['Barrier Qty.']) itemData['Barrier Qty.'] = saved['Barrier Qty.'];
          if (saved['Workable Qty.']) itemData['Workable Qty.'] = saved['Workable Qty.'];
        }

        // Cross-department sync: dyeing missing Grey Req. / Knit Prod. / Knit. Bala. -> sum matching knitting items
        if (actualDept === 'dyeing' && knittingItems.length > 0) {
          const knitMatches = knittingItems.filter((k) => itemColor(k) === myColor);
          if (knitMatches.length > 0) {
            const syncSum = (keys: string[], targetKey: string) => {
              const existing = colData(itemData, keys);
              if (!existing || existing === '') {
                const sum = knitMatches.reduce((acc: number, k) => acc + loadNumber(colData(k, keys)), 0);
                if (sum > 0) itemData[targetKey] = sum;
              }
            };
            syncSum(['Grey Req.', 'GreyReq', 'Grey Req'], 'Grey Req.');
            syncSum(['Knit Prod.', 'KnitProd', 'Knit Prod'], 'Knit Prod.');
            syncSum(['Knit. Bala.', 'KnitBala', 'Knit Bala'], 'Knit. Bala.');
          }
        }

        // Cross-department sync: delivery missing knitting tracking fields -> matching knitting item
        if (actualDept === 'delivery' && knittingItems.length > 0) {
          const knitMatch =
            knittingItems.find((k) => {
              const kConst = lowerTrim(k.FabricConstruction || k.Construction || k.Fabric);
              const kGsm = lowerTrim(k.GSM || k['G.S.M']);
              return itemColor(k) === myColor && (!myConst || kConst === myConst) && (!myGsm || kGsm === myGsm);
            }) || knittingItems.find((k) => itemColor(k) === myColor);
          if (knitMatch) {
            if (!colData(itemData, ['Grey Req.', 'GreyReq'])) itemData['Grey Req.'] = colData(knitMatch, ['Grey Req.', 'GreyReq']);
            if (!colData(itemData, ['Knit Prod.', 'KnitProd'])) itemData['Knit Prod.'] = colData(knitMatch, ['Knit Prod.', 'KnitProd']);
            if (!colData(itemData, ['Knit. Bala.', 'KnitBala'])) itemData['Knit. Bala.'] = colData(knitMatch, ['Knit. Bala.', 'KnitBala']);
            if (!colData(itemData, ['Allowance %', 'Allowance']))
              itemData['Allowance %'] = colData(knitMatch, ['Allowance %', 'Allowance', 'Wastage %']);
            if (!colData(itemData, ['Yarn req.', 'YarnReq'])) itemData['Yarn req.'] = colData(knitMatch, ['Yarn req.', 'YarnReq']);
            if (!colData(itemData, ['Allocated Qty', 'AllocatedQty']))
              itemData['Allocated Qty'] = colData(knitMatch, ['Allocated Qty', 'AllocatedQty']);
            if (!colData(itemData, ['Yarn bala.', 'YarnBala'])) itemData['Yarn bala.'] = colData(knitMatch, ['Yarn bala.', 'YarnBala']);
          }
        }
      } else {
        savedItem = baseItem as SavedPlanItem;
      }

      const planDates = resolveItemPlanDates(dept, savedItem, itemData, order);
      results.push(buildLoadRowFromItem(order, itemData, planDates));
    });
  });

  return results;
}
