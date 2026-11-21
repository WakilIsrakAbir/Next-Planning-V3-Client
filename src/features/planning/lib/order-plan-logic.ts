import { getColData } from '@/lib/data-utils';

// Excel rows, saved plan items and order documents are free-form JSON shared with the old vanilla-JS app.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

// Admin / Approver role from localStorage (`user.role`, else `role` / `userRole`), read without a setState-in-effect.
const subscribeToNothing = () => () => {};
function readIsAdminRole(): boolean {
  let role = '';
  try {
    const stored = localStorage.getItem('user');
    if (stored) {
      const u = JSON.parse(stored);
      role = u.role || '';
    }
  } catch {}
  if (!role) {
    role = localStorage.getItem('role') || localStorage.getItem('userRole') || '';
  }
  const r = String(role).toLowerCase();
  return r === 'admin' || r === 'approver';
}

function formatDateDisplay(d: Loose): string {
  if (!d || d === '-' || d === 'N/A') return '—';
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return String(d);
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = parsed.toLocaleString('en-US', { month: 'short' });
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return String(d);
  }
}

function formatExcelDate(val: Loose): string {
  if (!val || val === 'N/A' || val === '-' || val === '') return '—';
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return formatDateDisplay(d);
  }
  if (typeof val === 'string') {
    const num = Number(val);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000));
      return formatDateDisplay(d);
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return formatDateDisplay(val);
    return val;
  }
  return String(val);
}

function generateItemId(itemData: Loose, tabId: string): string {
  if (!itemData) return Date.now().toString();
  const currentDept = tabId.replace('_report', '').toLowerCase();
  const bNo = String(itemData.OrderNo !== undefined && itemData.OrderNo !== null ? itemData.OrderNo : 'N/A').trim();
  const color = String(itemData.Color !== undefined && itemData.Color !== null ? itemData.Color : 'N/A').trim();

  if (currentDept === 'knitting' || currentDept === 'delivery') {
    const fabConst = String(
      itemData.FabricConstruction !== undefined && itemData.FabricConstruction !== null
        ? itemData.FabricConstruction
        : 'N/A'
    ).trim();
    const gsm = String(itemData.GSM !== undefined && itemData.GSM !== null ? itemData.GSM : 'N/A').trim();
    return `${bNo}_${color}_${fabConst}_${gsm}`.toLowerCase().replace(/\s+/g, '');
  } else if (currentDept === 'yd') {
    const type = String(
      itemData['Booking Type'] !== undefined && itemData['Booking Type'] !== null
        ? itemData['Booking Type']
        : 'N/A'
    ).trim();
    const ydb = String(itemData.YDB !== undefined && itemData.YDB !== null ? itemData.YDB : 'N/A').trim();
    return `${bNo}_${type}_${ydb}`.toLowerCase().replace(/\s+/g, '');
  } else {
    // data-processing.js (HEAD): ProcessName, else "Process Name", else ""; "n/a" and "-" count as empty.
    let procName = String(
      itemData.ProcessName !== undefined && itemData.ProcessName !== null
        ? itemData.ProcessName
        : itemData['Process Name'] !== undefined && itemData['Process Name'] !== null
          ? itemData['Process Name']
          : ''
    ).trim();
    if (procName.toLowerCase() === 'n/a' || procName === '-') procName = '';
    return `${bNo}_${color}_${procName}`.toLowerCase().replace(/\s+/g, '');
  }
}

// Old setup.js buildDynamicOptions: a saved value missing from the master list is still offered (first).
function withCurrentOption(options: string[], current: Loose): string[] {
  const val = current !== undefined && current !== null ? String(current) : '';
  if (val.trim() && !options.includes(val)) return [val, ...options];
  return options;
}

// detailed-view.js (HEAD): a delivery row reads the dyeing plan matched by colour, or by an itemId containing `_<colour>_`.
function matchesDyeColor(d: Loose, myColor: string): boolean {
  if (!d) return false;
  const c = String((d.itemData && d.itemData.Color) || d.Color || '').trim().toLowerCase();
  if (c === myColor) return true;
  if (d.itemId && String(d.itemId).toLowerCase().includes(`_${myColor}_`)) return true;
  return false;
}

