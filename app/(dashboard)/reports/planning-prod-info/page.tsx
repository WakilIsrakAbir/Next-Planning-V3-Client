'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  Calendar,
  ClipboardCheck,
  Layers,
  Eye,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiClient } from '@/lib/api-client';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';
import ExpPagination from '@/components/common/ExpPagination';

// ==========================================
// Date & Calculation Helpers (matching Exp)
// ==========================================
function formatPPIDate(dateStr?: string | null): string {
  if (!dateStr || dateStr === '-' || dateStr === 'N/A' || dateStr === '—' || dateStr === 'undefined') return '—';
  // If already formatted like DD-MMM-YYYY
  if (/^\d{2}-[A-Za-z]{3,4}-\d{4}$/.test(String(dateStr))) return String(dateStr);
  const clean = String(dateStr).includes('T') ? dateStr : `${dateStr}T00:00:00`;
  const d = new Date(clean);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function calcPPILeadDay(planStr?: string | null, actStr?: string | null): string {
  if (!planStr || !actStr || planStr === '—' || actStr === '—' || planStr === '-' || actStr === '-') return '—';
  const pDate = new Date(String(planStr).includes('T') ? planStr : `${planStr}T00:00:00`);
  const aDate = new Date(String(actStr).includes('T') ? actStr : `${actStr}T00:00:00`);
  if (isNaN(pDate.getTime()) || isNaN(aDate.getTime())) return '—';
  const diffDays = Math.round((aDate.setHours(0, 0, 0, 0) - pDate.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `+${diffDays}`;
  if (diffDays === 0) return '0';
  return `${diffDays}`;
}

function getPPIOTTResult(planStr?: string | null, actStr?: string | null): { text: string; isPass: boolean; isFail: boolean } {
  if (!planStr || planStr === '—' || planStr === '-') return { text: '—', isPass: false, isFail: false };
  const pDate = new Date(String(planStr).includes('T') ? planStr : `${planStr}T00:00:00`);
  if (isNaN(pDate.getTime())) return { text: '—', isPass: false, isFail: false };

  if (actStr && actStr !== '—' && actStr !== '-') {
    const aDate = new Date(String(actStr).includes('T') ? actStr : `${actStr}T00:00:00`);
    if (!isNaN(aDate.getTime())) {
      const pass = aDate.setHours(0, 0, 0, 0) <= pDate.setHours(0, 0, 0, 0);
      return { text: pass ? 'Pass' : 'Fail', isPass: pass, isFail: !pass };
    }
  }

  // When actual is empty, check if plan date is past
  const today = new Date().setHours(0, 0, 0, 0);
  if (pDate.setHours(0, 0, 0, 0) < today) {
    return { text: 'Fail', isPass: false, isFail: true };
  }
  return { text: '—', isPass: false, isFail: false };
}

function ppiGetNum(item: any, fieldNames: string[]): number {
  if (!item) return 0;
  for (const f of fieldNames) {
    if (item[f] !== undefined && item[f] !== null && item[f] !== '') {
      const clean = String(item[f]).replace(/,/g, '').replace(/%/g, '').trim();
      const num = parseFloat(clean);
      if (!isNaN(num)) return num;
    }
  }
  const keys = Object.keys(item);
  for (const f of fieldNames) {
    const norm = f.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
    if (found && item[found] !== undefined && item[found] !== null && item[found] !== '') {
      const clean = String(item[found]).replace(/,/g, '').replace(/%/g, '').trim();
      const num = parseFloat(clean);
      if (!isNaN(num)) return num;
    }
  }
  return 0;
}

function ppiGetString(item: any, fieldNames: string[]): string {
  if (!item) return '';
  for (const f of fieldNames) {
    if (item[f] !== undefined && item[f] !== null && String(item[f]).trim() !== '') {
      return String(item[f]).trim();
    }
  }
  const keys = Object.keys(item);
  for (const f of fieldNames) {
    const norm = f.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
    if (found && item[found] !== undefined && item[found] !== null && String(item[found]).trim() !== '') {
      return String(item[found]).trim();
    }
  }
  return '';
}

export default function PlanningProdInfoPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Detailed view state
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [planData, setPlanData] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const res = await apiClient<{
          orders: any[];
          total: number;
          totalPages: number;
        }>(`/api/orders/all-list?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
        setOrders(res.orders || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
      } catch (err) {
        console.error('Failed to load orders for PPI:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [page, limit, search]);

  const loadOrderDetail = async (orderNo: string) => {
    setDetailLoading(true);
    try {
      const res = await apiClient<{ order: any; planData: any }>(
        `/api/orders/${encodeURIComponent(orderNo)}?dept=knitting`
      );
      setSelectedOrder(res.order || null);
      setPlanData(res.planData || null);
    } catch (err) {
      console.error('Failed to load order detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Section 2 Milestones Computation
  const milestoneData = useMemo(() => {
    if (!selectedOrder) return null;

    const o = selectedOrder;
    const pd = planData || {};

    let planKnitStart = o.knitStart;
    let planKnitEnd = o.knitEnd;
    let knitPlanType = 'T&A';
    if (pd.knitting && pd.knitting.length > 0) {
      const starts = pd.knitting
        .map((i: any) => i.startDate || i['Plan Start Date'] || i['Plan Start'] || i['Start Date'] || i['Knit Start Date'])
        .filter(Boolean)
        .sort();
      const ends = pd.knitting
        .map((i: any) => i.endDate || i['Plan End Date'] || i['Plan End'] || i['End Date'] || i['Knit End Date'])
        .filter(Boolean)
        .sort();
      if (starts.length) planKnitStart = starts[0];
      if (ends.length) planKnitEnd = ends[ends.length - 1];
      const savedType = pd.knitting.map((i: any) => i.planType).find(Boolean);
      if (savedType && savedType !== 'Select') knitPlanType = savedType;
    }

    let planDyeStart = o.dyeStart;
    let planDyeEnd = o.dyeEnd;
    let dyePlanType = 'T&A';
    if (pd.dyeing && pd.dyeing.length > 0) {
      const starts = pd.dyeing
        .map((i: any) => i.startDate || i['Plan Start Date'] || i['Plan Start'] || i['Start Date'] || i['Dyeing Start Date'])
        .filter(Boolean)
        .sort();
      const ends = pd.dyeing
        .map((i: any) => i.endDate || i['Plan End Date'] || i['Plan End'] || i['End Date'] || i['Dyeing End Date'])
        .filter(Boolean)
        .sort();
      if (starts.length) planDyeStart = starts[0];
      if (ends.length) planDyeEnd = ends[ends.length - 1];
      const savedType = pd.dyeing.map((i: any) => i.planType).find(Boolean);
      if (savedType && savedType !== 'Select') dyePlanType = savedType;
    }

    let planDeliStart = o.deliStart;
    let planDeliEnd = o.deliEnd;
    let deliPlanType = 'T&A';
    if (pd.delivery && pd.delivery.length > 0) {
      const floorItems = pd.delivery.filter((i: any) => {
        const type = i.floorPlanType || i['Delivery Plan Type (Floor)'] || '';
        return type === 'Confirm' || type === 'Tentative';
      });
      const sourceItems = floorItems.length ? floorItems : pd.delivery;
      const starts = sourceItems
        .map((i: any) => i.floorStartDate || i['Delivery Plan Start (Floor)'] || i.startDate || i['Delivery Plan Start'])
        .filter(Boolean)
        .sort();
      const ends = sourceItems
        .map((i: any) => i.floorEndDate || i['Delivery Plan End (Floor)'] || i.endDate || i['Delivery Plan End'])
        .filter(Boolean)
        .sort();
      if (starts.length) planDeliStart = starts[0];
      if (ends.length) planDeliEnd = ends[ends.length - 1];
      const savedType = sourceItems.map((i: any) => i.floorPlanType || i.planType).find(Boolean);
      if (savedType && savedType !== 'Select') deliPlanType = savedType;
    }

    let actYarnDate = '';
    if (pd.knitting && pd.knitting.length > 0) {
      const found = pd.knitting.map((i: any) => i.yarnDate).find(Boolean);
      if (found) actYarnDate = found;
    }
    if (!actYarnDate && pd.knittingActual && pd.knittingActual.yarnDate) {
      actYarnDate = pd.knittingActual.yarnDate;
    }

    const actKnit = pd.knittingActual || {};
    const actDye = pd.dyeingActual || {};
    const actDeli = pd.deliveryfloorActual || pd.deliveryActual || {};

    const fmtRsn = (reason?: string, dept?: string) => {
      if (!reason && !dept) return '—';
      if (reason && dept) return `${reason} - ${dept}`;
      return reason || dept || '—';
    };

    return {
      planned: {
        yarn: formatPPIDate(o.yarnDate),
        knitStart: formatPPIDate(planKnitStart),
        knitEnd: formatPPIDate(planKnitEnd),
        dyeStart: formatPPIDate(planDyeStart),
        dyeEnd: formatPPIDate(planDyeEnd),
        deliStart: formatPPIDate(planDeliStart),
        deliEnd: formatPPIDate(planDeliEnd),
      },
      planTypes: {
        yarn: 'T&A',
        knit: knitPlanType,
        dye: dyePlanType,
        deli: deliPlanType,
      },
      actual: {
        yarn: formatPPIDate(actYarnDate),
        knitStart: formatPPIDate(actKnit.actualStart),
        knitEnd: formatPPIDate(actKnit.actualEnd),
        dyeStart: formatPPIDate(actDye.actualStart),
        dyeEnd: formatPPIDate(actDye.actualEnd),
        deliStart: formatPPIDate(actDeli.actualStart),
        deliEnd: formatPPIDate(actDeli.actualEnd),
      },
      leadDays: {
        yarn: calcPPILeadDay(o.yarnDate, actYarnDate),
        knitStart: calcPPILeadDay(planKnitStart, actKnit.actualStart),
        knitEnd: calcPPILeadDay(planKnitEnd, actKnit.actualEnd),
        dyeStart: calcPPILeadDay(planDyeStart, actDye.actualStart),
        dyeEnd: calcPPILeadDay(planDyeEnd, actDye.actualEnd),
        deliStart: calcPPILeadDay(planDeliStart, actDeli.actualStart),
        deliEnd: calcPPILeadDay(planDeliEnd, actDeli.actualEnd),
      },
      ott: {
        yarn: getPPIOTTResult(o.yarnDate, actYarnDate),
        knitStart: getPPIOTTResult(planKnitStart, actKnit.actualStart),
        knitEnd: getPPIOTTResult(planKnitEnd, actKnit.actualEnd),
        dyeStart: getPPIOTTResult(planDyeStart, actDye.actualStart),
        dyeEnd: getPPIOTTResult(planDyeEnd, actDye.actualEnd),
        deliStart: getPPIOTTResult(planDeliStart, actDeli.actualStart),
        deliEnd: getPPIOTTResult(planDeliEnd, actDeli.actualEnd),
      },
      reasons: {
        yarn: '—',
        knit: fmtRsn(actKnit.failReason || actKnit.remarks, actKnit.relatedDept),
        dye: fmtRsn(actDye.failReason || actDye.remarks, actDye.relatedDept),
        deli: fmtRsn(actDeli.failReason || actDeli.remarks, actDeli.relatedDept),
      },
    };
  }, [selectedOrder, planData]);

  // Section 3 Color Summary Aggregation
  const colorSummary = useMemo(() => {
    if (!selectedOrder) return { colors: [], colorAggs: {}, metrics: [] };

    const kItems = selectedOrder.knittingItems || [];
    const dItems = selectedOrder.dyeingItems || [];
    const delItems = selectedOrder.deliveryItems || [];

    const getColorName = (item: any) => ppiGetString(item, ['Color', 'Colour', 'Fab Color', 'color', 'colour']);
    const colorMap = new Map<string, string>();

    [kItems, dItems, delItems].forEach((items) => {
      items.forEach((item: any) => {
        const col = getColorName(item);
        if (!col) return;
        const key = col.toLowerCase().replace(/\s+/g, ' ');
        if (!colorMap.has(key)) colorMap.set(key, col);
      });
    });

    const colors = Array.from(colorMap.entries()).map(([key, label], idx) => ({
      key,
      label: label || `Col-${idx + 1}`,
    }));

    const colorAggs: Record<string, any> = {};
    colors.forEach((col) => {
      colorAggs[col.key] = {
        allowances: [] as number[],
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
      };
    });

    kItems.forEach((item: any) => {
      const colName = getColorName(item);
      if (!colName) return;
      const key = colName.toLowerCase().replace(/\s+/g, ' ');
      const agg = colorAggs[key];
      if (!agg) return;

      const allow = ppiGetNum(item, ['Wastage %', 'Wastage', 'Allowance %', 'Allowance']);
      if (allow > 0) agg.allowances.push(allow > 1 ? allow / 100 : allow);

      agg.allocQty += ppiGetNum(item, ['Allocated Qty', 'Allocated Qty ', 'AllocatedQty']);
      agg.yarnBal += ppiGetNum(item, ['Yarn bala.', 'Yarn Bala', 'YarnBala', 'Yarn Balance']);
      agg.knitProd += ppiGetNum(item, ['Knit Prod.', 'KnitProd', 'Knit Production']);
      agg.knitBal += ppiGetNum(item, ['Knit. Bala.', 'KnitBala', 'Knit Bala', 'Knit Balance']);
    });

    dItems.forEach((item: any) => {
      const colName = getColorName(item);
      if (!colName) return;
      const key = colName.toLowerCase().replace(/\s+/g, ' ');
      const agg = colorAggs[key];
      if (!agg) return;

      agg.dyeOk += ppiGetNum(item, ['Dyeing ok', 'Dyeing Prod.', 'DyeingProd']);
      agg.dyeBal += ppiGetNum(item, ['Dyeing Bal.', 'Dyeing Bala.', 'DyeingBala']);
    });

    delItems.forEach((item: any) => {
      const colName = getColorName(item);
      if (!colName) return;
      const key = colName.toLowerCase().replace(/\s+/g, ' ');
      const agg = colorAggs[key];
      if (!agg) return;

      agg.bookingQty += ppiGetNum(item, ['RequiredQtyKgs', 'Required Qty Kgs', 'Booking qty', 'Required Qty']);
      agg.receivedQty += ppiGetNum(item, ['NetReceivedQtyKgs', 'Net Received Qty', 'Received Qty']);
      agg.deliveredQty += ppiGetNum(item, ['NetDeliveryQtyKgs', 'Net Delivery Qty', 'Delivered Qty']);
      agg.deliBal += ppiGetNum(item, ['Deli. Bal.', 'Deli. Bala.', 'DeliBal', 'Delivery Balance']);
      agg.rfd += ppiGetNum(item, ['RFD']);
      agg.slowMoving += ppiGetNum(item, ['Slowmoving', 'Slow Moving', 'SlowMoving']);
    });

    const metrics = [
      {
        label: 'Allowance %',
        isPercent: true,
        isAvg: true,
        getValue: (agg: any) =>
          agg.allowances.length ? agg.allowances.reduce((a: number, b: number) => a + b, 0) / agg.allowances.length : 0,
      },
      { label: 'Allocated Qty', getValue: (agg: any) => agg.allocQty },
      { label: 'Yarn bala.', getValue: (agg: any) => agg.yarnBal },
      { label: 'Knit Prod.', getValue: (agg: any) => agg.knitProd },
      { label: 'Knit. Bala.', getValue: (agg: any) => agg.knitBal },
      { label: 'Dyeing ok', getValue: (agg: any) => agg.dyeOk },
      { label: 'Dyeing Bal.', getValue: (agg: any) => agg.dyeBal },
      { label: 'Booking qty', getValue: (agg: any) => agg.bookingQty },
      { label: 'Received Qty.', getValue: (agg: any) => agg.receivedQty },
      { label: 'Delivered Qty', getValue: (agg: any) => agg.deliveredQty },
      { label: 'Deli. Bala.', getValue: (agg: any) => agg.deliBal },
      { label: 'RFD', getValue: (agg: any) => agg.rfd },
      { label: 'Slow moving', getValue: (agg: any) => agg.slowMoving },
    ];

    return { colors, colorAggs, metrics };
  }, [selectedOrder]);

  // Excel Export
  const handleExportExcel = () => {
    if (!selectedOrder || !milestoneData) return;

    const o = selectedOrder;
    const { colors, colorAggs, metrics } = colorSummary;

    const sheetData: any[][] = [
      ['BOOKING SPECIFICATION'],
      ['Booking No.', o.orderNo || '', '', 'Buyer Name', o.buyer || '', '', 'Buyer Team', o.buyerTeam || ''],
      [
        'Booking Date',
        formatPPIDate(o.bookingDate),
        '',
        'Event Day',
        o.eventDay ?? '',
        '',
        'Style',
        o.style || o.Style || '',
      ],
      ['PMC', o.pmc || '', '', 'Merchant', o.bookingBy || o.bookedBy || '', '', 'Unit', o.floor || o.unit || 'EFL'],
      [
        'Gmt Unit',
        o.gmtUnit ?? '',
        '',
        'Program type',
        o.programType || 'SOLID',
        '',
        'Order Qty (KG)',
        o.requiredQtyKgs ? `${Number(o.requiredQtyKgs).toLocaleString()} KG` : '',
      ],
      ['Batch Plan', o.bpStatus || 'Pending', '', 'Body Fabric', o.bodyFabric || '', '', 'Body GSM', o.bodyGsm ?? ''],
      ['Brush', o.brush || 'No', '', 'Peach', o.peach || 'No', '', 'Heatset', o.heatset || 'No'],
      [
        'ALD',
        o.ald || (o.eventDay ? `${o.eventDay} ok out of ${o.eventDay}` : ''),
        '',
        'PMC Notes',
        o.pmcNotes || '',
        '',
        'Fabric Notes',
        o.fabricNotes || '',
      ],
      [],
      ['BOOKING PLANNING (MILESTONES & PLAN VS ACTUAL)'],
      ['Timeline Phase', 'Yarn Date', 'Knit Start', 'Knit End', 'Dye Start', 'Dye End', 'Deli Start (Floor)', 'Deli End (Floor)'],
      [
        'Planned',
        milestoneData.planned.yarn,
        milestoneData.planned.knitStart,
        milestoneData.planned.knitEnd,
        milestoneData.planned.dyeStart,
        milestoneData.planned.dyeEnd,
        milestoneData.planned.deliStart,
        milestoneData.planned.deliEnd,
      ],
      [
        'Plan Type',
        milestoneData.planTypes.yarn,
        milestoneData.planTypes.knit,
        milestoneData.planTypes.knit,
        milestoneData.planTypes.dye,
        milestoneData.planTypes.dye,
        milestoneData.planTypes.deli,
        milestoneData.planTypes.deli,
      ],
      [
        'Actual',
        milestoneData.actual.yarn,
        milestoneData.actual.knitStart,
        milestoneData.actual.knitEnd,
        milestoneData.actual.dyeStart,
        milestoneData.actual.dyeEnd,
        milestoneData.actual.deliStart,
        milestoneData.actual.deliEnd,
      ],
      [
        'Lead Day',
        milestoneData.leadDays.yarn,
        milestoneData.leadDays.knitStart,
        milestoneData.leadDays.knitEnd,
        milestoneData.leadDays.dyeStart,
        milestoneData.leadDays.dyeEnd,
        milestoneData.leadDays.deliStart,
        milestoneData.leadDays.deliEnd,
      ],
      [
        'OTT Result',
        milestoneData.ott.yarn.text,
        milestoneData.ott.knitStart.text,
        milestoneData.ott.knitEnd.text,
        milestoneData.ott.dyeStart.text,
        milestoneData.ott.dyeEnd.text,
        milestoneData.ott.deliStart.text,
        milestoneData.ott.deliEnd.text,
      ],
      [
        'Reason & Dept',
        milestoneData.reasons.yarn,
        milestoneData.reasons.knit,
        '',
        milestoneData.reasons.dye,
        '',
        milestoneData.reasons.deli,
        '',
      ],
      [],
      ['DETAILS BOOKING SUMMARY (COLOR-WISE)'],
      ['Color', ...metrics.map((m) => m.label)],
    ];

    colors.forEach((col) => {
      const agg = colorAggs[col.key] || {};
      const row: any[] = [col.label];
      metrics.forEach((m) => {
        const v = m.getValue(agg);
        row.push(m.isPercent ? `${(v * 100).toFixed(0)}%` : Math.round(v));
      });
      sheetData.push(row);
    });

    // Total row
    const totalRow: any[] = ['Total'];
    metrics.forEach((m) => {
      const vals = colors.map((col) => m.getValue(colorAggs[col.key]));
      const total = m.isAvg
        ? vals.filter((v) => v > 0).length
          ? vals.reduce((a, b) => a + b, 0) / vals.filter((v) => v > 0).length
          : 0
        : vals.reduce((a, b) => a + b, 0);
      totalRow.push(m.isPercent ? `${(total * 100).toFixed(0)}%` : Math.round(total));
    });
    sheetData.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planning_Production_Info');
    XLSX.writeFile(wb, `Planning_Production_Info_${o.orderNo}.xlsx`);
  };

  const renderPlanTypeBadge = (type: string) => {
    if (!type || type === '—' || type === '-') return '—';
    const t = String(type).trim();
    let colorClass = 'bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200';
    if (t === 'Confirm')
      colorClass =
        'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
    else if (t === 'Tentative')
      colorClass =
        'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
    else if (t === 'T&A') colorClass = 'bg-slate-200/90 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold';
    return <span className={`inline-block px-3 py-0.5 rounded ${colorClass} font-bold text-[11px] shadow-xs`}>{t}</span>;
  };

  return (
    <div className="space-y-6">
      {!selectedOrder ? (
        <>
          {/* List Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                Planning & Production Info (PPI)
              </h2>
              <p className="text-xs text-base-content/60">
                Select an order to view the 3-section comprehensive specification and milestone report.
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search Booking / Order No..."
                className="input input-bordered input-sm w-48 sm:w-64 pl-8 text-xs"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/50" />
            </div>
          </div>

          {/* Order List Table */}
          <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden relative min-h-[360px]">
            {loading && (
              <ExpLoadingSpinner
                message="Processing PPI Records..."
                subMessage="Fetching 3-section order specifications"
              />
            )}

            <div className="overflow-x-auto flex-1">
              <table className="table table-sm w-full">
                <thead className="bg-base-200/60 text-xs font-extrabold uppercase">
                  <tr>
                    <th className="text-center w-16">View</th>
                    <th>Booking No. / Order No.</th>
                    <th>Buyer Name</th>
                    <th>Booking Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-base-200">
                  {!loading && orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-base-content/60">
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    orders.map((ord) => (
                      <tr key={ord._id || ord.orderNo} className="hover">
                        <td className="text-center">
                          <button
                            onClick={() => loadOrderDetail(ord.orderNo)}
                            className="btn btn-xs btn-primary btn-outline"
                            title="Open 3-Section PPI Report"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="font-mono font-bold text-primary">{ord.orderNo}</td>
                        <td className="font-semibold uppercase text-[11px]">{ord.buyer || 'N/A'}</td>
                        <td>{formatPPIDate(ord.bookingDate)}</td>
                        <td>
                          <span className="badge badge-sm badge-outline font-bold">{ord.status || 'Active'}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Exact Exp Pagination Bar */}
            <ExpPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              limit={limit}
              onPageChange={(newPage) => setPage(newPage)}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {/* Action Toolbar with Filled Color Back Button (Exact Exp Parity) */}
          <div className="no-print bg-base-100 border border-base-300 rounded-lg flex items-center justify-between px-4 py-3 shrink-0 shadow-xs flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Detailed Planning & Production Info
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                  Booking #{selectedOrder.orderNo}
                </span>
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel Download
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>

          {detailLoading ? (
            <div className="p-16 text-center">
              <ExpLoadingSpinner message="Loading Report Details..." subMessage="Preparing specification and planning milestones" size="sm" overlay={false} />
            </div>
          ) : (
            <div className="max-w-6xl mx-auto bg-base-100 rounded-xl shadow-xs border border-base-300 p-3 sm:p-6 space-y-6">
              {/* ================= 1. BOOKING SPECIFICATION (Deep Indigo Blue Header) ================= */}
              <section className="w-full">
                <div className="bg-[#1e40af] text-white px-4 py-2.5 rounded-t-lg font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between shadow-xs">
                  <span className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4" /> Booking Specification
                  </span>
                  <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded">
                    General & Technical Specs
                  </span>
                </div>
                <div className="overflow-x-auto border border-t-0 border-base-300 rounded-b-lg">
                  <table className="w-full text-xs border-collapse">
                    <tbody className="divide-y divide-base-200">
                      {/* Row 1: Booking No. | Buyer Name | Buyer Team */}
                      <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-100">
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Booking No.
                        </td>
                        <td className="p-2 font-black text-blue-600 dark:text-blue-400 border-b md:border-b-0 md:border-r border-base-300 font-mono flex items-center">
                          {selectedOrder.orderNo || '—'}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Buyer Name
                        </td>
                        <td className="p-2 font-black border-b md:border-b-0 md:border-r border-base-300 flex items-center">
                          {selectedOrder.buyer || '—'}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Buyer Team
                        </td>
                        <td className="p-2 font-medium border-b md:border-b-0 border-base-300 flex items-center">
                          {selectedOrder.buyerTeam || '—'}
                        </td>
                      </tr>

                      {/* Row 2: Booking Date | Event Day | Style */}
                      <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-200/30">
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Booking Date
                        </td>
                        <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                          {formatPPIDate(selectedOrder.bookingDate)}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Event Day
                        </td>
                        <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                          {selectedOrder.eventDay ?? '—'}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Style
                        </td>
                        <td className="p-2 font-bold text-blue-600 dark:text-blue-400 border-b md:border-b-0 border-base-300 flex items-center">
                          {selectedOrder.style || selectedOrder.Style || '—'}
                        </td>
                      </tr>

                      {/* Row 3: PMC | Merchant | Unit */}
                      <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-100">
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          PMC
                        </td>
                        <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                          {selectedOrder.pmc || '—'}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Merchant
                        </td>
                        <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                          {selectedOrder.bookingBy || selectedOrder.bookedBy || '—'}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Unit
                        </td>
                        <td className="p-2 border-b md:border-b-0 border-base-300 font-medium flex items-center">
                          {selectedOrder.floor || selectedOrder.unit || 'EFL'}
                        </td>
                      </tr>

                      {/* Row 4: Gmt Unit | Program Type | Order Qty (KG) */}
                      <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-200/30">
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Gmt Unit
                        </td>
                        <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                          {selectedOrder.gmtUnit !== undefined && selectedOrder.gmtUnit !== null ? String(selectedOrder.gmtUnit) : '—'}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Program Type
                        </td>
                        <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                          {selectedOrder.programType || selectedOrder['Program type'] || 'SOLID'}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Order Qty (KG)
                        </td>
                        <td className="p-2 font-black text-emerald-600 dark:text-emerald-400 border-b md:border-b-0 border-base-300 flex items-center font-mono">
                          {selectedOrder.requiredQtyKgs ? `${Number(selectedOrder.requiredQtyKgs).toLocaleString()} KG` : '—'}
                        </td>
                      </tr>

                      {/* Row 5: Batch Plan | Body Fabric | Body GSM */}
                      <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-100">
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Batch Plan
                        </td>
                        <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                          {selectedOrder.bpStatus || 'Pending'}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Body Fabric
                        </td>
                        <td className="p-2 font-medium border-b md:border-b-0 md:border-r border-base-300 truncate flex items-center">
                          {selectedOrder.bodyFabric || selectedOrder['Body Fabric'] || '—'}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Body GSM
                        </td>
                        <td className="p-2 font-medium border-b md:border-b-0 border-base-300 flex items-center font-mono">
                          {selectedOrder.bodyGsm !== undefined && selectedOrder.bodyGsm !== null && selectedOrder.bodyGsm !== '' ? String(selectedOrder.bodyGsm) : '—'}
                        </td>
                      </tr>

                      {/* Row 6: Brush | Peach | Heatset */}
                      <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-200/30">
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Brush
                        </td>
                        <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                          {selectedOrder.brush || selectedOrder['Brush'] || 'No'}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Peach
                        </td>
                        <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                          {selectedOrder.peach || selectedOrder['Peach'] || 'No'}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Heatset
                        </td>
                        <td className="p-2 border-b md:border-b-0 border-base-300 font-medium flex items-center">
                          {selectedOrder.heatset || selectedOrder['Heatset'] || 'No'}
                        </td>
                      </tr>

                      {/* Row 7: ALD | PMC Notes | Fabric Notes */}
                      <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-100">
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          ALD
                        </td>
                        <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                          {selectedOrder.ald || selectedOrder['ALD'] || (selectedOrder.eventDay ? `${selectedOrder.eventDay} ok out of ${selectedOrder.eventDay}` : '—')}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          PMC Notes
                        </td>
                        <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium truncate flex items-center">
                          {selectedOrder.pmcNotes || selectedOrder['PMC Notes'] || selectedOrder.fabricNotes || '—'}
                        </td>
                        <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                          Fabric Notes
                        </td>
                        <td className="p-2 border-b md:border-b-0 border-base-300 font-medium truncate flex items-center">
                          {selectedOrder.fabricNotes || '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ================= 2. BOOKING PLANNING (Cyan/Slate Teal Header) ================= */}
              {milestoneData && (
                <section className="w-full">
                  <div className="bg-[#0e7490] text-white px-4 py-2.5 rounded-t-lg font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between shadow-xs">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Booking Planning (Milestones & Plan vs Actual)
                    </span>
                    <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded">
                      Timeline Review
                    </span>
                  </div>
                  <div className="overflow-x-auto border border-t-0 border-base-300 rounded-b-lg">
                    <table className="w-full text-xs min-w-[760px] border-collapse text-center">
                      <thead className="bg-cyan-100/80 dark:bg-cyan-950/60 text-cyan-950 dark:text-cyan-200 font-extrabold border-b border-base-300">
                        <tr>
                          <th className="p-2.5 border-r border-base-300 text-left w-36 bg-cyan-200/80 dark:bg-cyan-900/80 font-black">
                            Timeline Phase
                          </th>
                          <th className="p-2.5 border-r border-base-300">Yarn Date</th>
                          <th className="p-2.5 border-r border-base-300">Knit Start</th>
                          <th className="p-2.5 border-r border-base-300">Knit End</th>
                          <th className="p-2.5 border-r border-base-300">Dye Start</th>
                          <th className="p-2.5 border-r border-base-300">Dye End</th>
                          <th className="p-2.5 border-r border-base-300">Deli Start (Floor)</th>
                          <th className="p-2.5">Deli End (Floor)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-200 font-medium">
                        {/* Planned */}
                        <tr className="bg-base-100 hover:bg-cyan-50/30">
                          <td className="p-2 font-bold text-left bg-base-200/60 text-blue-700 dark:text-blue-400 border-r border-base-300">
                            Planned
                          </td>
                          <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.planned.yarn}</td>
                          <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.planned.knitStart}</td>
                          <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.planned.knitEnd}</td>
                          <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.planned.dyeStart}</td>
                          <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.planned.dyeEnd}</td>
                          <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.planned.deliStart}</td>
                          <td className="p-2 font-medium font-mono">{milestoneData.planned.deliEnd}</td>
                        </tr>

                        {/* Plan Type */}
                        <tr className="bg-base-200/30 hover:bg-cyan-50/30">
                          <td className="p-2 font-bold text-left bg-base-200/60 text-indigo-700 dark:text-indigo-400 border-r border-base-300">
                            Plan Type
                          </td>
                          <td className="p-2 border-r border-base-300">
                            {renderPlanTypeBadge(milestoneData.planTypes.yarn)}
                          </td>
                          <td className="p-2 border-r border-base-300 text-center" colSpan={2}>
                            {renderPlanTypeBadge(milestoneData.planTypes.knit)}
                          </td>
                          <td className="p-2 border-r border-base-300 text-center" colSpan={2}>
                            {renderPlanTypeBadge(milestoneData.planTypes.dye)}
                          </td>
                          <td className="p-2 text-center" colSpan={2}>
                            {renderPlanTypeBadge(milestoneData.planTypes.deli)}
                          </td>
                        </tr>

                        {/* Actual */}
                        <tr className="bg-base-100 hover:bg-cyan-50/40">
                          <td className="p-2 font-bold text-left bg-base-200/60 text-emerald-700 dark:text-emerald-400 border-r border-base-300">
                            Actual
                          </td>
                          <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.actual.yarn}</td>
                          <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.actual.knitStart}</td>
                          <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.actual.knitEnd}</td>
                          <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.actual.dyeStart}</td>
                          <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.actual.dyeEnd}</td>
                          <td className="p-2 border-r border-base-300 font-medium font-mono">{milestoneData.actual.deliStart}</td>
                          <td className="p-2 font-medium font-mono">{milestoneData.actual.deliEnd}</td>
                        </tr>

                        {/* Lead Day */}
                        <tr className="bg-base-200/30 hover:bg-cyan-50/30">
                          <td className="p-2 font-black text-left bg-base-200/60 text-teal-800 dark:text-teal-300 border-r border-base-300">
                            Lead Day
                          </td>
                          <td className="p-2 border-r border-base-300 font-bold font-mono">{milestoneData.leadDays.yarn}</td>
                          <td className="p-2 border-r border-base-300 font-bold font-mono">{milestoneData.leadDays.knitStart}</td>
                          <td className="p-2 border-r border-base-300 font-bold font-mono">{milestoneData.leadDays.knitEnd}</td>
                          <td className="p-2 border-r border-base-300 font-bold font-mono">{milestoneData.leadDays.dyeStart}</td>
                          <td className="p-2 border-r border-base-300 font-bold font-mono">{milestoneData.leadDays.dyeEnd}</td>
                          <td className="p-2 border-r border-base-300 font-bold font-mono">{milestoneData.leadDays.deliStart}</td>
                          <td className="p-2 font-bold font-mono">{milestoneData.leadDays.deliEnd}</td>
                        </tr>

                        {/* OTT Result */}
                        <tr className="bg-base-100 hover:bg-cyan-50/40">
                          <td className="p-2 font-bold text-left bg-base-200/60 border-r border-base-300">
                            OTT Result
                          </td>
                          {[
                            milestoneData.ott.yarn,
                            milestoneData.ott.knitStart,
                            milestoneData.ott.knitEnd,
                            milestoneData.ott.dyeStart,
                            milestoneData.ott.dyeEnd,
                            milestoneData.ott.deliStart,
                            milestoneData.ott.deliEnd,
                          ].map((ott, i) => (
                            <td key={i} className={`p-2 border-r border-base-300 font-black ${i === 6 ? 'border-r-0' : ''}`}>
                              {ott.isPass ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-black">Pass</span>
                              ) : ott.isFail ? (
                                <span className="text-rose-600 dark:text-rose-400 font-black">Fail</span>
                              ) : (
                                '—'
                              )}
                            </td>
                          ))}
                        </tr>

                        {/* Reason & Dept */}
                        <tr className="bg-base-200/30 hover:bg-cyan-50/30">
                          <td className="p-2 font-bold text-left bg-base-200/60 border-r border-base-300">
                            Reason & Dept
                          </td>
                          <td className="p-2 border-r border-base-300 text-[11px] text-base-content/60">{milestoneData.reasons.yarn}</td>
                          <td className="p-2 border-r border-base-300 text-[11px] font-medium" colSpan={2}>
                            {milestoneData.reasons.knit}
                          </td>
                          <td className="p-2 border-r border-base-300 text-[11px] font-medium" colSpan={2}>
                            {milestoneData.reasons.dye}
                          </td>
                          <td className="p-2 text-[11px] font-medium" colSpan={2}>
                            {milestoneData.reasons.deli}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* ================= 3. DETAILS BOOKING SUMMARY (Warm Amber Header) ================= */}
              <section className="w-full">
                <div className="bg-[#b45309] text-white px-4 py-2.5 rounded-t-lg font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between shadow-xs">
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Details Booking Summary (Color-Wise)
                  </span>
                  <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded">
                    {colorSummary.colors.length} {colorSummary.colors.length === 1 ? 'Color' : 'Colors'}
                  </span>
                </div>
                <div className="overflow-x-auto border border-t-0 border-base-300 rounded-b-lg">
                  <table className="w-full text-xs min-w-[1100px] border-collapse whitespace-nowrap">
                    <thead className="bg-amber-100/90 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-b border-base-300">
                      <tr>
                        <th className="p-2.5 text-left border-r border-base-300 font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 min-w-[100px]">
                          Color
                        </th>
                        {colorSummary.metrics.map((m) => (
                          <th
                            key={m.label}
                            className="p-2.5 border-r border-base-300 text-center font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 whitespace-nowrap min-w-[85px]"
                          >
                            {m.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200">
                      {colorSummary.colors.length === 0 ? (
                        <tr>
                          <td colSpan={colorSummary.metrics.length + 1} className="p-6 text-center text-xs text-base-content/50 font-medium">
                            No color data found for this order.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {colorSummary.colors.map((col, idx) => {
                            const isShaded = idx % 2 === 1;
                            const agg = colorSummary.colorAggs[col.key] || {};

                            return (
                              <tr
                                key={col.key}
                                className={`${isShaded ? 'bg-base-200/30' : 'bg-base-100'} hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors`}
                              >
                                <td className="p-2 font-bold border-r border-base-300 text-left">
                                  {col.label}
                                </td>
                                {colorSummary.metrics.map((m) => {
                                  const v = m.getValue(agg);
                                  const fmtVal = m.isPercent ? `${(v * 100).toFixed(0)}%` : Math.round(v).toLocaleString();
                                  return (
                                    <td key={m.label} className="p-2 border-r border-base-300 text-center font-mono font-medium">
                                      {fmtVal}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}

                          {/* Total Summary Footer Row */}
                          <tr className="bg-amber-100/90 dark:bg-amber-950/80 text-amber-950 dark:text-amber-100 font-black border-t-2 border-base-300">
                            <td className="p-2 font-black border-r border-base-300 text-left uppercase">
                              Total
                            </td>
                            {colorSummary.metrics.map((m) => {
                              const vals = colorSummary.colors.map((col) => m.getValue(colorSummary.colorAggs[col.key]));
                              const total = m.isAvg
                                ? vals.filter((v) => v > 0).length
                                  ? vals.reduce((a, b) => a + b, 0) / vals.filter((v) => v > 0).length
                                  : 0
                                : vals.reduce((a, b) => a + b, 0);
                              const fmtTotal = m.isPercent ? `${(total * 100).toFixed(0)}%` : Math.round(total).toLocaleString();
                              return (
                                <td key={m.label} className="p-2 border-r border-base-300 text-center font-mono font-black">
                                  {fmtTotal}
                                </td>
                              );
                            })}
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
