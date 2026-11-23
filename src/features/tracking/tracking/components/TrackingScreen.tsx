'use client';

import React, { useState, useEffect, useRef, use, useCallback } from 'react';
import { CheckCircle } from 'lucide-react';
import { API_BASE } from '@/lib/constants';
import { sharedGetJson } from '@/lib/shared-request';
import { pageForNewLimit, useFitRows } from '@/hooks/use-fit-rows';
import OttBoardModal from '@/features/tracking/ott-board/components/OttBoardModal';
import { OTT_BOARD_DEPTS } from '@/features/tracking/ott-board/lib/ott-board';
import { ROW_HEIGHT } from '@/features/tracking/tracking/lib/tracking-table';
import { cachedTrackingOrders, lastListRequest, trackingCacheKey } from '@/features/tracking/tracking/lib/tracking-cache';
import type { TrackingEdit, TrackingOrder } from '@/features/tracking/tracking/types';
import TrackingHeader from '@/features/tracking/tracking/components/TrackingHeader';
import TrackingToolbar from '@/features/tracking/tracking/components/TrackingToolbar';
import TrackingBuyerPills from '@/features/tracking/tracking/components/TrackingBuyerPills';
import TrackingDateRangeFilter from '@/features/tracking/tracking/components/TrackingDateRangeFilter';
import TrackingTable from '@/features/tracking/tracking/components/TrackingTable';

interface PageProps {
  params: Promise<{ dept: string }>;
}

