'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Search,
  ChevronRight,
  ChevronDown,
  Download,
  RefreshCw,
  Printer,
  Table as TableIcon,
  Palette,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiClient } from '@/lib/api-client';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';
import ExpPagination from '@/components/common/ExpPagination';

// ==========================================
// Helper Functions for Robust Data Mapping
// ==========================================
function getColData(item: any, candidates: string[], defaultValue: any = ''): any {
  if (!item) return defaultValue;

  // 1. Exact property match
  for (const c of candidates) {
    if (item[c] !== undefined && item[c] !== null && item[c] !== '') return item[c];
  }

  // 2. Trimmed property match
  const keys = Object.keys(item);
  for (const c of candidates) {
    const trimmedC = c.trim();
    const found = keys.find((k) => k.trim() === trimmedC);
    if (found && item[found] !== undefined && item[found] !== null && item[found] !== '') {
      return item[found];
    }
  }

  // 3. Case-insensitive and punctuation-free fuzzy match
  for (const c of candidates) {
    const normC = c.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normC);
    if (found && item[found] !== undefined && item[found] !== null && item[found] !== '') {
      return item[found];
    }
  }

  return defaultValue;
}

function parseNum(val: any): number | null {
  if (val === undefined || val === null || val === '' || val === '-' || val === '—') return null;
  const clean = String(val).replace(/,/g, '').replace(/%/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function formatNumDisplay(val: any, percent: boolean = false): string {
  const n = parseNum(val);
  if (n === null) return '—';
  if (percent) {
    const p = n <= 1 && n > 0 ? n * 100 : n;
    return `${p.toLocaleString('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: p % 1 === 0 ? 0 : 1,
    })}%`;
  }
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Metric Rules matching Exp prod-info.js
interface MetricRule {
  label: string;
  source: 'knitting' | 'dyeing' | 'delivery';
  fields: string[];
  mode: 'average' | 'sum';
  percent?: boolean;
}

const PI_METRIC_RULES: MetricRule[] = [
  {
    label: 'Allowance',
    source: 'knitting',
    fields: ['Allowance', 'Allowance %', 'Allow'],
    mode: 'average',
    percent: true,
  },
  {
    label: 'Allocated Qty',
    source: 'knitting',
    fields: ['Allocated Qty', 'Allocated Qty ', 'AllocatedQty', 'Alloc Qty'],
    mode: 'sum',
  },
  {
    label: 'Yarn bala.',
    source: 'knitting',
    fields: ['Yarn bala.', 'Yarn Bala', 'YarnBala', 'Yarn Balance'],
    mode: 'sum',
  },
  {
    label: 'Knit Prod.',
    source: 'knitting',
    fields: ['Knit Prod.', 'KnitProd', 'Knit Production', 'Knit Prod'],
    mode: 'sum',
  },
  {
    label: 'Knit. Bala.',
    source: 'knitting',
    fields: ['Knit. Bala.', 'KnitBala', 'Knit Bala', 'Knit Balance', 'Knit. Bal.'],
    mode: 'sum',
  },
  {
    label: 'Dyeing ok',
    source: 'dyeing',
    fields: ['Dyeing ok', 'Dyeing Prod.', 'DyeingProd', 'Dyeing Prod', 'Dyeing Production'],
    mode: 'sum',
  },
  {
    label: 'Dyeing Bal.',
    source: 'dyeing',
    fields: ['Dyeing Bal.', 'Dyeing Bala.', 'DyeingBala', 'Dyeing Balance', 'Dye Bal'],
    mode: 'sum',
  },
  {
    label: 'RequiredQtyKgs',
    source: 'delivery',
    fields: ['RequiredQtyKgs', 'Required Qty Kgs', 'Required Qty', 'Req Qty', 'Qty'],
    mode: 'sum',
  },
  {
    label: 'NetReceivedQtyKgs',
    source: 'delivery',
    fields: ['NetReceivedQtyKgs', 'Net Received Qty Kgs', 'Net Received Qty', 'Received Qty'],
    mode: 'sum',
  },
  {
    label: 'NetDeliveryQtyKgs',
    source: 'delivery',
    fields: ['NetDeliveryQtyKgs', 'Net Delivery Qty Kgs', 'NetDeliveryQty', 'Delivery Qty', 'DeliveryQty'],
    mode: 'sum',
  },
  {
    label: 'Deli. Bala.',
    source: 'delivery',
    fields: ['Deli. Bala.', 'Deli. Bal.', 'DeliBal', 'Deli Bal.', 'Delivery Balance', 'Deli Bal'],
    mode: 'sum',
  },
  { label: 'RFD', source: 'delivery', fields: ['RFD'], mode: 'sum' },
  {
    label: 'Slowmoving',
    source: 'delivery',
    fields: ['Slowmoving', 'Slow Moving', 'SlowMoving'],
    mode: 'sum',
  },
  {
    label: 'FF Stock',
    source: 'delivery',
    fields: ['FF Stock', 'FFStock', 'FF_Stock'],
    mode: 'sum',
  },
];

export default function ProductInfoPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Expanded row details
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'breakdown' | 'matrix'>('breakdown');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await apiClient<{
        orders: any[];
        total: number;
        totalPages: number;
      }>(`/api/orders/all-list?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
      setOrders(res.orders || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch product info orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, limit, search]);

  const toggleExpand = async (orderNo: string) => {
    if (expandedOrder === orderNo) {
      setExpandedOrder(null);
      setOrderDetails(null);
      return;
    }

    setExpandedOrder(orderNo);
    try {
      setLoadingDetails(true);
      const res = await apiClient<{ order: any }>(`/api/orders/${encodeURIComponent(orderNo)}?dept=knitting`);
      setOrderDetails(res.order || null);
    } catch (err) {
      console.error('Failed to load order specs:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Get active items list for itemized fabric table
  const fabricItems = useMemo(() => {
    if (!orderDetails) return [];
    if (orderDetails.knittingItems && orderDetails.knittingItems.length > 0) {
      return orderDetails.knittingItems;
    }
    if (orderDetails.dyeingItems && orderDetails.dyeingItems.length > 0) {
      return orderDetails.dyeingItems;
    }
    if (orderDetails.deliveryItems && orderDetails.deliveryItems.length > 0) {
      return orderDetails.deliveryItems;
    }
    if (orderDetails.finishingItems && orderDetails.finishingItems.length > 0) {
      return orderDetails.finishingItems;
    }
    return orderDetails.ydItems || [];
  }, [orderDetails]);

  // Compute Color-Wise Specification Matrix (Exp logic)
  const matrixData = useMemo(() => {
    if (!orderDetails) return { colors: [], metricResults: [] };

    const rawKnittingItems = orderDetails.knittingItems || [];
    const rawDyeingItems = orderDetails.dyeingItems || [];
    const rawDeliveryItems = orderDetails.deliveryItems || [];

    const getColor = (item: any) =>
      String(getColData(item, ['Color', 'Colour', 'Fab Color', 'color', 'colour'])).trim();

    const colorMap = new Map<string, string>();
    [rawKnittingItems, rawDyeingItems, rawDeliveryItems].forEach((items) => {
      items.forEach((item: any) => {
        const color = getColor(item);
        if (!color) return;
        const ck = color.toLowerCase().replace(/\s+/g, ' ');
        if (!colorMap.has(ck)) colorMap.set(ck, color);
      });
    });

    const colors = [...colorMap.entries()].map(([key, label]) => ({ key, label }));

    const getItemsBySource = (source: string) => {
      if (source === 'knitting' && rawKnittingItems.length > 0) return rawKnittingItems;
      if (source === 'dyeing' && rawDyeingItems.length > 0) return rawDyeingItems;
      if (source === 'delivery' && rawDeliveryItems.length > 0) return rawDeliveryItems;
      if (rawKnittingItems.length > 0) return rawKnittingItems;
      if (rawDyeingItems.length > 0) return rawDyeingItems;
      if (rawDeliveryItems.length > 0) return rawDeliveryItems;
      return [];
    };

    const metricResults = PI_METRIC_RULES.map((metric) => {
      const items = getItemsBySource(metric.source);
      const colorValues = colors.map((c) => {
        const matchingItems = items.filter((item: any) => {
          const color = getColor(item).toLowerCase().replace(/\s+/g, ' ');
          return color === c.key;
        });

        if (matchingItems.length === 0) return null;

        let sum = 0;
        let count = 0;
        matchingItems.forEach((item: any) => {
          const raw = getColData(item, metric.fields, null);
          const val = parseNum(raw);
          if (val !== null) {
            sum += val;
            count++;
          }
        });

        if (count === 0) return null;
        return metric.mode === 'average' ? sum / count : sum;
      });

      const presentValues = colorValues.filter((v): v is number => v !== null && Number.isFinite(v));
      let total: number | null = null;
      if (presentValues.length > 0) {
        total =
          metric.mode === 'average'
            ? presentValues.reduce((a, b) => a + b, 0) / presentValues.length
            : presentValues.reduce((a, b) => a + b, 0);
      }

      return {
        label: metric.label,
        values: colorValues,
        total,
        percent: metric.percent || false,
      };
    });

    return { colors, metricResults };
  }, [orderDetails]);

  // Excel download handler
  const handleDownloadExcel = () => {
    if (!orderDetails) return;

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
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Product Info (Color-wise Specification)
          </h2>
          <p className="text-xs text-base-content/60">
            View order specifications, yarn balance, knitting & dyeing metrics, and color-wise allocation breakdowns.
          </p>
        </div>

        <button onClick={fetchOrders} className="btn btn-outline btn-sm gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Control Card */}
      <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-base-content/40" />
            <input
              type="text"
              placeholder="Search by order or buyer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input input-bordered input-sm w-full pl-9"
            />
          </div>

          <div className="text-xs font-bold text-base-content/60">
            Total Orders: <span className="text-primary font-black">{totalCount}</span>
          </div>
        </div>
      </div>

      {/* Order List Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden relative min-h-[360px]">
        {loading && (
          <ExpLoadingSpinner
            message="Compiling Product Info..."
            subMessage="Fetching orders and color specifications"
          />
        )}

        {!loading && orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-base-content/60">
            No orders found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="table table-sm">
              <thead className="bg-base-200/50 text-[11px] uppercase tracking-wider font-extrabold">
                <tr>
                  <th className="w-10"></th>
                  <th>Order No</th>
                  <th>Buyer</th>
                  <th>Booking Date</th>
                  <th>Knitting Status</th>
                  <th>Dyeing Status</th>
                  <th>Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200 text-xs">
                {orders.map((ord) => {
                  const isExpanded = expandedOrder === ord.orderNo;

                  return (
                    <React.Fragment key={ord.orderNo}>
                      <tr
                        onClick={() => toggleExpand(ord.orderNo)}
                        className={`cursor-pointer hover:bg-base-200/40 transition-colors ${
                          isExpanded ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td className="text-center">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-primary" />
                          ) : (
                            <ChevronRight className="h-4 w-4 opacity-50" />
                          )}
                        </td>
                        <td className="font-mono font-bold text-primary">{ord.orderNo}</td>
                        <td className="font-semibold">{ord.buyer}</td>
                        <td>{ord.bookingDate || '—'}</td>
                        <td>
                          <span
                            className={`badge badge-xs font-bold ${
                              ord.knittingPlanStatus === 'Confirm'
                                ? 'badge-success text-white'
                                : ord.knittingPlanStatus === 'Tentative'
                                ? 'badge-warning text-white'
                                : 'badge-ghost'
                            }`}
                          >
                            {ord.knittingPlanStatus || 'Pending'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge badge-xs font-bold ${
                              ord.dyeingPlanStatus === 'Confirm'
                                ? 'badge-success text-white'
                                : ord.dyeingPlanStatus === 'Tentative'
                                ? 'badge-warning text-white'
                                : 'badge-ghost'
                            }`}
                          >
                            {ord.dyeingPlanStatus || 'Pending'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge badge-xs font-bold ${
                              ord.deliveryPlanStatus === 'Confirm'
                                ? 'badge-success text-white'
                                : ord.deliveryPlanStatus === 'Tentative'
                                ? 'badge-warning text-white'
                                : 'badge-ghost'
                            }`}
                          >
                            {ord.deliveryPlanStatus || 'Pending'}
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="bg-base-200/30 p-4">
                            {loadingDetails ? (
                              <div className="flex py-6 justify-center">
                                <ExpLoadingSpinner message="Loading Order Specifications..." size="sm" overlay={false} />
                              </div>
                            ) : orderDetails ? (
                              <div className="space-y-4">
                                {/* Top Info Card with Action Buttons */}
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-base-100 p-3.5 rounded-lg border border-base-300 shadow-xs text-xs">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                                    <div>
                                      <span className="text-base-content/50 block text-[10px] uppercase font-bold tracking-wider">
                                        Order No
                                      </span>
                                      <span className="font-mono font-extrabold text-sm text-primary">
                                        {orderDetails.orderNo}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-base-content/50 block text-[10px] uppercase font-bold tracking-wider">
                                        Buyer
                                      </span>
                                      <span className="font-bold">{orderDetails.buyer || '—'}</span>
                                    </div>
                                    <div>
                                      <span className="text-base-content/50 block text-[10px] uppercase font-bold tracking-wider">
                                        Style
                                      </span>
                                      <span className="font-bold">{orderDetails.style || '—'}</span>
                                    </div>
                                    <div>
                                      <span className="text-base-content/50 block text-[10px] uppercase font-bold tracking-wider">
                                        Required Qty
                                      </span>
                                      <span className="font-bold text-accent">
                                        {formatNumDisplay(orderDetails.requiredQtyKgs)} kg
                                      </span>
                                    </div>
                                  </div>

                                  {/* Actions: Download Excel & Print */}
                                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.print();
                                      }}
                                      className="btn btn-xs btn-outline gap-1.5"
                                      title="Print Specification"
                                    >
                                      <Printer className="h-3.5 w-3.5" /> Print
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadExcel();
                                      }}
                                      className="btn btn-xs btn-primary gap-1.5 text-white"
                                      title="Export to Excel (.xlsx)"
                                    >
                                      <FileSpreadsheet className="h-3.5 w-3.5" /> Excel Download
                                    </button>
                                  </div>
                                </div>

                                {/* View Switcher Tabs */}
                                <div className="flex items-center gap-2 border-b border-base-300 pb-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveTab('breakdown');
                                    }}
                                    className={`btn btn-xs gap-1.5 ${
                                      activeTab === 'breakdown' ? 'btn-primary text-white font-bold' : 'btn-ghost'
                                    }`}
                                  >
                                    <TableIcon className="h-3.5 w-3.5" />
                                    Fabric & Color Breakdown ({fabricItems.length} items)
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveTab('matrix');
                                    }}
                                    className={`btn btn-xs gap-1.5 ${
                                      activeTab === 'matrix' ? 'btn-primary text-white font-bold' : 'btn-ghost'
                                    }`}
                                  >
                                    <Palette className="h-3.5 w-3.5" />
                                    Color-wise Specification Matrix ({matrixData.colors.length} colors)
                                  </button>
                                </div>

                                {/* TAB 1: FABRIC & COLOR BREAKDOWN (ITEM LEVEL) */}
                                {activeTab === 'breakdown' && (
                                  <div className="rounded-lg border border-base-300 overflow-hidden bg-base-100 shadow-xs">
                                    <div className="overflow-x-auto">
                                      <table className="table table-xs w-full text-center">
                                        <thead className="bg-base-200 text-[10px] uppercase font-extrabold tracking-wider">
                                          <tr>
                                            <th className="text-left">Color</th>
                                            <th className="text-left">Fabric Construction</th>
                                            <th>GSM</th>
                                            <th>Dia</th>
                                            <th>Req Qty (kg)</th>
                                            <th>Allowance %</th>
                                            <th>Yarn Req</th>
                                            <th>Allocated Qty</th>
                                            <th>Yarn Bala</th>
                                            <th className="bg-primary/10 text-primary">Grey Req</th>
                                            <th className="bg-success/10 text-success">Knit Prod</th>
                                            <th className="bg-primary/10 text-primary">Knit Bala</th>
                                            <th>Deli Bala</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-base-200">
                                          {fabricItems.map((it: any, idx: number) => {
                                            const color = getColData(it, ['Color', 'Colour', 'Fab Color']) || '—';
                                            const construction =
                                              getColData(it, ['FabricConstruction', 'Construction', 'Fabric']) || '—';
                                            const gsm = getColData(it, ['GSM', 'G.S.M', 'Finish GSM', 'Body GSM']) || '—';
                                            const dia =
                                              getColData(it, ['Gauge-Dia', 'Dia', 'Finish Dia', 'Grey Dia', 'Dia / Width', 'Width']) || '—';
                                            const reqQty = getColData(it, ['RequiredQtyKgs', 'Required Qty', 'Req Qty', 'Qty']);
                                            const allowance = getColData(it, ['Allowance %', 'Allowance', 'Allow']);
                                            const yarnReq = getColData(it, ['Yarn req.', 'Yarn Req', 'YarnReq']);
                                            const allocQty = getColData(it, ['Allocated Qty ', 'Allocated Qty', 'AllocatedQty']);
                                            const yarnBala = getColData(it, ['Yarn bala.', 'Yarn Bala', 'YarnBala']);
                                            const greyReq = getColData(it, ['Grey Req.', 'Grey Req', 'GreyReq']);
                                            const knitProd = getColData(it, ['Knit Prod.', 'Knit Prod', 'KnitProd']);
                                            const knitBala = getColData(it, [
                                              'Knit. Bala.',
                                              'Knit Bala',
                                              'KnitBala',
                                              'Knit Balance',
                                              'Knit. Bal.',
                                            ]);
                                            const deliBala = getColData(it, ['Deli. Bala.', 'Deli. Bal.', 'DeliBal', 'Delivery Balance']);

                                            return (
                                              <tr key={idx} className="hover">
                                                <td className="font-bold text-left">{color}</td>
                                                <td className="text-left">{construction}</td>
                                                <td className="font-mono">{gsm}</td>
                                                <td className="font-mono">{dia}</td>
                                                <td className="font-mono font-bold">{formatNumDisplay(reqQty)}</td>
                                                <td className="font-mono">{formatNumDisplay(allowance, true)}</td>
                                                <td className="font-mono">{formatNumDisplay(yarnReq)}</td>
                                                <td className="font-mono">{formatNumDisplay(allocQty)}</td>
                                                <td className="font-mono">{formatNumDisplay(yarnBala)}</td>
                                                <td className="font-mono font-bold bg-primary/5 text-primary">
                                                  {formatNumDisplay(greyReq)}
                                                </td>
                                                <td className="font-mono font-bold bg-success/5 text-success">
                                                  {formatNumDisplay(knitProd)}
                                                </td>
                                                <td className="font-mono font-bold bg-primary/5 text-primary">
                                                  {formatNumDisplay(knitBala)}
                                                </td>
                                                <td className="font-mono font-semibold">{formatNumDisplay(deliBala)}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                        {/* Total Summary Footer */}
                                        {fabricItems.length > 1 && (
                                          <tfoot className="bg-base-200/70 font-extrabold text-[11px]">
                                            <tr>
                                              <td colSpan={4} className="text-right uppercase">
                                                Total:
                                              </td>
                                              <td className="font-mono text-center">
                                                {formatNumDisplay(
                                                  fabricItems.reduce(
                                                    (acc: number, it: any) =>
                                                      acc + (parseNum(getColData(it, ['RequiredQtyKgs', 'Required Qty', 'Req Qty'])) || 0),
                                                    0
                                                  )
                                                )}
                                              </td>
                                              <td>—</td>
                                              <td className="font-mono text-center">
                                                {formatNumDisplay(
                                                  fabricItems.reduce(
                                                    (acc: number, it: any) =>
                                                      acc + (parseNum(getColData(it, ['Yarn req.', 'Yarn Req'])) || 0),
                                                    0
                                                  )
                                                )}
                                              </td>
                                              <td className="font-mono text-center">
                                                {formatNumDisplay(
                                                  fabricItems.reduce(
                                                    (acc: number, it: any) =>
                                                      acc + (parseNum(getColData(it, ['Allocated Qty ', 'Allocated Qty'])) || 0),
                                                    0
                                                  )
                                                )}
                                              </td>
                                              <td className="font-mono text-center">
                                                {formatNumDisplay(
                                                  fabricItems.reduce(
                                                    (acc: number, it: any) =>
                                                      acc + (parseNum(getColData(it, ['Yarn bala.', 'Yarn Bala'])) || 0),
                                                    0
                                                  )
                                                )}
                                              </td>
                                              <td className="font-mono text-center text-primary bg-primary/10">
                                                {formatNumDisplay(
                                                  fabricItems.reduce(
                                                    (acc: number, it: any) =>
                                                      acc + (parseNum(getColData(it, ['Grey Req.', 'Grey Req'])) || 0),
                                                    0
                                                  )
                                                )}
                                              </td>
                                              <td className="font-mono text-center text-success bg-success/10">
                                                {formatNumDisplay(
                                                  fabricItems.reduce(
                                                    (acc: number, it: any) =>
                                                      acc + (parseNum(getColData(it, ['Knit Prod.', 'Knit Prod'])) || 0),
                                                    0
                                                  )
                                                )}
                                              </td>
                                              <td className="font-mono text-center text-primary bg-primary/10">
                                                {formatNumDisplay(
                                                  fabricItems.reduce(
                                                    (acc: number, it: any) =>
                                                      acc + (parseNum(getColData(it, ['Knit. Bala.', 'Knit Bala'])) || 0),
                                                    0
                                                  )
                                                )}
                                              </td>
                                              <td className="font-mono text-center">
                                                {formatNumDisplay(
                                                  fabricItems.reduce(
                                                    (acc: number, it: any) =>
                                                      acc + (parseNum(getColData(it, ['Deli. Bala.', 'Deli. Bal.'])) || 0),
                                                    0
                                                  )
                                                )}
                                              </td>
                                            </tr>
                                          </tfoot>
                                        )}
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* TAB 2: COLOR-WISE SPECIFICATION MATRIX (EXP STANDARD) */}
                                {activeTab === 'matrix' && (
                                  <div className="rounded-lg border border-base-300 overflow-hidden bg-base-100 shadow-xs">
                                    {matrixData.colors.length === 0 ? (
                                      <div className="p-6 text-center text-xs text-base-content/50">
                                        No color-wise breakdown available for this order.
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="table table-xs w-full text-center">
                                          <thead className="bg-base-200 text-[10px] uppercase font-extrabold tracking-wider">
                                            <tr>
                                              <th className="text-left w-[180px]">Metric / Department</th>
                                              {matrixData.colors.map((c) => (
                                                <th key={c.key} className="text-center font-bold">
                                                  {c.label}
                                                </th>
                                              ))}
                                              <th className="text-center bg-primary/10 text-primary font-black">
                                                Total
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-base-200 font-mono text-xs">
                                            {matrixData.metricResults.map((m, idx) => (
                                              <tr key={idx} className="hover">
                                                <td className="font-sans font-bold text-left bg-base-200/30 text-xs">
                                                  {m.label}
                                                </td>
                                                {m.values.map((v, cIdx) => (
                                                  <td key={cIdx} className="text-center">
                                                    {v === null ? (
                                                      <span className="text-base-content/30">0</span>
                                                    ) : (
                                                      formatNumDisplay(v, m.percent)
                                                    )}
                                                  </td>
                                                ))}
                                                <td className="text-center font-black bg-primary/5 text-primary">
                                                  {m.total === null ? (
                                                    <span className="text-base-content/30">0</span>
                                                  ) : (
                                                    formatNumDisplay(m.total, m.percent)
                                                  )}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-base-content/50">No detailed specs available.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Exact Exp Pagination Bar */}
        <ExpPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalCount}
          limit={limit}
          onPageChange={(newPage) => setPage(newPage)}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
