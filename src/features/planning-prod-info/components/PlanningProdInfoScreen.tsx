'use client';

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
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
  Expand,
  Minus,
  Plus,
  CircleCheck,
  CircleAlert,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiClient } from '@/lib/api-client';
import {
  PPI_METRICS,
  buildPPIExcelSheet,
  computePPIColorSummary,
  computePPIMilestones,
  firstTruthy,
  formatPPIDate,
  formatPPIPercent,
  ppiMetricTotal,
  toText,
  type PPIColorSummary,
  type PPIOrder,
  type PPIPlanData,
} from '@/features/planning-prod-info/lib/ppi-utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import {
  buildPrintPages,
  clearPrintPages,
  hasPrintPages,
  removePrintContainer,
  type PPIPrintSources,
} from '@/features/planning-prod-info/print/print-engine';
import '@/features/planning-prod-info/print/print.css';

interface PPIListResult {
  orders: PPIOrder[];
  total: number;
  totalPages: number;
}

interface PPIDetail {
  order: PPIOrder | null;
  planData: PPIPlanData | null;
}

// Module-level SWR Cache for instant tab switching (0ms perceived latency)
const cachedPPI = {
  data: new Map<string, PPIListResult>(),
  details: new Map<string, PPIDetail>(),
};

const EMPTY_LIST: PPIListResult = { orders: [], total: 0, totalPages: 1 };

// Report zoom (old setReportZoom / fitReportToScreen): 30%..150% in 10% steps; the sheet is max-w-6xl.
const REPORT_MAX_WIDTH = 1152;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;

/** Display text of the first truthy value (JS `a || b || c`). */
const sv = (...values: unknown[]) => toText(firstTruthy(...values));

const hasValue = (v: unknown) => v !== undefined && v !== null && v !== '';

