'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { apiClient } from '@/lib/api-client';
import { sharedRequest } from '@/lib/shared-request';
import {
  PPI_METRICS,
  buildPPIExcelSheet,
  computePPIColorSummary,
  computePPIMilestones,
  type PPIColorSummary,
  type PPIOrder,
  type PPIPlanData,
} from '@/features/reports/planning-prod-info/lib/ppi-utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { pageForNewLimit, useFitRows } from '@/hooks/use-fit-rows';
import '@/features/reports/planning-prod-info/print/print.css';
import type { PPIDetail, PPIListResult, PPIToastState } from '@/features/reports/planning-prod-info/types';
import { cachedPPI } from '@/features/reports/planning-prod-info/lib/ppi-cache';
import { EMPTY_LIST, ROW_HEIGHT, SEARCH_DEBOUNCE_MS } from '@/features/reports/planning-prod-info/lib/constants';
import { useReportZoom } from '@/features/reports/planning-prod-info/hooks/use-report-zoom';
import { usePPIPrint } from '@/features/reports/planning-prod-info/hooks/use-ppi-print';
import PPIToast from '@/features/reports/planning-prod-info/components/PPIToast';
import PPIListHeader from '@/features/reports/planning-prod-info/components/PPIListHeader';
import PPIOrdersTable from '@/features/reports/planning-prod-info/components/PPIOrdersTable';
import PPIReportToolbar from '@/features/reports/planning-prod-info/components/PPIReportToolbar';
import PPIReportSheet from '@/features/reports/planning-prod-info/components/PPIReportSheet';
import PPIBookingSpecSection from '@/features/reports/planning-prod-info/components/PPIBookingSpecSection';
import PPIPlanningSection from '@/features/reports/planning-prod-info/components/PPIPlanningSection';
import PPIColorSummarySection from '@/features/reports/planning-prod-info/components/PPIColorSummarySection';