export default function TrackingScreen({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';

  const [activeTab, setActiveTab] = useState<'Pending' | 'Complete'>('Pending');
  // US-11: the order whose OTT board is open (YD, Knitting, Dyeing, Delivery and Delivery Floor lists).
  const [ottOrderNo, setOttOrderNo] = useState<string | null>(null);
  const closeOttBoard = useCallback(() => setOttOrderNo(null), []);
  const hasOttBoard = OTT_BOARD_DEPTS.includes(dept);
  const [search, setSearch] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [startMin, setStartMin] = useState('');
  const [startMax, setStartMax] = useState('');
  const [endMin, setEndMin] = useState('');
  const [endMax, setEndMax] = useState('');
  const [page, setPage] = useState(1);
  const [limitChoice, setLimitChoice] = useState<number | 'auto'>('auto');
  // The table area: "Auto" shows as many rows as fit in it, so the page neither scrolls nor leaves an empty band
  const scrollRef = useRef<HTMLDivElement>(null);
  // Only a window resize or sidebar toggle changes the row count; content settling after the first load does not,
  // so the (slow) tracking list is requested once on first open.
  const fit = useFitRows(scrollRef, ROW_HEIGHT, 5, true);
  // Rows per page in use (the fitted row count while "Auto" is selected); the request and the list cache key use it
  const limit = limitChoice === 'auto' ? (fit?.rows ?? null) : limitChoice;

  const initialKey = trackingCacheKey(dept, 'Pending', '', 1, lastListRequest.limit, '', '', '', '', '');
  const initialCache = cachedTrackingOrders[initialKey];

  const [orders, setOrders] = useState<TrackingOrder[]>(() => initialCache?.orders || []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [availableBuyers, setAvailableBuyers] = useState<string[]>(() => initialCache?.buyers || []);
  const [totalPages, setTotalPages] = useState(() => initialCache?.totalPages || 1);
  const [total, setTotal] = useState(() => initialCache?.total || 0);
  const [editedRows, setEditedRows] = useState<Record<string, TrackingEdit>>(() => initialCache?.initialEdits || {});
  const [saveLoading, setSaveLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Bumped by Search / Apply Filter / Clear so the fetch effect runs exactly once for them (also when already on page 1)
  const [searchRun, setSearchRun] = useState(0);
  // Only the newest list request may update the table (responses can arrive out of order)
  const latestRequestRef = useRef(0);

  // When "Auto" fits a different number of rows (window or sidebar resized), keep the first visible row in view
  const [prevLimit, setPrevLimit] = useState(limit);
  if (limit !== prevLimit) {
    setPrevLimit(limit);
    if (limitChoice === 'auto' && prevLimit && limit) setPage(pageForNewLimit(page, prevLimit, limit));
  }

  // `fresh` skips joining an identical request still in flight (refresh right after saving).
  const fetchTracking = async (fresh = false) => {
    // "Auto" waits until the table area has been measured
    if (limit === null) return;
    lastListRequest.limit = limit;
    const key = trackingCacheKey(dept, activeTab, selectedBuyer, page, limit, search, startMin, startMax, endMin, endMax);
    if (cachedTrackingOrders[key]) {
      const c = cachedTrackingOrders[key];
      setOrders(c.orders);
      setTotal(c.total);
      setTotalPages(c.totalPages);
      if (c.buyers) setAvailableBuyers(c.buyers);
      setEditedRows(c.initialEdits);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const requestId = ++latestRequestRef.current;
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        buyer: selectedBuyer,
        search,
        status: activeTab,
        startMin,
        startMax,
        endMin,
        endMax,
      });

      const data = await sharedGetJson<{ orders?: TrackingOrder[]; total?: number; totalPages?: number; buyers?: string[] }>(
        `${API_BASE}/api/orders/tracking/${dept}?${query.toString()}`,
        fresh
      );
      if (data) {
        const ords: TrackingOrder[] = data.orders || [];
        const tTotal = data.total || 0;
        const tPages = data.totalPages || 1;
        const buyersList = data.buyers || [];

        // Initialize editedRows with existing data
        const initialEdits: Record<string, TrackingEdit> = {};
        ords.forEach((o) => {
          initialEdits[o.orderNo] = {
            actualStart: o.actualStart || '',
            actualEnd: o.actualEnd || '',
            failReason: o.failReason || '',
            relatedDept: o.relatedDept || '',
          };
        });

        cachedTrackingOrders[key] = {
          orders: ords,
          total: tTotal,
          totalPages: tPages,
          buyers: buyersList,
          initialEdits,
        };

        // A newer request (tab / page / search change) owns the table now
        if (requestId !== latestRequestRef.current) return;

        setOrders(ords);
        setTotal(tTotal);
        setTotalPages(tPages);
        if (data.buyers) setAvailableBuyers(buyersList);
        setEditedRows(initialEdits);
      }
    } catch (err) {
      console.error('Failed to fetch tracking data:', err);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  };

  // Search / Apply / Clear: back to page 1 and one request with the current filters (via the effect below)
  const runSearch = () => {
    setPage(1);
    setSearchRun((n) => n + 1);
  };

  const handleApplyFilter = () => {
    runSearch();
  };

  const handleClearFilter = () => {
    setStartMin('');
    setStartMax('');
    setEndMin('');
    setEndMax('');
    runSearch();
  };

  useEffect(() => {
    // Cache-first fetch whenever the tab / buyer / page changes (applies a cached page immediately).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTracking();
    // Text / date filters are applied explicitly via "Apply" / "Search" (searchRun); only these keys trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept, activeTab, selectedBuyer, page, limit, searchRun]);

  const handleRowChange = (orderNo: string, field: keyof TrackingEdit, value: string) => {
    setEditedRows((prev) => {
      const current = prev[orderNo] || { actualStart: '', actualEnd: '', failReason: '', relatedDept: '' };
      const updated = { ...current, [field]: value };

      // Validation: Actual End cannot be selected without Actual Start
      if (field === 'actualEnd' && !updated.actualStart && value) {
        alert('Actual End date cannot be selected without Actual Start date!');
        updated.actualEnd = '';
      }

      // Validation: Actual End cannot be before Actual Start
      if (field === 'actualEnd' && updated.actualStart && value) {
        if (new Date(value).setHours(0, 0, 0, 0) < new Date(updated.actualStart).setHours(0, 0, 0, 0)) {
          alert('Actual End date cannot be before Actual Start date!');
          updated.actualEnd = '';
        }
      }

      return { ...prev, [orderNo]: updated };
    });
  };

  const handleSaveAll = async () => {
    setSaveLoading(true);
    const actualKey = (dept === 'deliveryfloor' ? 'delivery' : dept) + 'Actual';
    let successCount = 0;

    try {
      const token = localStorage.getItem('token');
      const orderNos = Object.keys(editedRows);

      for (const orderNo of orderNos) {
        const edit = editedRows[orderNo];
        if (!edit) continue;

        try {
          const res = await fetch(`${API_BASE}/api/orders/save-dates`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderNo,
              department: actualKey,
              fabricItems: [],
              actualData: {
                actualStart: edit.actualStart,
                actualEnd: edit.actualEnd,
                failReason: edit.failReason,
                relatedDept: edit.relatedDept,
                status: edit.actualEnd ? 'Complete' : 'Pending',
              },
            }),
          });
          if (res.ok) successCount++;
        } catch {
          // A failed order is simply not counted as saved.
        }
      }

      setToastMessage(`Saved ${successCount} order(s) successfully!`);
      setTimeout(() => setToastMessage(null), 3000);
      fetchTracking(true);
    } catch (err) {
      console.error('Batch save error:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleLimitChange = (newLimit: number | 'auto') => {
    setLimitChoice(newLimit);
    setPage(1);
  };

  // At most one page of rows (the previous page's rows are cut while a smaller page loads); "Auto" rows fill the table area
  const visibleOrders = limit ? orders.slice(0, limit) : orders;
  const rowStyle = limitChoice === 'auto' && fit ? { height: fit.rowHeight } : undefined;

  const downloadTrackingExcel = () => {
    const token = localStorage.getItem('token');
    const query = new URLSearchParams({ buyer: selectedBuyer, search, status: activeTab });
    window.open(`${API_BASE}/api/orders/tracking-download/${dept}?${query.toString()}&token=${token}`, '_blank');
  };

  // Dynamic Header Columns
  let dynCol1 = '';
  let dynCol2 = '';
  if (dept === 'knitting') {
    dynCol1 = 'Knit Prod.';
    dynCol2 = 'Knit Bal.';
  } else if (dept === 'dyeing') {
    dynCol1 = 'Dyeing Prod.';
    dynCol2 = 'Dyeing Bal.';
  } else if (dept === 'delivery' || dept === 'deliveryfloor') {
    dynCol1 = 'NetDeliveryQtyKgs';
    dynCol2 = 'Deli. Bal.';
  }
  const columnCount = 11 + (dynCol1 ? 1 : 0) + (dynCol2 ? 1 : 0);

  return (
    // The page fills the content area: the header, tabs, filters and the pagination stay put, only the table rows scroll.
    <div className="flex h-full min-h-0 w-full flex-col gap-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-success text-xs font-bold text-white shadow-lg">
            <CheckCircle className="h-4 w-4" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <TrackingHeader
        dept={dept}
        downloadTrackingExcel={downloadTrackingExcel}
        handleSaveAll={handleSaveAll}
        saveLoading={saveLoading}
        ordersCount={orders.length}
      />

      {/* Tab Controls: Pending vs Complete */}
      <TrackingToolbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setPage={setPage}
        search={search}
        setSearch={setSearch}
        runSearch={runSearch}
      />

      {/* Buyer Filter Pills (always shown, also before the buyers have loaded, so the table area keeps its height) */}
      <TrackingBuyerPills
        availableBuyers={availableBuyers}
        selectedBuyer={selectedBuyer}
        setSelectedBuyer={setSelectedBuyer}
        setPage={setPage}
      />

      {/* Date Range Filter (Exact 1-row layout matching Exp) */}
      <TrackingDateRangeFilter
        startMin={startMin}
        setStartMin={setStartMin}
        startMax={startMax}
        setStartMax={setStartMax}
        endMin={endMin}
        setEndMin={setEndMin}
        endMax={endMax}
        setEndMax={setEndMax}
        handleApplyFilter={handleApplyFilter}
        handleClearFilter={handleClearFilter}
      />

      {/* Interactive Tracking Table */}
      <TrackingTable
        loading={loading}
        scrollRef={scrollRef}
        dynCol1={dynCol1}
        dynCol2={dynCol2}
        columnCount={columnCount}
        visibleOrders={visibleOrders}
        activeTab={activeTab}
        page={page}
        limit={limit}
        editedRows={editedRows}
        rowStyle={rowStyle}
        hasOttBoard={hasOttBoard}
        setOttOrderNo={setOttOrderNo}
        handleRowChange={handleRowChange}
        totalPages={totalPages}
        total={total}
        fit={fit}
        limitChoice={limitChoice}
        setPage={setPage}
        handleLimitChange={handleLimitChange}
      />
      {ottOrderNo && <OttBoardModal orderNo={ottOrderNo} dept={dept} onClose={closeOttBoard} />}
    </div>
  );
}