function buildMergedItems(currentOrder: Loose, currentPlan: Loose, dept: string): Loose[] {
  if (!currentOrder) return [];
  const excelItems = currentOrder[`${dept}Items`] || [];
  const savedItems = (currentPlan && currentPlan[dept]) || [];
  const planMap = new Map<string, Loose>();
  savedItems.forEach((it: Loose) => {
    if (it.itemId) planMap.set(it.itemId, it);
  });

  const merged = excelItems.map((exItem: Loose, idx: number) => {
    let itemData: Record<string, Loose> = {};

    if (dept === 'knitting' || dept === 'delivery') {
      itemData = {
        OrderNo: getColData(exItem, ['BookingNo', 'OrderNo', 'EWO', 'Booking', 'Order No', 'Booking No']) || currentOrder.orderNo,
        Color: getColData(exItem, ['Color', 'Colour', 'Fab Color']),
        FabricConstruction: getColData(exItem, ['FabricConstruction', 'Construction', 'Fab Const', 'Fabric']),
        GSM: getColData(exItem, ['GSM', 'G.S.M']),
        RequiredQtyKgs: getColData(exItem, ['RequiredQtyKgs', 'Req Qty', 'Qty']),
        Buyer: getColData(exItem, ['Buyer', 'BuyerName', 'Customer']) || currentOrder.buyer,
        Allowance: getColData(exItem, ['Allowance %', 'Allowance', 'Wastage %', 'Wastage', 'Allow %', 'Allow']),
        YarnReq: getColData(exItem, ['Yarn req.', 'YarnReq', 'Yarn Req', 'Yarn Req.']),
        AllocatedQty: getColData(exItem, ['Allocated Qty', 'Allocated Qty ', 'AllocatedQty', 'Alloc Qty']),
        YarnBala: getColData(exItem, ['Yarn bala.', 'YarnBala', 'Yarn Bala', 'Yarn Balance']),
        GreyReq: getColData(exItem, ['Grey Req.', 'GreyReq', 'Grey Req']),
        KnitProd: getColData(exItem, ['Knit Prod.', 'KnitProd', 'Knit Prod', 'Knit Production']),
        KnitBala: getColData(exItem, ['Knit. Bala.', 'KnitBala', 'Knit Bala.', 'Knit Bala', 'Knit. Bal.']),
        NetReceivedQtyKgs: getColData(exItem, ['NetReceivedQtyKgs', 'NetReceivedQty', 'ReceivedQty']),
        NetDeliveryQtyKgs: getColData(exItem, ['NetDeliveryQtyKgs', 'NetDeliveryQty', 'DeliveryQty']),
        DeliBal: getColData(exItem, ['Deli. Bal.', 'Deli Bal.', 'DeliBal', 'Delivery Balance', 'Deli. Bala.']),
        RFD: getColData(exItem, ['RFD']),
        Slowmoving: getColData(exItem, ['Slowmoving', 'Slow Moving']),
        FFStock: getColData(exItem, ['FF Stock', 'FFStock', 'FF_Stock']),
      };
    } else if (dept === 'yd') {
      itemData = {
        OrderNo: getColData(exItem, ['BookingNo', 'OrderNo', 'EWO', 'Booking', 'Order No', 'Booking No']) || currentOrder.orderNo,
        'Booking Type': getColData(exItem, ['Booking Type', 'Type', 'YD Type', 'BookingType']),
        YDB: getColData(exItem, ['YDB', 'YD B', 'YDB#']),
        'YD Booking Date': getColData(exItem, ['YD Booking Date', 'Date', 'Booking Date', 'YDBookingDate']),
        'YD T&A Start': getColData(exItem, ['YD T&A Start', 'T&A Start', 'YD T&A Start Date', 'YD TNA Start', 'TNA Start', 'Start Date']),
        'YD T&A End': getColData(exItem, ['YD T&A End', 'T&A End', 'YD T&A End Date', 'YD TNA End', 'TNA End', 'End Date']),
        'YD REQ.': getColData(exItem, ['YD REQ.', 'YD REQ', 'YD Req', 'Requirement', 'YDReq']),
        DYED: getColData(exItem, ['DYED', 'Dyed', 'Dye']),
        'YD BALANCE': getColData(exItem, ['YD BALANCE', 'YD Balance', 'YDBalance']),
        'YD Delivered': getColData(exItem, ['YD Delivered', 'Delivered', 'Delivery', 'YDDelivered']),
        'YD DELIVERY BALANCE': getColData(exItem, ['YD DELIVERY BALANCE', 'YD Balance_1', 'YD Balance 2', 'YDDeliveryBalance']),
        'Barrier Qty.': getColData(exItem, ['Barrier Qty.', 'Barrier Qty', 'Barrier', 'BarrierQty']),
        'Workable Qty.': getColData(exItem, ['Workable Qty.', 'Workable Qty', 'Workable', 'WorkableQty']),
      };
    } else {
      // Dyeing / Finishing (same key set as old HEAD detailed-view.js, so saved itemData matches the old app)
      itemData = {
        OrderNo: getColData(exItem, ['BookingNo', 'OrderNo', 'EWO', 'Booking', 'Order No', 'Booking No']) || currentOrder.orderNo,
        Color: getColData(exItem, ['Color', 'Colour', 'Fab Color']),
        RequiredQtyKgs: getColData(exItem, ['RequiredQtyKgs', 'Req Qty', 'Qty', 'Order Qty']),
        Buyer: getColData(exItem, ['Buyer', 'BuyerName', 'Customer']) || currentOrder.buyer,
        Unit: getColData(exItem, ['Unit']),
        ProcessName: getColData(exItem, ['Process Name', 'ProcessName', 'Process']),
        Allowance: getColData(exItem, ['Allowance %', 'Allowance', 'Wastage %', 'Wastage', 'Allow %', 'Allow']),
        YarnReq: getColData(exItem, ['Yarn req.', 'YarnReq', 'Yarn Req', 'Yarn Req.']),
        AllocatedQty: getColData(exItem, ['Allocated Qty', 'Allocated Qty ', 'AllocatedQty', 'Alloc Qty']),
        YarnBala: getColData(exItem, ['Yarn bala.', 'YarnBala', 'Yarn Bala', 'Yarn Balance']),
        GreyReq: getColData(exItem, ['Grey Req.', 'GreyReq', 'Grey Req']),
        KnitProd: getColData(exItem, ['Knit Prod.', 'KnitProd', 'Knit Prod', 'Knit Production']),
        KnitBala: getColData(exItem, ['Knit. Bala.', 'KnitBala', 'Knit Bala.', 'Knit Bala', 'Knit. Bal.']),
        BPQty: getColData(exItem, ['BP Qty', 'BPQty', 'BP_Qty']),
        DyeingProd: getColData(exItem, ['Dyeing Prod.', 'DyeingProd', 'Dyeing Prod', 'Dyeing ok', 'Dyeing Production']),
        DyeingBala: getColData(exItem, ['Dyeing Bala.', 'DyeingBala', 'Dyeing Bala', 'Dyeing Bal.']),
        NetReceivedQtyKgs: getColData(exItem, ['NetReceivedQtyKgs', 'NetReceivedQty', 'ReceivedQty']),
        NetDeliveryQtyKgs: getColData(exItem, ['NetDeliveryQtyKgs', 'NetDeliveryQty', 'DeliveryQty']),
        DeliBal: getColData(exItem, ['Deli. Bal.', 'Deli Bal.', 'DeliBal', 'Delivery Balance', 'Deli. Bala.']),
        RFD: getColData(exItem, ['RFD']),
        Slowmoving: getColData(exItem, ['Slowmoving', 'Slow Moving']),
        FFStock: getColData(exItem, ['FF Stock', 'FFStock', 'FF_Stock']),
      };
    }

    const genId = generateItemId(itemData, dept);
    const itemId = exItem.itemId || genId || `item_${idx}`;

    // Resilient saved-item (dbItem) matching, as in old HEAD detailed-view.js:
    // exact id -> id ignoring a trailing "_" / "_n/a" -> same Color (dyeing/finishing) -> same YDB (yd).
    let dbItem: Loose = planMap.get(itemId) || planMap.get(genId);
    if (!dbItem && savedItems.length > 0) {
      const cleanId = String(itemId).replace(/(_n\/a|_)$/i, '').toLowerCase();
      dbItem = savedItems.find(
        (d: Loose) => d && d.itemId && String(d.itemId).toLowerCase().replace(/(_n\/a|_)$/i, '') === cleanId
      );

      if (!dbItem && (dept === 'dyeing' || dept === 'finishing')) {
        const color = String(itemData.Color || '').trim().toLowerCase();
        if (color) {
          dbItem = savedItems.find(
            (d: Loose) => d && d.itemData && String(d.itemData.Color || '').trim().toLowerCase() === color
          );
        }
      }

      if (!dbItem && dept === 'yd') {
        const ydb = String(itemData.YDB || itemData['YD B'] || '').trim().toLowerCase();
        if (ydb && ydb !== 'n/a') {
          dbItem = savedItems.find(
            (d: Loose) =>
              d && d.itemData && String(d.itemData.YDB || d.itemData['YD B'] || '').trim().toLowerCase() === ydb
          );
        }
      }
    }
    const saved = dbItem || {};

    if (saved && saved.itemData) {
      if (saved.itemData.Unit) itemData.Unit = saved.itemData.Unit;
      if (saved.itemData.ProcessName) itemData.ProcessName = saved.itemData.ProcessName;
      if (saved.itemData['Process Name']) itemData['Process Name'] = saved.itemData['Process Name'];
      if (saved.itemData['Barrier Qty.']) itemData['Barrier Qty.'] = saved.itemData['Barrier Qty.'];
      if (saved.itemData['Workable Qty.']) itemData['Workable Qty.'] = saved.itemData['Workable Qty.'];
    }

    // Unit / Process Name fall back to the order's floor / program type (old HEAD, every department).
    if (!itemData.Unit && currentOrder.floor) itemData.Unit = currentOrder.floor;
    if (!itemData.ProcessName && currentOrder.programType) itemData.ProcessName = currentOrder.programType;
    if (!itemData['Process Name'] && currentOrder.programType) itemData['Process Name'] = currentOrder.programType;

    // Plan dates come only from the saved item: no T&A fallback (removed in old HEAD).
    const planType = saved.planType || exItem.planType || '';
    const startDate = saved.startDate || saved.planStart || exItem.startDate || '';
    const floorPlanType = saved.floorPlanType || exItem.floorPlanType || '';
    const floorStartDate = saved.floorStartDate || exItem.floorStartDate || '';

    // UI-only flag (never sent): a saved plan keeps Dyeing/Delivery editable even when the upstream type is blank.
    const hasExistingPlan =
      dept === 'delivery'
        ? Boolean(floorPlanType || planType || floorStartDate || startDate)
        : Boolean(planType || startDate);

    return {
      ...exItem,
      itemId,
      itemData,
      planType,
      startDate,
      endDate: saved.endDate || saved.planEnd || exItem.endDate || '',
      limitation: saved.limitation || exItem.limitation || '',
      remarks: saved.remarks || exItem.remarks || '',
      unit: saved.unit || itemData.Unit || exItem.Unit || '',
      processName: saved.processName || itemData.ProcessName || exItem.ProcessName || exItem['Process Name'] || '',
      yarnDate: saved.yarnDate || exItem.yarnDate || '',
      yarnOkDate: saved.yarnOkDate || exItem.yarnOkDate || '',
      matchingOptionDate: saved.matchingOptionDate || exItem.matchingOptionDate || '',
      floorStartDate,
      floorEndDate: saved.floorEndDate || exItem.floorEndDate || '',
      floorPlanType,
      barrierQty: saved.barrierQty !== undefined ? saved.barrierQty : (saved.itemData ? saved.itemData['Barrier Qty.'] : itemData['Barrier Qty.']),
      workableQty: saved.workableQty !== undefined ? saved.workableQty : (saved.itemData ? saved.itemData['Workable Qty.'] : itemData['Workable Qty.']),
      hasExistingPlan,
    };
  });

  // Parity with Exp detailed-view.js lines 361-380: Delivery Floor default dates from Dyeing plan
  if (dept === 'delivery') {
    merged.forEach((item: Loose) => {
      const myColor = String(item.itemData.Color || '').trim().toLowerCase();
      const dItem = currentPlan?.dyeing?.find((d: Loose) => matchesDyeColor(d, myColor));
      const hasDyePlanType = Boolean(
        dItem?.planType && dItem.planType !== 'Select' && dItem.planType !== '-' && dItem.planType !== ''
      );

      if (hasDyePlanType) {
        const dyeStart = dItem?.startDate || dItem?.planStart;
        const dyeEnd = dItem?.endDate || dItem?.planEnd;

        if (!item.floorStartDate && dyeStart) {
          const d = new Date(dyeStart);
          d.setDate(d.getDate() + 7);
          item.floorStartDate = d.toISOString().split('T')[0];
        }
        if (!item.floorEndDate && dyeEnd) {
          const d = new Date(dyeEnd);
          d.setDate(d.getDate() + 7);
          item.floorEndDate = d.toISOString().split('T')[0];
        }
        if (!item.floorPlanType) {
          item.floorPlanType = 'Tentative';
        }
      }
    });
  }

  // Parity with Exp detailed-view.js lines 472-484: YD Floor default dates from YD plan (startDate - 4 days)
  if (dept === 'yd') {
    merged.forEach((item: Loose) => {
      if (!item.floorStartDate && item.startDate) {
        const d = new Date(item.startDate);
        d.setDate(d.getDate() - 4);
        item.floorStartDate = d.toISOString().split('T')[0];
      }
      if (!item.floorEndDate && item.endDate) {
        const d = new Date(item.endDate);
        d.setDate(d.getDate() - 4);
        item.floorEndDate = d.toISOString().split('T')[0];
      }
    });
  }

  return merged;
}

