import * as XLSX from 'xlsx';
import { getColData } from '@/lib/data-utils';
import { formatNumDisplay, parseNum } from '@/features/reports/product-info/lib/number-format';
import type { ColorMatrixData, ProductInfoOrder } from '@/features/reports/product-info/types';

/** Excel download of the order's color-wise matrix and its item-level fabric breakdown. */
export function downloadProductInfoExcel(
  orderDetails: ProductInfoOrder,
  matrixData: ColorMatrixData,
  fabricItems: ProductInfoOrder[]
) {
  const bookingNo = orderDetails.orderNo || '';
  const buyer = orderDetails.buyer || '';
  const { colors, metricResults } = matrixData;

  const wsData: any[][] = [
    ['Product Info Report (Color-wise Specification)'],
    [],
    ['Order / Booking No', bookingNo, '', 'Buyer', buyer],
    ['Style', orderDetails.style || '—', '', 'Required Qty (kg)', orderDetails.requiredQtyKgs || 0],
    [],
    ['--- 1. COLOR-WISE SPECIFICATION MATRIX ---'],
    ['Color Metric', ...colors.map((c) => c.label), 'Total'],
  ];

  metricResults.forEach((r) => {
    const row: any[] = [r.label];
    r.values.forEach((v) => {
      if (v === null || !Number.isFinite(v)) {
        row.push(0);
      } else {
        row.push(r.percent ? parseFloat(((v <= 1 && v > 0 ? v * 100 : v)).toFixed(2)) + '%' : v);
      }
    });
    if (r.total === null || !Number.isFinite(r.total)) {
      row.push(0);
    } else {
      row.push(r.percent ? parseFloat(((r.total <= 1 && r.total > 0 ? r.total * 100 : r.total)).toFixed(2)) + '%' : r.total);
    }
    wsData.push(row);
  });

  wsData.push([]);
  wsData.push(['--- 2. FABRIC & COLOR BREAKDOWN (ITEM LEVEL) ---']);
  wsData.push([
    'Color',
    'Fabric Construction',
    'GSM',
    'Dia',
    'Req Qty (kg)',
    'Allowance %',
    'Yarn Req',
    'Allocated Qty',
    'Yarn Bala',
    'Grey Req',
    'Knit Prod',
    'Knit Bala',
    'Deli Bala',
  ]);

  fabricItems.forEach((it: any) => {
    wsData.push([
      getColData(it, ['Color', 'Colour', 'Fab Color']) || '—',
      getColData(it, ['FabricConstruction', 'Construction', 'Fabric']) || '—',
      getColData(it, ['GSM', 'G.S.M', 'Finish GSM']) || '—',
      getColData(it, ['Gauge-Dia', 'Dia', 'Finish Dia', 'Grey Dia', 'Dia / Width']) || '—',
      parseNum(getColData(it, ['RequiredQtyKgs', 'Required Qty', 'Req Qty'])) ?? 0,
      formatNumDisplay(getColData(it, ['Allowance %', 'Allowance', 'Allow']), true),
      parseNum(getColData(it, ['Yarn req.', 'Yarn Req', 'YarnReq'])) ?? 0,
      parseNum(getColData(it, ['Allocated Qty ', 'Allocated Qty', 'AllocatedQty'])) ?? 0,
      parseNum(getColData(it, ['Yarn bala.', 'Yarn Bala', 'YarnBala'])) ?? 0,
      parseNum(getColData(it, ['Grey Req.', 'Grey Req', 'GreyReq'])) ?? 0,
      parseNum(getColData(it, ['Knit Prod.', 'Knit Prod', 'KnitProd'])) ?? 0,
      parseNum(getColData(it, ['Knit. Bala.', 'Knit Bala', 'KnitBala'])) ?? 0,
      parseNum(getColData(it, ['Deli. Bala.', 'Deli. Bal.', 'DeliBal'])) ?? 0,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 22 }, ...colors.map(() => ({ wch: 16 })), { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Product_Info');
  XLSX.writeFile(wb, `Product_Info_${bookingNo}.xlsx`);
}