export default function PlanningProdInfoScreen() {
  const [search, setSearch] = useState('');
  // US-12: a second box searches by Style (the General Info Style); both must match when both are filled.
  const [styleSearch, setStyleSearch] = useState('');
  // Search texts actually requested: follow the boxes after a typing pause, or at once on Enter
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedStyle, setAppliedStyle] = useState('');
  const [page, setPage] = useState(1);
  const [limitChoice, setLimitChoice] = useState<number | 'auto'>('auto');
  // The list's table area: "Auto" shows as many rows as fit in it, so the page neither scrolls nor leaves an empty band.
  // Kept as state (not a ref): the list unmounts while a report is open, and the table area mounted on "Back" is measured again.
  const [tableArea, setTableArea] = useState<HTMLDivElement | null>(null);
  const tableAreaRef = useMemo(() => ({ current: tableArea }), [tableArea]);
  const fit = useFitRows(tableAreaRef, ROW_HEIGHT);
  const limit = limitChoice === 'auto' ? (fit?.rows ?? null) : limitChoice;

  // When "Auto" fits a different number of rows (window or sidebar resized), keep the first visible row in view
  const [prevLimit, setPrevLimit] = useState(limit);
  if (limit !== prevLimit) {
    setPrevLimit(limit);
    if (limitChoice === 'auto' && prevLimit && limit) setPage(pageForNewLimit(page, prevLimit, limit));
  }

  const listKey = `${page}_${limit}_${appliedSearch.trim().toLowerCase()}_${appliedStyle.trim().toLowerCase()}`;
  const [listState, setListState] = useState<{ key: string; data: PPIListResult } | null>(null);

  // Detailed view state
  const [selectedOrder, setSelectedOrder] = useState<PPIOrder | null>(null);
  const [planData, setPlanData] = useState<PPIPlanData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [toast, setToast] = useState<PPIToastState | null>(null);
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

  // Debounced search: one request after the user stops typing instead of one per keystroke
  useEffect(() => {
    if (search === appliedSearch && styleSearch === appliedStyle) return;
    const timer = window.setTimeout(() => {
      setAppliedSearch(search);
      setAppliedStyle(styleSearch);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, appliedSearch, styleSearch, appliedStyle]);

  const applySearchNow = () => {
    setAppliedSearch(search);
    setAppliedStyle(styleSearch);
    setPage(1);
  };

  // Order list: cached pages show instantly, the server copy refreshes them.
  useEffect(() => {
    // "Auto" waits until the table area has been measured
    if (limit === null) return;
    let isMounted = true;
    const fetchOrders = async () => {
      try {
        const endpoint =
          `/api/orders/all-list?page=${page}&limit=${limit}&search=${encodeURIComponent(appliedSearch)}` +
          (appliedStyle.trim() ? `&style=${encodeURIComponent(appliedStyle)}` : '');
        const res = await sharedRequest(endpoint, () => apiClient<Partial<PPIListResult>>(endpoint));
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
  }, [listKey, page, limit, appliedSearch, appliedStyle, showToast]);

  const cachedList = cachedPPI.data.get(listKey);
  const listData = listState?.key === listKey ? listState.data : (cachedList ?? listState?.data ?? EMPTY_LIST);
  const loading = listState?.key !== listKey && !cachedList;
  const { orders, total, totalPages } = listData;
  // At most one page of rows (the previous page's rows are cut while a smaller page loads); "Auto" rows fill the table area
  const visibleOrders = limit ? orders.slice(0, limit) : orders;
  const rowStyle = limitChoice === 'auto' && fit ? { height: fit.rowHeight } : undefined;

  const handleLimitChange = (newLimit: number | 'auto') => {
    setLimitChoice(newLimit);
    setPage(1);
  };

  // Only the newest detail request may open the report (responses can arrive out of order)
  const latestDetailRef = useRef(0);

  const loadOrderDetail = async (orderNo?: string) => {
    if (!orderNo) return;
    const requestId = ++latestDetailRef.current;
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
      // Another order was opened meanwhile: its response owns the report
      if (requestId !== latestDetailRef.current) return;
      setSelectedOrder(detail.order);
      setPlanData(detail.planData);
    } catch (err) {
      console.error('Failed to load order detail:', err);
      if (requestId === latestDetailRef.current) showToast('Error loading order details.');
    } finally {
      if (requestId === latestDetailRef.current) setDetailLoading(false);
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

  const isReportReady = !!selectedOrder && !detailLoading;
  const reportOrderNo = selectedOrder?.orderNo;

  const {
    viewportRef,
    sizerRef,
    sheetRef,
    reportZoom,
    reportAutoFit,
    fitReportToScreen,
    changeReportZoom,
    resetReportZoom,
  } = useReportZoom(isReportReady, reportOrderNo);

  const { specSectionRef, planSectionRef, summaryHeaderRef, summaryTheadRef, summaryTbodyRef, printReport } = usePPIPrint(
    isReportReady,
    selectedOrder,
    colorCountText
  );

  const closeReport = () => {
    // A refresh of this order still in flight must not reopen the report
    latestDetailRef.current++;
    setSelectedOrder(null);
  };

  const o = selectedOrder;

  return (
    // The list fills the content area: its header and the pagination stay put, only the table rows scroll.
    // The report scrolls with the page as before.
    <div className={o ? 'space-y-6' : 'flex h-full min-h-0 w-full flex-col gap-6'}>
      {toast && <PPIToast toast={toast} />}

      {!o ? (
        <>
          {/* List Header */}
          <PPIListHeader
            search={search}
            setSearch={setSearch}
            styleSearch={styleSearch}
            setStyleSearch={setStyleSearch}
            applySearchNow={applySearchNow}
          />

          {/* Order List Table */}
          <PPIOrdersTable
            loading={loading}
            setTableArea={setTableArea}
            visibleOrders={visibleOrders}
            rowStyle={rowStyle}
            loadOrderDetail={loadOrderDetail}
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            fit={fit}
            setPage={setPage}
            handleLimitChange={handleLimitChange}
            limitChoice={limitChoice}
          />
        </>
      ) : (
        <div className="space-y-4">
          {/* Action Toolbar with Zoom and Fit Controls */}
          <PPIReportToolbar
            orderNo={o.orderNo}
            onBack={closeReport}
            handleExportExcel={handleExportExcel}
            fitReportToScreen={fitReportToScreen}
            reportAutoFit={reportAutoFit}
            reportZoom={reportZoom}
            changeReportZoom={changeReportZoom}
            resetReportZoom={resetReportZoom}
            printReport={printReport}
          />

          {detailLoading ? (
            <div className="p-16 text-center">
              <LoadingSpinner message="Loading Report Details..." subMessage="Preparing specification and planning milestones" size="sm" overlay={false} />
            </div>
          ) : (
            /* Report viewport: scrolls sideways when zoomed in */
            <PPIReportSheet viewportRef={viewportRef} sizerRef={sizerRef} sheetRef={sheetRef}>
              {/* ================= 1. BOOKING SPECIFICATION (Deep Indigo Blue Header) ================= */}
              <PPIBookingSpecSection order={o} specSectionRef={specSectionRef} />

              {/* ================= 2. BOOKING PLANNING (Cyan/Slate Teal Header) ================= */}
              {milestoneData && <PPIPlanningSection milestoneData={milestoneData} planSectionRef={planSectionRef} />}

              {/* ================= 3. DETAILS BOOKING SUMMARY (Warm Amber Header) ================= */}
              <PPIColorSummarySection
                colorSummary={colorSummary}
                colorCountText={colorCountText}
                summaryHeaderRef={summaryHeaderRef}
                summaryTheadRef={summaryTheadRef}
                summaryTbodyRef={summaryTbodyRef}
              />
            </PPIReportSheet>
          )}
        </div>
      )}
    </div>
  );
}