function findUpstreamPlans(planData: Loose, item: Loose) {
  const myColor = String(item.itemData?.Color || item.Color || item['Color'] || item['Colour'] || '').trim().toLowerCase();
  const myConst = String(item.itemData?.FabricConstruction || item.FabricConstruction || item['Fabric Construction'] || item['Construction'] || '').trim().toLowerCase();

  let knitItem: Loose = null;
  let dyeItem: Loose = null;

  if (planData?.knitting && Array.isArray(planData.knitting)) {
    knitItem = planData.knitting.find((k: Loose) => {
      const c = String((k.itemData && k.itemData.Color) || k.Color || '').trim().toLowerCase();
      const fc = String((k.itemData && k.itemData.FabricConstruction) || k.FabricConstruction || '').trim().toLowerCase();
      if (myConst && fc) {
        return c === myColor && fc === myConst;
      }
      return c === myColor;
    });
    if (!knitItem) {
      knitItem = planData.knitting.find((k: Loose) => {
        const c = String((k.itemData && k.itemData.Color) || k.Color || '').trim().toLowerCase();
        return c === myColor;
      });
    }
  }

  if (planData?.dyeing && Array.isArray(planData.dyeing)) {
    dyeItem = planData.dyeing.find((d: Loose) => matchesDyeColor(d, myColor));
  }

  const isKnitTypeSelected = Boolean(
    knitItem?.planType && knitItem.planType !== 'Select' && knitItem.planType !== '-' && knitItem.planType !== ''
  );
  const isDyeTypeSelected = Boolean(
    dyeItem?.planType && dyeItem.planType !== 'Select' && dyeItem.planType !== '-' && dyeItem.planType !== ''
  );

  return { knitItem, dyeItem, isKnitTypeSelected, isDyeTypeSelected };
}

