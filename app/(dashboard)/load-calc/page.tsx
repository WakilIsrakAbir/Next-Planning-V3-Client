'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Gauge,
  Download,
  Calendar,
  Layers,
  FileSpreadsheet,
  TrendingUp,
  HandMetal,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_BASE } from '@/lib/constants';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';
import InlineSpinner from '@/components/common/InlineSpinner';

const LOAD_DEPTS = [
  { key: 'yd', label: 'YD', pendingQtyField: 'YD DELIVERY BALANCE', colorClass: 'bg-purple-600 hover:bg-purple-700 text-white', activeClass: 'bg-purple-600 text-white border-purple-600 shadow-md' },
  { key: 'knitting', label: 'Knitting', pendingQtyField: 'KnitBala', colorClass: 'bg-blue-600 hover:bg-blue-700 text-white', activeClass: 'bg-blue-600 text-white border-blue-600 shadow-md' },
  { key: 'dyeing', label: 'Dyeing', pendingQtyField: 'DyeingBala', colorClass: 'bg-green-600 hover:bg-green-700 text-white', activeClass: 'bg-green-600 text-white border-green-600 shadow-md' },
  { key: 'delivery', label: 'Delivery', pendingQtyField: 'DeliBal', colorClass: 'bg-orange-500 hover:bg-orange-600 text-white', activeClass: 'bg-orange-500 text-white border-orange-500 shadow-md' },
  { key: 'deliveryfloor', label: 'Delivery (Floor)', pendingQtyField: 'DeliBal', colorClass: 'bg-amber-600 hover:bg-amber-700 text-white', activeClass: 'bg-amber-600 text-white border-amber-600 shadow-md' },
];

const LOAD_REPORT_CONFIG: Record<
  string,
  {
    name: string;
    pendingQtyField: string;
    columns: string[];
  }
> = {
  knitting: {
    name: 'Knitting',
    pendingQtyField: 'KnitBala',
    columns: ['OrderNo', 'Color', 'FabricConstruction', 'GSM', 'Buyer', 'GreyReq', 'KnitProd', 'KnitBala'],
  },
  dyeing: {
    name: 'Dyeing',
    pendingQtyField: 'DyeingBala',
    columns: [
      'OrderNo',
      'Color',
      'RequiredQtyKgs',
      'Buyer',
      'Unit',
      'ProcessName',
      'GreyReq',
      'KnitProd',
      'KnitBala',
      'BPQty',
      'DyeingProd',
      'DyeingBala',
    ],
  },
  delivery: {
    name: 'Delivery',
    pendingQtyField: 'DeliBal',
    columns: [
      'OrderNo',
      'Color',
      'FabricConstruction',
      'GSM',
      'Buyer',
      'RequiredQtyKgs',
      'NetReceivedQtyKgs',
      'NetDeliveryQtyKgs',
      'DeliBal',
      'RFD',
      'Slowmoving',
    ],
  },
  yd: {
    name: 'YD',
    pendingQtyField: 'YD DELIVERY BALANCE',
    columns: [
      'OrderNo',
      'Booking Type',
      'YDB',
      'Buyer',
      'YD REQ.',
      'DYED',
      'YD BALANCE',
      'YD Delivered',
      'YD DELIVERY BALANCE',
    ],
  },
  deliveryfloor: {
    name: 'Delivery (Floor)',
    pendingQtyField: 'DeliBal',
    columns: [
      'OrderNo',
      'Color',
      'FabricConstruction',
      'GSM',
      'Buyer',
      'RequiredQtyKgs',
      'NetReceivedQtyKgs',
      'NetDeliveryQtyKgs',
      'DeliBal',
      'RFD',
      'Slowmoving',
    ],
  },
};

// Persistent module-level cache identical to Exp globalLoadData
const cachedGlobalLoadData: Record<string, any[]> = {};

// Key normalizer for flexible header matching
const _normCache = new Map<string, string>();
function _norm(key: any): string {
  if (key === undefined || key === null) return '';
  const s = String(key);
  if (_normCache.has(s)) return _normCache.get(s)!;
  const n = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  _normCache.set(s, n);
  return n;
}