export default function PlanningProdInfoScreen() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const listKey = `${page}_${limit}_${search.trim().toLowerCase()}`;
  const [listState, setListState] = useState<{ key: string; data: PPIListResult } | null>(null);

  // Detailed view state
  const [selectedOrder, setSelectedOrder] = useState<PPIOrder | null>(null);
  const [planData, setPlanData] = useState<PPIPlanData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'error') => {
    setToast({ type, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  // Order list: cached pages show instantly, the server copy refreshes them.
  useEffect(() => {
    let isMounted = true;
    const fetchOrders = async () => {
      try {
        const res = await apiClient<Partial<PPIListResult>>(
          `/api/orders/all-list?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
        );
        if (!isMounted) return;
        const result: PPIListResult = {
          orders: res.orders || [],
          total: res.total || 0,
          totalPages: res.totalPages || 1,
        };
        cachedPPI.data.set(listKey, result);
        setListState({ key: listKey, data: result });
      } catch (err) {
        console.error('Failed to load orders for PPI:', err);
        if (!isMounted) return;
        setListState((prev) => ({ key: listKey, data: cachedPPI.data.get(listKey) ?? prev?.data ?? EMPTY_LIST }));
        showToast('Failed to fetch order list');
      }
    };
    fetchOrders();
    return () => {
      isMounted = false;
    };
  }, [listKey, page, limit, search, showToast]);

  const cachedList = cachedPPI.data.get(listKey);
  const listData = listState?.key === listKey ? listState.data : (cachedList ?? listState?.data ?? EMPTY_LIST);
  const loading = listState?.key !== listKey && !cachedList;
  const { orders, total, totalPages } = listData;

  const loadOrderDetail = async (orderNo?: string) => {
    if (!orderNo) return;
    const cached = cachedPPI.details.get(orderNo);
    if (cached) {
      setSelectedOrder(cached.order);
      setPlanData(cached.planData);
      setDetailLoading(false);
    } else {
      setDetailLoading(true);
    }

    try {
      const res = await apiClient<Partial<PPIDetail>>(`/api/orders/${encodeURIComponent(orderNo)}?dept=knitting`);
      const detail: PPIDetail = { order: res.order || null, planData: res.planData || null };
      cachedPPI.details.set(orderNo, detail);
      setSelectedOrder(detail.order);
      setPlanData(detail.planData);
    } catch (err) {
      console.error('Failed to load order detail:', err);
      showToast('Error loading order details.');
    } finally {
      setDetailLoading(false);
    }
  };

  // Section 2: plan type and dates per department resolved from the order's current (uploaded) items
  const milestoneData = useMemo(
    () => (selectedOrder ? computePPIMilestones(selectedOrder, planData) : null),
    [selectedOrder, planData]
  );

  // Section 3: colour-wise summary
  const colorSummary = useMemo<PPIColorSummary>(
    () => (selectedOrder ? computePPIColorSummary(selectedOrder) : { colors: [], colorAggs: {}, metrics: PPI_METRICS }),
    [selectedOrder]
  );
  const colorCountText = `${colorSummary.colors.length} ${colorSummary.colors.length === 1 ? 'Color' : 'Colors'}`;

  // Excel Export (old exportPPIToExcel layout and data)
  const handleExportExcel = () => {
    if (!selectedOrder) {
      showToast('No detailed data to export!');
      return;
    }
    const { rows, cols } = buildPPIExcelSheet(selectedOrder, planData);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = cols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planning_Production_Info');
    XLSX.writeFile(wb, `Planning_Production_Info_${selectedOrder.orderNo}.xlsx`);
    showToast('Excel downloaded successfully!', 'success');
  };

  // ==========================================
  // Zoom & screen fit
  // ==========================================
  const viewportRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const autoFitRef = useRef(false);
  const [reportZoom, setReportZoomValue] = useState(1);
  const [reportAutoFit, setReportAutoFit] = useState(false);

  /** Applies the zoom: the sheet is scaled from its top-left corner and the sizer reserves its scaled size. */
  const layoutReportSheet = useCallback(() => {
    const viewport = viewportRef.current;
    const sizer = sizerRef.current;
    const sheet = sheetRef.current;
    if (!viewport || !sizer || !sheet) return;
    const available = viewport.clientWidth;
    if (available <= 0) return;
    const zoom = zoomRef.current;
    // Zoomed out, the sheet may lay out wider (up to its max width) so the smaller report still fills the view.
    const layoutWidth = zoom < 1 ? Math.min(REPORT_MAX_WIDTH, available / zoom) : Math.min(REPORT_MAX_WIDTH, available);
    sheet.style.width = `${layoutWidth}px`;
    sheet.style.transform = `scale(${zoom})`;
    sizer.style.width = `${layoutWidth * zoom}px`;
    sizer.style.height = `${sheet.offsetHeight * zoom}px`;
  }, []);

  const setReportZoom = useCallback(
    (value: number, fitted = false) => {
      const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
      zoomRef.current = clamped;
      autoFitRef.current = fitted;
      setReportZoomValue(clamped);
      setReportAutoFit(fitted);
      layoutReportSheet();
    },
    [layoutReportSheet]
  );

  const fitReportToScreen = useCallback(() => {
    const viewport = viewportRef.current;
    const sheet = sheetRef.current;
    if (!viewport || !sheet) return;
    const available = viewport.clientWidth;
    // Measure the sheet at its natural (100%) width.
    const previousWidth = sheet.style.width;
    sheet.style.width = `${Math.min(REPORT_MAX_WIDTH, available)}px`;
    const originalWidth = sheet.scrollWidth || sheet.offsetWidth || REPORT_MAX_WIDTH;
    sheet.style.width = previousWidth;
    if (available > 0 && originalWidth > 0) {
      setReportZoom(Math.min(1, available / originalWidth), true);
    }
  }, [setReportZoom]);

  const changeReportZoom = (delta: number) => setReportZoom(zoomRef.current + delta, false);
  const resetReportZoom = () => setReportZoom(1, false);

  const isReportReady = !!selectedOrder && !detailLoading;
  const reportOrderNo = selectedOrder?.orderNo;

  useLayoutEffect(() => {
    if (!isReportReady) return;
    const viewport = viewportRef.current;
    const sheet = sheetRef.current;
    if (!viewport || !sheet) return;

    layoutReportSheet();
    let layoutFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(layoutReportSheet);
    });
    observer.observe(viewport);
    observer.observe(sheet);

    // Opening a report fits it to the screen; while fitted, a window resize fits it again.
    const fitFrame = requestAnimationFrame(fitReportToScreen);
    const onResize = () => {
      if (autoFitRef.current) requestAnimationFrame(fitReportToScreen);
    };
    window.addEventListener('resize', onResize);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(layoutFrame);
      cancelAnimationFrame(fitFrame);
      window.removeEventListener('resize', onResize);
    };
  }, [isReportReady, reportOrderNo, layoutReportSheet, fitReportToScreen]);

  // ==========================================
  // A4 landscape print
  // ==========================================
  const specSectionRef = useRef<HTMLElement>(null);
  const planSectionRef = useRef<HTMLElement>(null);
  const summaryHeaderRef = useRef<HTMLDivElement>(null);
  const summaryTheadRef = useRef<HTMLTableSectionElement>(null);
  const summaryTbodyRef = useRef<HTMLTableSectionElement>(null);

  const getPrintSources = useCallback(
    (): PPIPrintSources => ({
      specSection: specSectionRef.current,
      planSection: planSectionRef.current,
      summaryHeader: summaryHeaderRef.current,
      summaryThead: summaryTheadRef.current,
      summaryTbody: summaryTbodyRef.current,
      bookingTitle: `Booking #${selectedOrder?.orderNo || '—'}`,
      colorCountText,
    }),
    [selectedOrder, colorCountText]
  );

  const printReport = () => {
    buildPrintPages(getPrintSources());
    window.print();
  };

  useEffect(() => {
    if (!isReportReady) return;
    // Browser print (Ctrl+P) builds the pages too; they are discarded once printing ends.
    const onBeforePrint = () => {
      if (!hasPrintPages()) buildPrintPages(getPrintSources());
    };
    const onAfterPrint = () => clearPrintPages();
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
      removePrintContainer();
    };
  }, [isReportReady, getPrintSources]);

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
    else if (t === 'Pending')
      colorClass =
        'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold';
    else if (t === 'T&A') colorClass = 'bg-slate-200/90 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold';
    return <span className={`inline-block px-3 py-0.5 rounded ${colorClass} font-bold text-[11px] shadow-xs`}>{t}</span>;
  };

  const o = selectedOrder;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div
            className={`alert ${
              toast.type === 'success' ? 'alert-success' : 'alert-error'
            } shadow-lg text-xs font-bold py-2.5 px-4 rounded border`}
          >
            {toast.type === 'success' ? <CircleCheck className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {!o ? (
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
              <LoadingSpinner
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
            <Pagination
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
          {/* Action Toolbar with Zoom and Fit Controls */}
          <div className="no-print sticky top-0 z-20 bg-base-100 border border-base-300 rounded-lg flex items-center justify-between px-4 py-2.5 shrink-0 shadow-xs flex-wrap gap-2">
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
                  Booking #{o.orderNo}
                </span>
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel Download
              </button>
              <button
                onClick={fitReportToScreen}
                className={`px-3.5 py-1.5 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                  reportAutoFit
                    ? 'bg-indigo-600 hover:bg-indigo-700 ring-2 ring-indigo-300'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                title="Fit to Screen Width"
              >
                <Expand className="w-4 h-4" /> Fit to Screen
              </button>
              <div className="flex items-center bg-base-200 border border-base-300 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => changeReportZoom(-ZOOM_STEP)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-base-100 font-bold transition"
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-2 text-xs font-bold min-w-[46px] text-center select-none">
                  {Math.round(reportZoom * 100)}%
                </span>
                <button
                  onClick={() => changeReportZoom(ZOOM_STEP)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-base-100 font-bold transition"
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={resetReportZoom}
                  className="px-2 py-1 text-[11px] font-semibold text-base-content/60 hover:text-base-content transition border-l border-base-300"
                  title="Reset Zoom"
                >
                  Reset
                </button>
              </div>
              <button
                onClick={printReport}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                title="Print ERP Report"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>

          {detailLoading ? (
            <div className="p-16 text-center">
              <LoadingSpinner message="Loading Report Details..." subMessage="Preparing specification and planning milestones" size="sm" overlay={false} />
            </div>
          ) : (
            /* Report viewport: scrolls sideways when zoomed in */
            <div ref={viewportRef} className="w-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-1">
              <div ref={sizerRef} className="mx-auto">
                <div
                  ref={sheetRef}
                  className="w-full origin-top-left transition-transform duration-150 ease-out bg-base-100 rounded-xl shadow-xs border border-base-300 p-3 sm:p-6 space-y-6"
                >
                  {/* Report Screen Title */}
                  <div className="pb-3 border-b border-base-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <h2 className="text-sm sm:text-base font-extrabold tracking-tight">Detailed Planning & Production Info</h2>
                    </div>
                  </div>

                  {/* ================= 1. BOOKING SPECIFICATION (Deep Indigo Blue Header) ================= */}
                  <section ref={specSectionRef} className="w-full">
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
                              {sv(o.orderNo, '—')}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Buyer Name
                            </td>
                            <td className="p-2 font-black border-b md:border-b-0 md:border-r border-base-300 flex items-center">
                              {sv(o.buyer, '—')}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Buyer Team
                            </td>
                            <td className="p-2 font-medium border-b md:border-b-0 border-base-300 flex items-center">
                              {sv(o.buyerTeam, '—')}
                            </td>
                          </tr>

                          {/* Row 2: Booking Date | Event Day | Style */}
                          <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-200/30">
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Booking Date
                            </td>
                            <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                              {formatPPIDate(o.bookingDate)}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Event Day
                            </td>
                            <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                              {toText(o.eventDay ?? '—')}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Style
                            </td>
                            <td className="p-2 font-bold text-blue-600 dark:text-blue-400 border-b md:border-b-0 border-base-300 flex items-center">
                              {sv(o.style, o.Style, '—')}
                            </td>
                          </tr>

                          {/* Row 3: PMC | Merchant | Unit */}
                          <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-100">
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              PMC
                            </td>
                            <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                              {sv(o.pmc, '—')}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Merchant
                            </td>
                            <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                              {sv(o.bookingBy, o.bookedBy, '—')}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Unit
                            </td>
                            <td className="p-2 border-b md:border-b-0 border-base-300 font-medium flex items-center">
                              {sv(o.floor, o.unit, 'EFL')}
                            </td>
                          </tr>

                          {/* Row 4: Gmt Unit | Program Type | Order Qty (KG) */}
                          <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-200/30">
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Gmt Unit
                            </td>
                            <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                              {o.gmtUnit !== undefined && o.gmtUnit !== null ? toText(o.gmtUnit) : '—'}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Program Type
                            </td>
                            <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                              {sv(o.programType, o['Program type'], 'SOLID')}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Order Qty (KG)
                            </td>
                            <td className="p-2 font-black text-emerald-600 dark:text-emerald-400 border-b md:border-b-0 border-base-300 flex items-center font-mono">
                              {o.requiredQtyKgs ? `${Number(o.requiredQtyKgs).toLocaleString()} KG` : '—'}
                            </td>
                          </tr>

                          {/* Row 5: Batch Plan | Body Fabric | Body GSM */}
                          <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-100">
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Batch Plan
                            </td>
                            <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                              {sv(o.bpStatus, 'Pending')}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Body Fabric
                            </td>
                            <td className="p-2 font-medium border-b md:border-b-0 md:border-r border-base-300 truncate flex items-center">
                              {sv(o.bodyFabric, o['Body Fabric'], '—')}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Body GSM
                            </td>
                            <td className="p-2 font-medium border-b md:border-b-0 border-base-300 flex items-center font-mono">
                              {hasValue(o.bodyGsm) ? toText(o.bodyGsm) : '—'}
                            </td>
                          </tr>

                          {/* Row 6: Brush | Peach | Heatset */}
                          <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-200/30">
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Brush
                            </td>
                            <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                              {sv(o.brush, o['Brush'], 'No')}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Peach
                            </td>
                            <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                              {sv(o.peach, o['Peach'], 'No')}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Heatset
                            </td>
                            <td className="p-2 border-b md:border-b-0 border-base-300 font-medium flex items-center">
                              {sv(o.heatset, o['Heatset'], 'No')}
                            </td>
                          </tr>

                          {/* Row 7: ALD | PMC Notes | Fabric Notes */}
                          <tr className="grid grid-cols-2 md:grid-cols-6 bg-base-100">
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              ALD
                            </td>
                            <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium flex items-center">
                              {sv(
                                o.ald,
                                o['ALD'],
                                o.eventDay ? `${toText(o.eventDay)} ok out of ${toText(o.eventDay)}` : '—'
                              )}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              PMC Notes
                            </td>
                            <td className="p-2 border-b md:border-b-0 md:border-r border-base-300 font-medium truncate flex items-center">
                              {sv(o.pmcNotes, o['PMC Notes'], o.fabricNotes, '—')}
                            </td>
                            <td className="p-2 font-bold bg-base-200/60 border-r border-b md:border-b-0 border-base-300 flex items-center">
                              Fabric Notes
                            </td>
                            <td className="p-2 border-b md:border-b-0 border-base-300 font-medium truncate flex items-center">
                              {sv(o.fabricNotes, '—')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* ================= 2. BOOKING PLANNING (Cyan/Slate Teal Header) ================= */}
                  {milestoneData && (
                    <section ref={planSectionRef} className="w-full">
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
                    <div
                      ref={summaryHeaderRef}
                      className="bg-[#b45309] text-white px-4 py-2.5 rounded-t-lg font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between shadow-xs"
                    >
                      <span data-ppi-summary-title="" className="flex items-center gap-2">
                        <Layers className="w-4 h-4" /> Details Booking Summary (Color-Wise)
                      </span>
                      <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded">{colorCountText}</span>
                    </div>
                    <div className="overflow-x-auto border border-t-0 border-base-300 rounded-b-lg">
                      <table className="w-full text-xs min-w-[1100px] border-collapse whitespace-nowrap">
                        <thead
                          ref={summaryTheadRef}
                          className="bg-amber-100/90 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-b border-base-300"
                        >
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
                        <tbody ref={summaryTbodyRef} className="divide-y divide-base-200">
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
                                const agg = colorSummary.colorAggs[col.key];

                                return (
                                  <tr
                                    key={col.key}
                                    className={`${isShaded ? 'bg-base-200/30' : 'bg-base-100'} hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors`}
                                  >
                                    <td className="p-2 font-bold border-r border-base-300 text-left">{col.label}</td>
                                    {colorSummary.metrics.map((m) => {
                                      const v = m.getValue(agg);
                                      return (
                                        <td key={m.label} className="p-2 border-r border-base-300 text-center font-mono font-medium">
                                          {m.isPercent ? formatPPIPercent(v) : Math.round(v).toLocaleString()}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}

                              {/* Total Summary Footer Row */}
                              <tr className="bg-amber-100/90 dark:bg-amber-950/80 text-amber-950 dark:text-amber-100 font-black border-t-2 border-base-300">
                                <td className="p-2 font-black border-r border-base-300 text-left uppercase">Total</td>
                                {colorSummary.metrics.map((m) => {
                                  const totalValue = ppiMetricTotal(m, colorSummary);
                                  return (
                                    <td key={m.label} className="p-2 border-r border-base-300 text-center font-mono font-black">
                                      {m.isPercent ? formatPPIPercent(totalValue) : Math.round(totalValue).toLocaleString()}
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
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