function ydKnitPlan(planData: Loose, order: Loose) {
  if (planData?.knitting && Array.isArray(planData.knitting) && planData.knitting.length > 0) {
    const kItem = planData.knitting[0];
    return {
      start: kItem.startDate || kItem.planStart || '',
      end: kItem.endDate || kItem.planEnd || '',
    };
  }
  return {
    start: order?.knitStart && order.knitStart !== 'N/A' && order.knitStart !== '-' ? order.knitStart : '',
    end: order?.knitEnd && order.knitEnd !== 'N/A' && order.knitEnd !== '-' ? order.knitEnd : '',
  };
}

function formatPlanPayload(dept: string, planItems: Loose[]) {
  const formattedItems = planItems.map((item) => {
    const itemData = { ...(item.itemData || {}) };
    if (dept === 'yd') {
      if (item.barrierQty !== undefined) itemData['Barrier Qty.'] = item.barrierQty;
      if (item.workableQty !== undefined) itemData['Workable Qty.'] = item.workableQty;
    }
    if (dept === 'dyeing' || dept === 'finishing') {
      if (item.unit) itemData.Unit = item.unit;
      if (item.processName) {
        itemData.ProcessName = item.processName;
        itemData['Process Name'] = item.processName;
      }
    }
    return {
      itemId: item.itemId,
      itemData,
      planType: item.planType || '',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      limitation: item.limitation || '',
      remarks: item.remarks || '',
      floorStartDate: item.floorStartDate || '',
      floorEndDate: item.floorEndDate || '',
      floorPlanType: item.floorPlanType || '',
      yarnDate: item.yarnDate || '',
      yarnOkDate: item.yarnOkDate || '',
      matchingOptionDate: item.matchingOptionDate || '',
      unit: item.unit || '',
      processName: item.processName || '',
      barrierQty: item.barrierQty !== undefined ? item.barrierQty : itemData['Barrier Qty.'],
      workableQty: item.workableQty !== undefined ? item.workableQty : itemData['Workable Qty.'],
    };
  });
  return formattedItems;
}

export type { Loose };
export {
  buildMergedItems,
  findUpstreamPlans,
  formatDateDisplay,
  formatExcelDate,
  formatPlanPayload,
  readIsAdminRole,
  subscribeToNothing,
  withCurrentOption,
  ydKnitPlan,
};