function getColData(row: any, keys: string[]): any {
  if (!row) return '';
  const map: Record<string, string> = {};
  for (const rk in row) {
    map[_norm(rk)] = rk;
  }
  for (const k of keys) {
    const actual = map[_norm(k)];
    if (actual !== undefined) {
      const val = row[actual];
      return val !== undefined && val !== null ? val : '';
    }
  }
  return '';
}

function loadNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/,/g, '').replace(/\s*Kg$/i, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function generateItemId(itemData: any, dept: string): string {
  if (!itemData) return '';
  const currentDept = dept.replace('_report', '');
  const bNo = String(
    itemData.OrderNo !== undefined && itemData.OrderNo !== null
      ? itemData.OrderNo
      : itemData['Booking No.'] || itemData['Order No'] || itemData.BookingNo || 'N/A'
  ).trim();
  const color = String(
    itemData.Color !== undefined && itemData.Color !== null
      ? itemData.Color
      : itemData.Colour || itemData['Fab Color'] || 'N/A'
  ).trim();

  if (currentDept === 'knitting' || currentDept === 'delivery' || currentDept === 'deliveryfloor') {
    const fabConst = String(
      itemData.FabricConstruction !== undefined && itemData.FabricConstruction !== null
        ? itemData.FabricConstruction
        : itemData.Construction || itemData['Fab Const'] || itemData.Fabric || 'N/A'
    ).trim();
    const gsm = String(
      itemData.GSM !== undefined && itemData.GSM !== null
        ? itemData.GSM
        : itemData['G.S.M'] || 'N/A'
    ).trim();
    return `${bNo}_${color}_${fabConst}_${gsm}`.toLowerCase().replace(/\s+/g, '');
  } else if (currentDept === 'yd') {
    const type = String(
      itemData['Booking Type'] !== undefined && itemData['Booking Type'] !== null
        ? itemData['Booking Type']
        : itemData.Type || itemData['YD Type'] || 'N/A'
    ).trim();
    const ydb = String(
      itemData.YDB !== undefined && itemData.YDB !== null
        ? itemData.YDB
        : itemData['YD B'] || 'N/A'
    ).trim();
    return `${bNo}_${type}_${ydb}`.toLowerCase().replace(/\s+/g, '');
  } else {
    // dyeing / finishing
    const procName = String(
      itemData.ProcessName !== undefined && itemData.ProcessName !== null
        ? itemData.ProcessName
        : itemData['Process Name'] || itemData.Process || ''
    ).trim();
    return `${bNo}_${color}_${procName}`.toLowerCase().replace(/\s+/g, '');
  }
}

function parseLoadDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function startOfLoadDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLoadMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function loadMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function minLoadDate(date1: Date, date2: Date): Date {
  return date1 <= date2 ? date1 : date2;
}

function maxLoadDate(date1: Date, date2: Date): Date {
  return date1 >= date2 ? date1 : date2;
}

function inclusiveLoadDays(startDate: Date, endDate: Date): number {
  return Math.floor((startOfLoadDay(endDate).getTime() - startOfLoadDay(startDate).getTime()) / 86400000) + 1;
}

function formatLoadMonthHeader(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function formatSummaryMonthHeader(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long' });
}

function formatLoadMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-');
}

function formatLoadDate(dateValue: any): string {
  const date = parseLoadDate(dateValue);
  if (!date) return '';
  return date.getDate() + '-' + date.toLocaleDateString('en-US', { month: 'short' });
}

function calculateLoadAllocation(pendingQty: any, planStartVal: any, planEndVal: any, reportMonths: Date[]) {
  const qty = Math.max(0, loadNumber(pendingQty));
  const planStart = parseLoadDate(planStartVal);
  const planEnd = parseLoadDate(planEndVal);
  const today = startOfLoadDay(new Date());

  const emptyResult = { leadDay: 0, loadPerDay: 0, monthlyLoads: [0, 0, 0, 0, 0] };
  if (!planStart || !planEnd || qty <= 0) return emptyResult;

  if (planEnd.getTime() <= today.getTime()) {
    return {
      leadDay: 1,
      loadPerDay: Math.round(qty),
      monthlyLoads: reportMonths.map((_, index) => (index === 0 ? Math.round(qty) : 0)),
    };
  }

  const allocationStart = maxLoadDate(planStart, today);
  const leadDay = Math.max(1, inclusiveLoadDays(allocationStart, planEnd));

  const monthlyLoads = reportMonths.map((monthStart) => {
    const currentMonthEnd = loadMonthEnd(monthStart);
    const previousMonthEnd = loadMonthEnd(addLoadMonths(monthStart, -1));
    const currentCutoff = minLoadDate(planEnd, currentMonthEnd);
    const previousCutoff = minLoadDate(planEnd, previousMonthEnd);

    const currentDays = Math.max(0, inclusiveLoadDays(allocationStart, currentCutoff));
    const previousDays = Math.max(0, inclusiveLoadDays(allocationStart, previousCutoff));

    const currentCumulative = Math.round((qty * currentDays) / leadDay);
    const previousCumulative = Math.round((qty * previousDays) / leadDay);

    return Math.max(0, currentCumulative - previousCumulative);
  });

  return {
    leadDay,
    loadPerDay: Math.round(qty / leadDay),
    monthlyLoads,
  };
}

function formatExcelWorksheet(ws: any) {
  if (!ws || !ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);

  const headers: string[] = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    headers[C] = cell ? String(cell.v).toLowerCase() : '';
  }

  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellRef];
      if (!cell || cell.v === undefined || cell.v === null || cell.v === '') continue;

      const headerLower = headers[C] || '';
      const textCols = ['color', 'fabric construction', 'buyer', 'plan type', 'order'];
      const isText = textCols.some((t) => headerLower.includes(t));

      if (isText) {
        cell.t = 's';
        cell.v = String(cell.v);
      }
    }
  }
}

function LoadCalculationContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'detailed' | 'summary'>(
    tabParam === 'detailed' ? 'detailed' : 'summary'
  );

  useEffect(() => {
    if (tabParam === 'detailed' || tabParam === 'summary') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Initial state: starts unselected for immediate 0s page load, matching Exp showLoadCalculation
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingDept, setDownloadingDept] = useState<string | null>(null);

  // Month selector
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [startMonth, setStartMonth] = useState(currentMonthStr);

  // Department data state
  const [departmentData, setDepartmentData] = useState<Record<string, any[]>>(() => cachedGlobalLoadData);

  // Generate 5 months array
  const [y, m] = startMonth.split('-').map(Number);
  const firstMonth = new Date(y, m - 1, 1);
  const reportMonths = Array.from({ length: 5 }, (_, i) => addLoadMonths(firstMonth, i));
  const monthLabels = reportMonths.map((d) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));

  // Month options (-12 to +24) matching Exp initLoadMonthSelector
  const monthOptions = [];
  for (let i = -12; i <= 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lbl = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-');
    monthOptions.push({ val, lbl });
  }

  // Fetch load calculation data for department matching Exp logic with in-memory caching
  const ensureLoadDataForDept = async (deptKey: string): Promise<any[]> => {
    if (cachedGlobalLoadData[deptKey] && cachedGlobalLoadData[deptKey].length > 0) {
      setDepartmentData((prev) => ({ ...prev, [deptKey]: cachedGlobalLoadData[deptKey] }));
      return cachedGlobalLoadData[deptKey];
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const actualDept = deptKey === 'deliveryfloor' ? 'delivery' : deptKey;

      const res = await fetch(`${API_BASE}/api/orders/report/${actualDept}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return [];
      const data = await res.json();
      if (!data.orders || !data.planMap) return [];

      const rows: any[] = [];
      const floorRows: any[] = [];

      data.orders.forEach((order: any) => {
        const planData = data.planMap[order.orderNo];
        if (!planData || !planData[actualDept]) return;
        const excelItems = order[`${actualDept}Items`] || [];

        planData[actualDept].forEach((savedItem: any) => {
          let itemData = savedItem.itemData || {};

          // Robust item matching against excel items
          if (excelItems.length > 0) {
            let exItem = excelItems.find((ex: any) => {
              if (savedItem.itemId) {
                if (generateItemId(ex, actualDept) === savedItem.itemId) return true;
                const altId = `${order.orderNo}_${getColData(ex, ['Color', 'Colour'])}_${getColData(ex, ['Process Name', 'ProcessName'])}`
                  .toLowerCase()
                  .replace(/\s+/g, '');
                if (altId === savedItem.itemId) return true;
              }
              return false;
            });

            // Fallback match by characteristics
            if (!exItem) {
              exItem = excelItems.find((ex: any) => {
                const c1 = _norm(getColData(ex, ['Color', 'Colour', 'Fab Color']));
                const c2 = _norm(getColData(itemData, ['Color', 'Colour', 'Fab Color']));
                if (!c1 || c1 !== c2) return false;

                if (actualDept === 'knitting' || actualDept === 'delivery') {
                  const f1 = _norm(getColData(ex, ['FabricConstruction', 'Construction', 'Fab Const', 'Fabric']));
                  const f2 = _norm(getColData(itemData, ['FabricConstruction', 'Construction', 'Fab Const', 'Fabric']));
                  const g1 = _norm(getColData(ex, ['GSM', 'G.S.M']));
                  const g2 = _norm(getColData(itemData, ['GSM', 'G.S.M']));
                  return f1 === f2 && g1 === g2;
                } else if (actualDept === 'yd') {
                  const t1 = _norm(getColData(ex, ['Booking Type', 'Type', 'YD Type']));
                  const t2 = _norm(getColData(itemData, ['Booking Type', 'Type', 'YD Type']));
                  const y1 = _norm(getColData(ex, ['YDB', 'YD B']));
                  const y2 = _norm(getColData(itemData, ['YDB', 'YD B']));
                  return t1 === t2 && y1 === y2;
                } else {
                  const p1 = _norm(getColData(ex, ['Process Name', 'ProcessName', 'Process']));
                  const p2 = _norm(getColData(itemData, ['Process Name', 'ProcessName', 'Process']));
                  return !p1 || !p2 || p1 === p2;
                }
              });
            }

            if (exItem) {
              itemData = { ...(savedItem.itemData || {}), ...exItem };
            }
          }

          const baseRow: Record<string, any> = {};
          baseRow.OrderNo = order.orderNo;
          baseRow.Buyer = getColData(itemData, ['Buyer', 'BuyerName', 'Customer']) || order.buyer || '';
          baseRow.Color = getColData(itemData, ['Color', 'Colour', 'Fab Color']);
          baseRow.FabricConstruction = getColData(itemData, ['FabricConstruction', 'Construction', 'Fab Const', 'Fabric']);
          baseRow.GSM = getColData(itemData, ['GSM', 'G.S.M']);
          baseRow.RequiredQtyKgs = getColData(itemData, ['RequiredQtyKgs', 'Req Qty', 'Qty']);
          baseRow.GreyReq = getColData(itemData, ['Grey Req.', 'GreyReq']);
          baseRow.KnitProd = getColData(itemData, ['Knit Prod.', 'KnitProd']);
          baseRow.KnitBala = getColData(itemData, ['Knit. Bala.', 'KnitBala', 'Knit Bala', 'Knitting Balance']);
          baseRow.BPQty = getColData(itemData, ['BP Qty', 'BPQty']);
          baseRow.DyeingProd = getColData(itemData, ['Dyeing Prod.', 'DyeingProd']);
          baseRow.DyeingBala = getColData(itemData, ['Dyeing Bala.', 'DyeingBala', 'Dyeing Bala', 'Dyeing Balance']);
          baseRow.NetReceivedQtyKgs = getColData(itemData, ['NetReceivedQtyKgs', 'NetReceivedQty', 'ReceivedQty']);
          baseRow.NetDeliveryQtyKgs = getColData(itemData, ['NetDeliveryQtyKgs', 'NetDeliveryQty', 'DeliveryQty']);
          baseRow.DeliBal = getColData(itemData, ['Deli. Bal.', 'Deli Bal.', 'DeliBal', 'Deli. Bala.', 'Delivery Balance']);
          baseRow.RFD = getColData(itemData, ['RFD']);
          baseRow.Slowmoving = getColData(itemData, ['Slowmoving']);
          baseRow.Unit = getColData(itemData, ['Unit']);
          baseRow.ProcessName = getColData(itemData, ['Process Name', 'ProcessName', 'Process']);
          baseRow['Booking Type'] = getColData(itemData, ['Booking Type', 'Type', 'YD Type']);
          baseRow.YDB = getColData(itemData, ['YDB', 'YD B']);
          baseRow['YD REQ.'] = getColData(itemData, ['YD REQ.', 'YD REQ', 'Requirement']);
          baseRow.DYED = getColData(itemData, ['DYED', 'Dyed']);
          baseRow['YD BALANCE'] = getColData(itemData, ['YD BALANCE', 'YD Balance']);
          baseRow['YD Delivered'] = getColData(itemData, ['YD Delivered', 'Delivered']);
          baseRow['YD DELIVERY BALANCE'] = getColData(itemData, ['YD DELIVERY BALANCE', 'YD Balance_1', 'YD Balance 2', 'YD Delivery Balance']);

          // Calculate DeliBal if missing
          if (!baseRow.DeliBal || loadNumber(baseRow.DeliBal) === 0) {
            const req = loadNumber(baseRow.RequiredQtyKgs);
            const del = loadNumber(baseRow.NetDeliveryQtyKgs);
            if (req > 0) baseRow.DeliBal = req - del;
          }

          // Regular department row
          if (savedItem.planType === 'Confirm' || savedItem.planType === 'Tentative') {
            const regRow = { ...baseRow };
            regRow.planStart = savedItem.startDate;
            regRow.planEnd = savedItem.endDate;
            regRow.planType = savedItem.planType;
            rows.push(regRow);
          }

          // Delivery floor row
          if (actualDept === 'delivery' && savedItem.floorStartDate && savedItem.floorEndDate) {
            if (savedItem.floorPlanType === 'Confirm' || savedItem.floorPlanType === 'Tentative') {
              const floorRow = { ...baseRow };
              floorRow.planStart = savedItem.floorStartDate;
              floorRow.planEnd = savedItem.floorEndDate;
              floorRow.planType = savedItem.floorPlanType;
              floorRows.push(floorRow);
            }
          }
        });
      });

      cachedGlobalLoadData[actualDept] = rows;
      if (actualDept === 'delivery') {
        cachedGlobalLoadData.deliveryfloor = floorRows;
      }

      setDepartmentData((prev) => {
        const next = { ...prev, [actualDept]: rows };
        if (actualDept === 'delivery') {
          next.deliveryfloor = floorRows;
        }
        return next;
      });

      return deptKey === 'deliveryfloor' ? floorRows : rows;
    } catch (err) {
      console.error(`Error loading load calculation data for ${deptKey}:`, err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Build Detailed Report Data matching Exp buildReportData
  const buildReportData = (deptKey: string | null, customRows?: any[]) => {
    if (!deptKey) {
      return { config: LOAD_REPORT_CONFIG.knitting, reportMonths, headers: [], rows: [] };
    }
    const config = LOAD_REPORT_CONFIG[deptKey] || LOAD_REPORT_CONFIG.knitting;
    const sourceRows = customRows || departmentData[deptKey] || cachedGlobalLoadData[deptKey] || [];

    const headers = [
      ...config.columns,
      `${config.name} Plan Start Date`,
      `${config.name} Plan End Date`,
      `${config.name} Plan Type`,
      'Lead Day',
      'L/Day',
      ...reportMonths.map(formatLoadMonthHeader),
    ];

    const rows = sourceRows
      .filter((row: any) => row.planType === 'Confirm' || row.planType === 'Tentative')
      .filter((row: any) => loadNumber(row[config.pendingQtyField]) > 0)
      .map((row: any) => {
        const allocation = calculateLoadAllocation(row[config.pendingQtyField], row.planStart, row.planEnd, reportMonths);
        return {
          source: row,
          excelRow: [
            ...config.columns.map((col: string) => (row[col] !== undefined && row[col] !== null ? row[col] : '')),
            formatLoadDate(row.planStart),
            formatLoadDate(row.planEnd),
            row.planType || '',
            allocation.leadDay,
            allocation.loadPerDay,
            ...allocation.monthlyLoads,
          ],
          monthlyLoads: allocation.monthlyLoads,
        };
      });

    return { config, reportMonths, headers, rows };
  };

  // Build Summary Data matching Exp buildSummaryData
  const buildSummaryData = (deptKey: string | null, customRows?: any[]) => {
    if (!deptKey) {
      return {
        config: LOAD_REPORT_CONFIG.knitting,
        reportMonths,
        headers: ['Buyer', ...reportMonths.map(formatSummaryMonthHeader), 'Total [Kg]'],
        rows: [],
        grandMonthlyTotals: [0, 0, 0, 0, 0],
        grandTotal: 0,
      };
    }

    const detailData = buildReportData(deptKey, customRows);
    const buyerMap = new Map<string, number[]>();

    detailData.rows.forEach((detailRow: any) => {
      const buyer = String(detailRow.source.Buyer || 'Unspecified').trim() || 'Unspecified';
      if (!buyerMap.has(buyer)) buyerMap.set(buyer, [0, 0, 0, 0, 0]);

      const buyerMonths = buyerMap.get(buyer)!;
      detailRow.monthlyLoads.forEach((val: number, idx: number) => {
        buyerMonths[idx] += loadNumber(val);
      });
    });

    const summaryRows = Array.from(buyerMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([buyer, monthlyValues]) => ({
        buyer,
        monthlyValues,
        total: monthlyValues.reduce((sum, v) => sum + v, 0),
      }));

    const grandMonthlyTotals = [0, 0, 0, 0, 0];
    summaryRows.forEach((row) => {
      row.monthlyValues.forEach((val, idx) => {
        grandMonthlyTotals[idx] += val;
      });
    });
    const grandTotal = grandMonthlyTotals.reduce((sum, v) => sum + v, 0);

    return {
      config: detailData.config,
      reportMonths: detailData.reportMonths,
      headers: ['Buyer', ...detailData.reportMonths.map(formatSummaryMonthHeader), 'Total [Kg]'],
      rows: summaryRows,
      grandMonthlyTotals,
      grandTotal,
    };
  };

  // Detailed Load Excel Download (Matching Exp downloadLoadReport)
  const downloadDetailedExcel = async (deptKey: string) => {
    setDownloadingDept(deptKey);
    try {
      const rows = await ensureLoadDataForDept(deptKey);
      const { config, reportMonths: rMonths, headers, rows: detailRows } = buildReportData(deptKey, rows);
      if (!detailRows.length) {
        alert(`No ${config.name} load data found for this period.`);
        return;
      }

      const worksheetData = [headers, ...detailRows.map((r: any) => r.excelRow)];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      worksheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: detailRows.length, c: headers.length - 1 } }),
      };
      worksheet['!cols'] = headers.map((header: string) => {
        if (header.includes('Date') || header.includes('Construction') || header.includes('Process')) return { wch: 21 };
        return { wch: Math.max(10, Math.min(String(header).length + 3, 18)) };
      });

      formatExcelWorksheet(worksheet);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `${config.name} Load`);
      const filename = `${config.name}_Load_${formatLoadMonthYear(rMonths[0])}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Error downloading detailed report:', err);
      alert('Error generating detailed report');
    } finally {
      setDownloadingDept(null);
    }
  };

  // Summary Load Excel Download (Matching Exp downloadLoadSummary)
  const downloadSummaryExcel = async (deptKey?: string) => {
    const targetDept = deptKey || selectedDept;
    if (!targetDept) return;
    setDownloadingDept(targetDept);
    try {
      const rows = await ensureLoadDataForDept(targetDept);
      const { config, reportMonths: rMonths, headers, rows: sRows, grandMonthlyTotals: gTotals, grandTotal: gTot } = buildSummaryData(targetDept, rows);
      if (!sRows.length) {
        alert(`No ${config.name} summary data found.`);
        return;
      }

      const worksheetData = [
        headers,
        ...sRows.map((row: any) => [row.buyer, ...row.monthlyValues, row.total]),
        ['Grand Total', ...gTotals, gTot],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      worksheet['!cols'] = [{ wch: 25 }, ...rMonths.map(() => ({ wch: 15 })), { wch: 15 }];
      formatExcelWorksheet(worksheet);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `${config.name} Summary`);
      const filename = `${config.name}_Summary_${formatLoadMonthYear(rMonths[0])}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Error downloading summary report:', err);
      alert('Error generating summary report');
    } finally {
      setDownloadingDept(null);
    }
  };

  const summaryData = buildSummaryData(selectedDept);
  const summaryRows = summaryData.rows;
  const grandMonthlyTotals = summaryData.grandMonthlyTotals;
  const grandTotal = summaryData.grandTotal;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Gauge className="h-6 w-6 text-primary" />
            {activeTab === 'detailed' ? 'Detailed Load Download' : 'Buyer-wise Load Summary'}
          </h2>
          <p className="text-xs text-base-content/60">
            {activeTab === 'detailed'
              ? 'Download item-level Knitting, Dyeing and Delivery load reports.'
              : 'Download buyer-wise Knitting, Dyeing and Delivery load summaries.'}
          </p>
        </div>

        {/* Tab Selector */}
        <div className="join bg-base-100 p-1 border border-base-300">
          <button
            onClick={() => setActiveTab('summary')}
            className={`join-item btn btn-sm font-bold ${
              activeTab === 'summary' ? 'btn-primary' : 'btn-ghost'
            }`}
          >
            Buyer-wise Load Summary
          </button>
          <button
            onClick={() => setActiveTab('detailed')}
            className={`join-item btn btn-sm font-bold ${
              activeTab === 'detailed' ? 'btn-primary' : 'btn-ghost'
            }`}
          >
            Detailed Load Download
          </button>
        </div>
      </div>

      {/* Control Card - Report Month Selection & Download Actions matching Exp */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Month Selector Box */}
        <div className="bg-blue-50/80 dark:bg-slate-800/80 border border-blue-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-blue-900 dark:text-blue-300 text-sm mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Report Month Selection
            </h3>
            <label className="flex flex-col gap-1 w-full">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Starting Month</span>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="select select-bordered select-sm font-bold text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:outline-none focus:border-blue-500 w-full"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.val} value={opt.val}>
                    {opt.lbl}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="text-[11px] text-blue-800 dark:text-blue-400 font-semibold mt-3">
            5-Month Window: <span className="font-bold">{monthLabels[0]} &rarr; {monthLabels[4]}</span>
          </div>
        </div>

        {/* Quick Action Download Buttons matching Exp */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 lg:col-span-2 shadow-sm flex flex-col justify-center">
          <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-xs uppercase tracking-wider flex items-center gap-2">
            <Download className="h-4 w-4 text-slate-400" />
            {activeTab === 'detailed' ? 'Download Detailed Reports (Excel)' : 'Download Summary Reports (Excel)'}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {LOAD_DEPTS.map((d) => (
              <button
                key={d.key}
                onClick={() => {
                  if (activeTab === 'detailed') {
                    downloadDetailedExcel(d.key);
                  } else {
                    downloadSummaryExcel(d.key);
                  }
                }}
                disabled={downloadingDept === d.key}
                className={`${d.colorClass} rounded-md py-2 px-2.5 text-xs font-bold shadow-sm transition inline-flex items-center justify-center gap-1.5`}
              >
                {downloadingDept === d.key ? (
                  <InlineSpinner size={13} />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{d.label} {activeTab === 'detailed' ? 'Load' : 'Summary'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* View Content */}
      {activeTab === 'detailed' ? (
        /* MENU 1: Detailed Reports View */
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-lg p-4 text-xs text-slate-700 dark:text-slate-300">
            <strong>Note:</strong> Download item-level detailed load reports for Knitting, Dyeing, and Delivery. Data is generated based on your confirmed and tentative plans.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {LOAD_DEPTS.map((d) => (
              <div
                key={d.key}
                className="card bg-base-100 border border-base-300 p-5 shadow-sm hover:shadow-md transition-shadow space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-base-content">{d.label} Detailed Load</h3>
                  <span className="badge badge-primary badge-outline text-xs font-bold uppercase">{d.key}</span>
                </div>

                <p className="text-xs text-base-content/60">
                  Item-level detailed machine allocation mapping pending quantities across 5 projection months.
                </p>

                <div className="text-[11px] bg-base-200/50 p-2.5 rounded text-base-content/70">
                  <span className="font-semibold">Pending Metric:</span> {d.pendingQtyField}
                </div>

                <button
                  onClick={() => downloadDetailedExcel(d.key)}
                  disabled={downloadingDept === d.key}
                  className={`btn btn-sm w-full gap-2 font-bold shadow-md ${d.colorClass}`}
                >
                  {downloadingDept === d.key ? (
                    <InlineSpinner size={14} />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download {d.label} Load Excel
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* MENU 2: Buyer-wise Summary Live Table */
        <div className="border-2 border-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/30 rounded-xl overflow-hidden shadow-lg bg-white dark:bg-slate-900">
          {/* Header Bar with Department Tabs matching Exp */}
          <div className="bg-blue-50 dark:bg-slate-800/90 border-b border-blue-300 dark:border-slate-700 px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="font-bold text-lg text-blue-950 dark:text-blue-200 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Buyer-wise Summary Preview
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                The month names change automatically from the selected starting month.
              </p>
            </div>

            {/* Department Buttons matching Exp summaryBtn */}
            <div className="flex flex-wrap gap-2">
              {LOAD_DEPTS.map((d) => {
                const isActive = selectedDept === d.key;
                return (
                  <button
                    key={d.key}
                    onClick={() => {
                      setSelectedDept(d.key);
                      ensureLoadDataForDept(d.key);
                    }}
                    className={`px-4 py-2 rounded border text-xs font-bold transition-all ${
                      isActive
                        ? d.activeClass
                        : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-auto custom-scrollbar max-h-[580px]">
            {!selectedDept ? (
              <div className="p-14 text-center">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mb-4 text-blue-500">
                    <HandMetal className="w-7 h-7" />
                  </div>
                  <h3 className="text-gray-800 dark:text-gray-200 font-bold text-lg">Select a Department</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                    Click on a department button above (YD, Knitting, Dyeing, Delivery, Delivery (Floor)) to view the buyer-wise load summary.
                  </p>
                </div>
              </div>
            ) : loading ? (
              <div className="p-16 flex items-center justify-center">
                <ExpLoadingSpinner
                  message="Loading Summary Data..."
                  subMessage="Please wait while data is being processed"
                  overlay={false}
                />
              </div>
            ) : summaryRows.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                No load data available for {LOAD_DEPTS.find((d) => d.key === selectedDept)?.label} in this 5-month projection window.
              </div>
            ) : (
              <table className="w-full text-xs min-w-max border-collapse border border-gray-300 dark:border-gray-700">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
                  <tr>
                    <th className="p-2 border border-slate-300 dark:border-slate-700 text-left">Buyer</th>
                    {reportMonths.map((mDate) => (
                      <th
                        key={mDate.toISOString()}
                        className="p-2 border border-slate-300 dark:border-slate-700 text-right font-bold"
                      >
                        {formatSummaryMonthHeader(mDate)}
                      </th>
                    ))}
                    <th className="p-2 border border-slate-300 dark:border-slate-700 text-right font-black bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300">
                      Total [Kg]
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {summaryRows.map((row) => (
                    <tr key={row.buyer} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-2 border border-slate-200 dark:border-slate-700 text-left font-semibold text-slate-700 dark:text-slate-300">
                        {row.buyer}
                      </td>
                      {row.monthlyValues.map((val: number, idx: number) => (
                        <td
                          key={idx}
                          className="p-2 border border-slate-200 dark:border-slate-700 text-right font-mono text-slate-600 dark:text-slate-300"
                        >
                          {val > 0 ? Number(val).toLocaleString() : '0'}
                        </td>
                      ))}
                      <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-mono font-bold text-slate-900 dark:text-slate-100 bg-blue-50/40 dark:bg-blue-950/20">
                        {Number(row.total).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                  <tr>
                    <td className="p-2 border border-slate-300 dark:border-slate-700 text-left font-black text-slate-900 dark:text-slate-100">
                      Grand Total
                    </td>
                    {grandMonthlyTotals.map((tot, idx) => (
                      <td
                        key={idx}
                        className="p-2 border border-slate-300 dark:border-slate-700 text-right font-mono font-black text-slate-900 dark:text-slate-100"
                      >
                        {Number(tot).toLocaleString()}
                      </td>
                    ))}
                    <td className="p-2 border border-slate-300 dark:border-slate-700 text-right font-mono font-black text-primary text-sm bg-blue-100/60 dark:bg-blue-950/60">
                      {Number(grandTotal).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoadCalculationPage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-[400px]">
          <ExpLoadingSpinner
            message="Loading Capacity & Load Forecasting..."
            subMessage="Synchronizing 5-month projection matrix"
          />
        </div>
      }
    >
      <LoadCalculationContent />
    </Suspense>
  );
}
