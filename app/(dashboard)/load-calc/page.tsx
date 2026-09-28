'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Gauge,
  Download,
  Calendar,
  Layers,
  CheckCircle2,
  RefreshCw,
  Building2,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_BASE, DEPARTMENTS } from '@/lib/constants';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';
import InlineSpinner from '@/components/common/InlineSpinner';

const LOAD_DEPTS = [
  { key: 'knitting', label: 'Knitting', pendingQtyField: 'KnitBala' },
  { key: 'dyeing', label: 'Dyeing', pendingQtyField: 'DyeingBala' },
  { key: 'delivery', label: 'Delivery', pendingQtyField: 'DeliBal' },
  { key: 'yd', label: 'YD', pendingQtyField: 'YD DELIVERY BALANCE' },
  { key: 'deliveryfloor', label: 'Delivery (Floor)', pendingQtyField: 'DeliBal' },
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

// Key normalizer for flexible header matching
function _norm(key: string): string {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
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
  const bNo = String(itemData.OrderNo !== undefined && itemData.OrderNo !== null ? itemData.OrderNo : 'N/A').trim();
  const color = String(itemData.Color !== undefined && itemData.Color !== null ? itemData.Color : 'N/A').trim();

  if (currentDept === 'knitting' || currentDept === 'delivery' || currentDept === 'deliveryfloor') {
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
    const procName = String(
      itemData.ProcessName !== undefined && itemData.ProcessName !== null ? itemData.ProcessName : 'N/A'
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

  if (planEnd <= today) {
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

  const [selectedDept, setSelectedDept] = useState<string>('knitting');
  const [loading, setLoading] = useState(false);
  const [downloadingDept, setDownloadingDept] = useState<string | null>(null);

  // Month selector
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [startMonth, setStartMonth] = useState(currentMonthStr);

  // Department data cache (stores array of parsed item rows)
  const [departmentData, setDepartmentData] = useState<Record<string, any[]>>({});

  // Generate 5 months array
  const [y, m] = startMonth.split('-').map(Number);
  const firstMonth = new Date(y, m - 1, 1);
  const reportMonths = Array.from({ length: 5 }, (_, i) => addLoadMonths(firstMonth, i));
  const monthLabels = reportMonths.map((d) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));

  // Month options (-12 to +24) matching Exp
  const monthOptions = [];
  for (let i = -12; i <= 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lbl = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-');
    monthOptions.push({ val, lbl });
  }

  // Fetch load calculation data for department matching Exp logic
  const ensureLoadDataForDept = async (deptKey: string): Promise<any[]> => {
    if (departmentData[deptKey] && departmentData[deptKey].length > 0) {
      return departmentData[deptKey];
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
          if (savedItem.planType !== 'Confirm' && savedItem.planType !== 'Tentative') return;

          let itemData = savedItem.itemData || {};
          if (excelItems.length > 0 && savedItem.itemId) {
            const exItem = excelItems.find((ex: any) => generateItemId(ex, actualDept) === savedItem.itemId);
            if (exItem) itemData = exItem;
          }

          const row: Record<string, any> = {};
          row.OrderNo = order.orderNo;
          row.Buyer = getColData(itemData, ['Buyer', 'BuyerName', 'Customer']) || order.buyer || '';
          row.Color = getColData(itemData, ['Color', 'Colour', 'Fab Color']);
          row.FabricConstruction = getColData(itemData, ['FabricConstruction', 'Construction', 'Fab Const', 'Fabric']);
          row.GSM = getColData(itemData, ['GSM', 'G.S.M']);
          row.RequiredQtyKgs = getColData(itemData, ['RequiredQtyKgs', 'Req Qty', 'Qty']);
          row.GreyReq = getColData(itemData, ['Grey Req.', 'GreyReq']);
          row.KnitProd = getColData(itemData, ['Knit Prod.', 'KnitProd']);
          row.KnitBala = getColData(itemData, ['Knit. Bala.', 'KnitBala']);
          row.BPQty = getColData(itemData, ['BP Qty', 'BPQty']);
          row.DyeingProd = getColData(itemData, ['Dyeing Prod.', 'DyeingProd']);
          row.DyeingBala = getColData(itemData, ['Dyeing Bala.', 'DyeingBala']);
          row.NetReceivedQtyKgs = getColData(itemData, ['NetReceivedQtyKgs', 'NetReceivedQty']);
          row.NetDeliveryQtyKgs = getColData(itemData, ['NetDeliveryQtyKgs', 'NetDeliveryQty', 'DeliveryQty']);
          row.DeliBal = getColData(itemData, ['Deli. Bal.', 'Deli Bal.', 'DeliBal', 'Deli. Bala.', 'Delivery Balance']);
          row.RFD = getColData(itemData, ['RFD']);
          row.Slowmoving = getColData(itemData, ['Slowmoving']);
          row.Unit = getColData(itemData, ['Unit']);
          row.ProcessName = getColData(itemData, ['Process Name', 'ProcessName', 'Process']);
          row['Booking Type'] = getColData(itemData, ['Booking Type', 'Type', 'YD Type']);
          row.YDB = getColData(itemData, ['YDB', 'YD B']);
          row['YD REQ.'] = getColData(itemData, ['YD REQ.', 'YD REQ', 'Requirement']);
          row.DYED = getColData(itemData, ['DYED', 'Dyed']);
          row['YD BALANCE'] = getColData(itemData, ['YD BALANCE', 'YD Balance']);
          row['YD Delivered'] = getColData(itemData, ['YD Delivered', 'Delivered']);
          row['YD DELIVERY BALANCE'] = getColData(itemData, ['YD DELIVERY BALANCE', 'YD Balance_1', 'YD Delivery Balance']);

          // Calculate DeliBal if missing
          if (!row.DeliBal || loadNumber(row.DeliBal) === 0) {
            const req = loadNumber(row.RequiredQtyKgs);
            const del = loadNumber(row.NetDeliveryQtyKgs);
            if (req > 0) row.DeliBal = req - del;
          }

          row.planStart = savedItem.startDate;
          row.planEnd = savedItem.endDate;
          row.planType = savedItem.planType;
          rows.push(row);

          // Delivery floor logic
          if (actualDept === 'delivery' && savedItem.floorStartDate && savedItem.floorEndDate) {
            if (savedItem.floorPlanType === 'Confirm' || savedItem.floorPlanType === 'Tentative') {
              const floorRow = { ...row };
              floorRow.planStart = savedItem.floorStartDate;
              floorRow.planEnd = savedItem.floorEndDate;
              floorRow.planType = savedItem.floorPlanType;
              floorRows.push(floorRow);
            }
          }
        });
      });

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

  useEffect(() => {
    ensureLoadDataForDept(selectedDept);
  }, [selectedDept]);

  // Build Detailed Report Data matching Exp
  const buildReportData = (deptKey: string, customRows?: any[]) => {
    const config = LOAD_REPORT_CONFIG[deptKey] || LOAD_REPORT_CONFIG.knitting;
    const sourceRows = customRows || departmentData[deptKey] || [];

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

  // Build Summary Data matching Exp
  const buildSummaryData = (deptKey: string, customRows?: any[]) => {
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
      }))
      .filter((r) => r.total > 0);

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
  const downloadSummaryExcel = () => {
    const { config, reportMonths: rMonths, headers, rows, grandMonthlyTotals, grandTotal } = buildSummaryData(selectedDept);
    if (!rows.length) {
      alert(`No ${config.name} summary data found.`);
      return;
    }

    const worksheetData = [
      headers,
      ...rows.map((row: any) => [row.buyer, ...row.monthlyValues, row.total]),
      ['Grand Total', ...grandMonthlyTotals, grandTotal],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    worksheet['!cols'] = [{ wch: 25 }, ...rMonths.map(() => ({ wch: 15 })), { wch: 15 }];
    formatExcelWorksheet(worksheet);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${config.name} Summary`);
    const filename = `${config.name}_Summary_${formatLoadMonthYear(rMonths[0])}.xlsx`;
    XLSX.writeFile(workbook, filename);
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
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" />
            5-Month Capacity & Load Forecasting
          </h2>
          <p className="text-xs text-base-content/60">
            Project pending machine allocations and departmental load requirements across a rolling 5-month horizon.
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

      {/* Control Card */}
      <div className="card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <span className="text-xs font-bold text-base-content/70">Start Month:</span>
          <select
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="select select-bordered select-sm font-bold text-xs"
          >
            {monthOptions.map((opt) => (
              <option key={opt.val} value={opt.val}>
                {opt.lbl}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-base-content/60">
          Projection Window:{' '}
          <span className="font-bold text-primary">
            {monthLabels[0]} &rarr; {monthLabels[4]}
          </span>
        </div>
      </div>

      {/* Tab 1: Detailed Load Download Cards */}
      {activeTab === 'detailed' ? (
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
                className="btn btn-primary btn-sm w-full gap-2 font-bold shadow-md shadow-primary/20"
              >
                {downloadingDept === d.key ? (
                  <InlineSpinner size={14} />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download {d.label} Excel
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Tab 2: Buyer-wise Summary Live Table */
        <div className="space-y-4">
          {/* Department Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {LOAD_DEPTS.map((d) => (
              <button
                key={d.key}
                onClick={() => setSelectedDept(d.key)}
                className={`btn btn-sm font-bold shrink-0 ${
                  selectedDept === d.key ? 'btn-primary' : 'btn-ghost bg-base-200/60'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Table Container */}
          <div className="card bg-base-100 border border-base-300 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-base-200">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {LOAD_DEPTS.find((d) => d.key === selectedDept)?.label} Buyer-Wise Load Summary
                </h3>
                <p className="text-xs text-base-content/60">
                  Allocated pending weight (Kg) aggregated by buyer across the 5 projection months.
                </p>
              </div>

              <button
                onClick={downloadSummaryExcel}
                disabled={summaryRows.length === 0}
                className="btn btn-success text-white btn-sm gap-2 font-bold shadow-md"
              >
                <Download className="h-4 w-4" />
                Export Summary Excel ({summaryRows.length} Buyers)
              </button>
            </div>

            {loading ? (
              <div className="p-16 flex items-center justify-center">
                <ExpLoadingSpinner
                  message="Loading Summary Data..."
                  subMessage="Please wait while data is being processed"
                  overlay={false}
                />
              </div>
            ) : summaryRows.length === 0 ? (
              <div className="p-16 text-center text-base-content/60">
                No active load allocation found for {selectedDept} in this 5-month window.
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="table table-xs w-full border border-base-300">
                  <thead className="bg-base-200/80 text-xs font-bold text-base-content">
                    <tr>
                      <th className="w-12 text-center">#</th>
                      <th className="px-4 py-2 text-left">Buyer Name</th>
                      {monthLabels.map((lbl) => (
                        <th key={lbl} className="px-4 py-2 text-right">
                          {lbl} [Kg]
                        </th>
                      ))}
                      <th className="px-4 py-2 text-right font-black bg-primary/10 text-primary">
                        Total [Kg]
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-base-200">
                    {summaryRows.map((r, i) => (
                      <tr key={r.buyer} className="hover:bg-base-200/40 transition-colors">
                        <td className="text-center font-bold text-base-content/40">{i + 1}</td>
                        <td className="font-bold text-base-content">{r.buyer}</td>
                        {r.monthlyValues.map((val, idx) => (
                          <td key={idx} className="text-right font-mono text-base-content/80">
                            {val > 0 ? Number(val).toLocaleString() : '—'}
                          </td>
                        ))}
                        <td className="text-right font-mono font-black text-primary bg-primary/5">
                          {Number(r.total).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Grand Totals Footer */}
                  <tfoot className="bg-base-200 font-extrabold text-xs">
                    <tr>
                      <td colSpan={2} className="text-center uppercase font-black text-primary">
                        GRAND TOTAL
                      </td>
                      {grandMonthlyTotals.map((tot, idx) => (
                        <td key={idx} className="text-right font-mono font-black text-base-content">
                          {Number(tot).toLocaleString()}
                        </td>
                      ))}
                      <td className="text-right font-mono font-black text-primary bg-primary/20 text-sm">
                        {Number(grandTotal).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
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
