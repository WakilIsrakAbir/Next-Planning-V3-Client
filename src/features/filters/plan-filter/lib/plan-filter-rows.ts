import { getColData } from '@/lib/data-utils';
import type { Cell, JsonObject, PfRow } from '@/features/filters/plan-filter/types';

export function parseShortDateToISO(dateStr?: string): string {
  if (!dateStr || dateStr === '-' || dateStr === 'N/A') return '';
  const parts = dateStr.split('-');
  if (parts.length === 2) {
    const day = parseInt(parts[0], 10);
    const months: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const month = months[parts[1].trim()];
    if (month !== undefined && !isNaN(day)) {
      const year = new Date().getFullYear();
      const dt = new Date(year, month, day);
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${dt.getFullYear()}-${mm}-${dd}`;
    }
  }

  const dt = new Date(dateStr);
  if (!isNaN(dt.getTime())) {
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm}-${dd}`;
  }
  return '';
}

/**
 * Normalizes an item into the Plan Filter column names (legacy plan-filter.js
 * column mappings, including the Unit / ProcessName fallbacks to the order's
 * floor / programType and the DeliBal = RequiredQtyKgs - NetDeliveryQtyKgs fallback).
 */
export function buildPfRow(
  src: JsonObject,
  base: {
    orderNo: string;
    buyer: string;
    colorFallback?: string;
    unitFallback?: string;
    processFallback?: string;
  }
): PfRow {
  const col = (keys: string[]): Cell => getColData(src, keys);

  const row: PfRow = {
    OrderNo: base.orderNo,
    Buyer: base.buyer,
    Color: col(['Color', 'Colour', 'Fab Color']) || base.colorFallback || 'N/A',
    FabricConstruction: col(['FabricConstruction', 'Construction', 'Fab Const', 'Fabric']),
    GSM: col(['GSM', 'G.S.M']),
    RequiredQtyKgs: col(['RequiredQtyKgs', 'Req Qty', 'Qty', 'Order Qty']),
    Allowance: col(['Allowance %', 'Allowance', 'Wastage %', 'Wastage', 'Allow %', 'Allow']),
    YarnReq: col(['Yarn req.', 'YarnReq', 'Yarn Req', 'Yarn Req.']),
    AllocatedQty: col(['Allocated Qty', 'Allocated Qty ', 'AllocatedQty', 'Alloc Qty']),
    YarnBala: col(['Yarn bala.', 'YarnBala', 'Yarn Bala', 'Yarn Balance']),
    GreyReq: col(['Grey Req.', 'GreyReq', 'Grey Req']),
    KnitProd: col(['Knit Prod.', 'KnitProd', 'Knit Prod', 'Knit Production']),
    KnitBala: col(['Knit. Bala.', 'KnitBala', 'Knit Bala.', 'Knit Bala', 'Knit. Bal.']),
    Unit: col(['Unit']) || base.unitFallback || 'N/A',
    ProcessName: col(['Process Name', 'ProcessName', 'Process']) || base.processFallback || 'N/A',
    BPQty: col(['BP Qty', 'BPQty', 'BP_Qty']),
    DyeingProd: col(['Dyeing Prod.', 'DyeingProd', 'Dyeing Prod', 'Dyeing ok', 'Dyeing Production']),
    DyeingBala: col(['Dyeing Bala.', 'DyeingBala', 'Dyeing Bala', 'Dyeing Bal.']),
    NetReceivedQtyKgs: col(['NetReceivedQtyKgs', 'NetReceivedQty', 'ReceivedQty']),
    NetDeliveryQtyKgs: col(['NetDeliveryQtyKgs', 'NetDeliveryQty', 'DeliveryQty']),
    DeliBal: col(['Deli. Bal.', 'Deli Bal.', 'DeliBal', 'Delivery Balance', 'Deli. Bala.']),
    RFD: col(['RFD']),
    Slowmoving: col(['Slowmoving', 'Slow Moving']),
    FFStock: col(['FFStock', 'FF Stock', 'FF_Stock']),
    // YD fields
    'Booking Type': col(['Booking Type', 'Type', 'YD Type']),
    YDB: col(['YDB', 'YD B']),
    'YD Booking Date': col(['YD Booking Date']),
    'Barrier Qty.': col(['Barrier Qty.', 'Barrier Qty']),
    'Workable Qty.': col(['Workable Qty.', 'Workable Qty']),
    'YD REQ.': col(['YD REQ.', 'YD REQ', 'Requirement']),
    DYED: col(['DYED', 'Dyed']),
    'YD BALANCE': col(['YD BALANCE', 'YD Balance']),
    'YD Delivered': col(['YD Delivered', 'Delivered']),
    'YD DELIVERY BALANCE': col(['YD DELIVERY BALANCE', 'YD Balance_1', 'YD Delivery Balance']),
  };

  if (!row.DeliBal || Number(row.DeliBal) === 0) {
    const req = Number(row.RequiredQtyKgs) || 0;
    const del = Number(row.NetDeliveryQtyKgs) || 0;
    if (req > 0 && del > 0) row.DeliBal = req - del;
  }

  return row;
}

export function cellText(value: Cell): string {
  return value === undefined || value === null ? '' : String(value);
}
