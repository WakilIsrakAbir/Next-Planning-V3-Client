'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import {
  Activity,
  Search,
  Download,
  CheckCircle,
  AlertCircle,
  Save,
} from 'lucide-react';
import { API_BASE } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import { sharedGetJson } from '@/lib/shared-request';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import InlineSpinner from '@/components/ui/InlineSpinner';
import { pageForNewLimit, useFitRows } from '@/lib/use-fit-rows';

interface PageProps {
  params: Promise<{ dept: string }>;
}

// Port of the old `.resizable-table-input` CSS (index.html): one-row textarea that resizes both ways.
const RESIZABLE_INPUT_CLS =
  'resize min-w-[90px] min-h-[26px] h-[26px] leading-[1.25] align-middle box-border overflow-auto dark:bg-[#151921] dark:border-[#2a3346] dark:text-[#cbd5e1]';

// Natural height of a list row (date inputs / one-row textareas + padding); "Auto" stretches rows slightly to fill the table area.
const ROW_HEIGHT = 35;

function calcTrackingBadge(actualDateStr?: string, planDateStr?: string) {
  const hasActual = actualDateStr && String(actualDateStr).trim() !== '' && String(actualDateStr).trim() !== '-';
  const hasPlan = planDateStr && String(planDateStr).trim() !== '' && String(planDateStr).trim() !== '-';

  if (hasActual) {
    if (!hasPlan) return '—';
    const aDate = new Date(actualDateStr).setHours(0, 0, 0, 0);
    const pDate = new Date(planDateStr).setHours(0, 0, 0, 0);
    return aDate <= pDate ? 'Pass' : 'Fail';
  }

  if (hasPlan) {
    const pDate = new Date(planDateStr).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    if (pDate < today) return 'Fail';
  }

  return '—';
}

// Editable actual-tracking fields per order (saved as `actualData`).
interface TrackingEdit {
  actualStart: string;
  actualEnd: string;
  failReason: string;
  relatedDept: string;
}

// One row of /api/orders/tracking/:dept.
interface TrackingOrder {
  orderNo: string;
  buyer?: string;
  extProd?: string | number | null;
  extBal?: string | number | null;
  planStart?: string;
  planEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  failReason?: string;
  relatedDept?: string;
}

const cachedTrackingOrders: Record<
  string,
  {
    orders: TrackingOrder[];
    total: number;
    totalPages: number;
    buyers: string[];
    initialEdits: Record<string, TrackingEdit>;
  }
> = {};
// Rows per page of the last list request, so a revisit can show that cached first page before "Auto" has measured the table
const lastListRequest = { limit: 10 };

// Cache key of one tracking list page (the same format when reading and storing).
function trackingCacheKey(
  dept: string,
  tab: string,
  buyer: string,
  page: number,
  limit: number,
  search: string,
  sMin: string,
  sMax: string,
  eMin: string,
  eMax: string
): string {
  return `${dept}_${tab}_${buyer}_${page}_${limit}_${search}_${sMin}_${sMax}_${eMin}_${eMax}`;
}

export default function TrackingScreen({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';

  const [activeTab, setActiveTab] = useState<'Pending' | 'Complete'>('Pending');
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
  const fit = useFitRows(scrollRef, ROW_HEIGHT);
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
      <div className="flex-none flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Plan vs Actual Tracking: <span className="uppercase">{dept}</span>
          </h2>
          <p className="text-xs text-base-content/60">
            Inline real-time floor execution tracking with instant Pass / Fail result calculation and delay attribution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadTrackingExcel}
            className="btn btn-sm btn-outline gap-2 font-bold"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saveLoading || orders.length === 0}
            className="btn btn-sm btn-primary gap-2 font-bold shadow-md shadow-primary/25"
          >
            {saveLoading ? <InlineSpinner size={14} /> : <Save className="w-4 h-4" />}
            Save Actual Tracking
          </button>
        </div>
      </div>

      {/* Tab Controls: Pending vs Complete */}
      <div className="flex-none flex items-center justify-between border-b border-base-300 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('Pending');
              setPage(1);
            }}
            className={`btn btn-sm font-bold ${
              activeTab === 'Pending' ? 'btn-primary' : 'btn-ghost text-base-content/70'
            }`}
          >
            Pending Execution
          </button>
          <button
            onClick={() => {
              setActiveTab('Complete');
              setPage(1);
            }}
            className={`btn btn-sm font-bold ${
              activeTab === 'Complete' ? 'btn-success text-white' : 'btn-ghost text-base-content/70'
            }`}
          >
            Completed Execution
          </button>
        </div>

        {/* Global Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Booking No..."
              className="input input-bordered input-sm w-48 sm:w-64 pl-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  runSearch();
                }
              }}
            />
          </div>
          <button
            onClick={runSearch}
            className="btn btn-primary btn-sm font-bold text-xs"
          >
            Search
          </button>
        </div>
      </div>

      {/* Buyer Filter Pills (always shown, also before the buyers have loaded, so the table area keeps its height) */}
      <div className="flex-none flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        <button
          onClick={() => {
            setSelectedBuyer('');
            setPage(1);
          }}
          className={`btn btn-xs font-bold shrink-0 ${
            selectedBuyer === '' ? 'btn-primary' : 'btn-ghost bg-base-200/60'
          }`}
        >
          ALL BUYERS
        </button>
        {availableBuyers.map((b) => (
          <button
            key={b}
            onClick={() => {
              setSelectedBuyer(b);
              setPage(1);
            }}
            className={`btn btn-xs font-bold shrink-0 ${
              selectedBuyer === b ? 'btn-primary' : 'btn-ghost bg-base-200/60'
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Date Range Filter (Exact 1-row layout matching Exp) */}
      <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap custom-scrollbar shrink-0 py-1">
        <span className="text-[11px] font-bold text-gray-600 bg-gray-100 dark:bg-base-200 dark:text-base-content/70 px-2 py-1 rounded">Start</span>
        <input
          type="date"
          value={startMin}
          onChange={(e) => setStartMin(e.target.value)}
          className="p-1 border border-gray-300 dark:border-base-300 rounded text-[11px] bg-base-100 focus:border-blue-500 outline-none w-[125px] shrink-0"
          title="Min Start Date"
        />
        <span className="text-gray-400 font-bold shrink-0">—</span>
        <input
          type="date"
          value={startMax}
          onChange={(e) => setStartMax(e.target.value)}
          className="p-1 border border-gray-300 dark:border-base-300 rounded text-[11px] bg-base-100 focus:border-blue-500 outline-none w-[125px] shrink-0"
          title="Max Start Date"
        />

        <span className="text-[11px] font-bold text-gray-600 bg-gray-100 dark:bg-base-200 dark:text-base-content/70 px-2 py-1 rounded ml-2 shrink-0">End</span>
        <input
          type="date"
          value={endMin}
          onChange={(e) => setEndMin(e.target.value)}
          className="p-1 border border-gray-300 dark:border-base-300 rounded text-[11px] bg-base-100 focus:border-blue-500 outline-none w-[125px] shrink-0"
          title="Min End Date"
        />
        <span className="text-gray-400 font-bold shrink-0">—</span>
        <input
          type="date"
          value={endMax}
          onChange={(e) => setEndMax(e.target.value)}
          className="p-1 border border-gray-300 dark:border-base-300 rounded text-[11px] bg-base-100 focus:border-blue-500 outline-none w-[125px] shrink-0"
          title="Max End Date"
        />

        <button
          onClick={handleApplyFilter}
          className="px-3 py-1 bg-green-600 text-white font-bold rounded text-[11px] hover:bg-green-700 transition-colors ml-2 shrink-0 shadow-xs"
        >
          Apply Filter
        </button>
        <button
          onClick={handleClearFilter}
          className="px-3 py-1 bg-gray-200 dark:bg-base-200 text-gray-600 dark:text-base-content/70 font-bold rounded text-[11px] hover:bg-gray-300 dark:hover:bg-base-300 transition-colors shrink-0"
        >
          Clear
        </button>
      </div>

      {/* Interactive Tracking Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden flex-1 min-h-0 relative flex flex-col">
        {/* Exact Exp 3-Ring Loading Overlay */}
        {loading && <LoadingSpinner message="Processing Tracking Data..." />}

        {/* The table area stays mounted (also while empty), so "Auto" keeps measuring it */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          <table className="table table-xs w-full">
            {/* Sticky header: an opaque base under the same tint, so scrolled rows do not show through */}
            <thead className="sticky top-0 z-10 bg-base-100 text-[11px] font-bold">
              <tr className="bg-base-200/80">
                <th className="text-center w-10">SL</th>
                <th>Order / Booking No</th>
                <th>Buyer</th>
                {dynCol1 && <th className="text-center bg-amber-500/10 text-amber-700">{dynCol1}</th>}
                {dynCol2 && <th className="text-center bg-amber-500/10 text-amber-700">{dynCol2}</th>}
                <th className="text-center bg-primary/10 text-primary">Plan Start</th>
                <th className="text-center bg-primary/10 text-primary">Plan End</th>
                <th className="text-center min-w-[125px]">Actual Start</th>
                <th className="text-center min-w-[125px]">Actual End</th>
                <th className="text-center w-16">Start Result</th>
                <th className="text-center w-16">End Result</th>
                <th className="min-w-[150px]">Fail Reason</th>
                <th className="min-w-[130px]">Related Dept.</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-base-200">
              {!loading && visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="p-16 text-center text-base-content/60">
                    <div className="space-y-2">
                      <AlertCircle className="h-8 w-8 mx-auto text-base-content/30" />
                      <p className="text-sm font-bold">No {activeTab} tracking records found.</p>
                      <p className="text-xs">Adjust your search or filter parameters to find confirmed plans.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleOrders.map((ord, idx) => {
                  const sl = (page - 1) * (limit ?? 0) + idx + 1;
                  const rowEdit = editedRows[ord.orderNo] || {
                    actualStart: ord.actualStart || '',
                    actualEnd: ord.actualEnd || '',
                    failReason: ord.failReason || '',
                    relatedDept: ord.relatedDept || '',
                  };

                  const startResult = calcTrackingBadge(rowEdit.actualStart, ord.planStart);
                  const endResult = calcTrackingBadge(rowEdit.actualEnd, ord.planEnd);

                  return (
                    <tr key={ord.orderNo} style={rowStyle} className="hover:bg-base-200/40 transition-colors">
                      <td className="text-center font-bold text-base-content/40">{sl}</td>
                      <td className="font-bold text-primary whitespace-nowrap">{ord.orderNo}</td>
                      <td className="font-medium whitespace-nowrap">{ord.buyer}</td>
                      {dynCol1 && (
                        <td className="text-center font-bold bg-amber-500/5 text-amber-800">
                          {ord.extProd !== undefined && ord.extProd !== null && ord.extProd !== '' && !isNaN(Number(ord.extProd))
                            ? Number(ord.extProd).toFixed(2)
                            : '—'}
                        </td>
                      )}
                      {dynCol2 && (
                        <td className="text-center font-bold bg-amber-500/5 text-amber-800">
                          {ord.extBal !== undefined && ord.extBal !== null && ord.extBal !== '' && !isNaN(Number(ord.extBal))
                            ? Number(ord.extBal).toFixed(2)
                            : '—'}
                        </td>
                      )}
                      <td className="text-center font-bold text-primary bg-primary/5 whitespace-nowrap">
                        {formatDateDisplay(ord.planStart) || '—'}
                      </td>
                      <td className="text-center font-bold text-primary bg-primary/5 whitespace-nowrap">
                        {formatDateDisplay(ord.planEnd) || '—'}
                      </td>

                      {/* Actual Start Input */}
                      <td className="text-center">
                        <input
                          type="date"
                          value={rowEdit.actualStart}
                          onChange={(e) => handleRowChange(ord.orderNo, 'actualStart', e.target.value)}
                          className="input input-bordered input-xs w-full text-center"
                        />
                      </td>

                      {/* Actual End Input */}
                      <td className="text-center">
                        <input
                          type="date"
                          value={rowEdit.actualEnd}
                          min={rowEdit.actualStart}
                          onChange={(e) => handleRowChange(ord.orderNo, 'actualEnd', e.target.value)}
                          className="input input-bordered input-xs w-full text-center"
                        />
                      </td>

                      {/* Start Result Badge */}
                      <td className="text-center">
                        {startResult === 'Pass' ? (
                          <span className="badge badge-success text-white badge-xs font-bold">Pass</span>
                        ) : startResult === 'Fail' ? (
                          <span className="badge badge-error text-white badge-xs font-bold">Fail</span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* End Result Badge */}
                      <td className="text-center">
                        {endResult === 'Pass' ? (
                          <span className="badge badge-success text-white badge-xs font-bold">Pass</span>
                        ) : endResult === 'Fail' ? (
                          <span className="badge badge-error text-white badge-xs font-bold">Fail</span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Fail Reason */}
                      <td>
                        <textarea
                          rows={1}
                          value={rowEdit.failReason}
                          placeholder="Delay reason..."
                          onChange={(e) => handleRowChange(ord.orderNo, 'failReason', e.target.value)}
                          className={`textarea textarea-xs w-full px-2 py-1 ${RESIZABLE_INPUT_CLS}`}
                        />
                      </td>

                      {/* Related Dept. */}
                      <td>
                        <textarea
                          rows={1}
                          value={rowEdit.relatedDept}
                          placeholder="Attributed dept..."
                          onChange={(e) => handleRowChange(ord.orderNo, 'relatedDept', e.target.value)}
                          className={`textarea textarea-xs w-full px-2 py-1 ${RESIZABLE_INPUT_CLS}`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Exact Exp Pagination Bar */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          limit={limit ?? fit?.rows ?? 10}
          onPageChange={(newPage) => setPage(newPage)}
          onLimitChange={handleLimitChange}
          autoRows={fit?.rows}
          isAuto={limitChoice === 'auto'}
        />
      </div>
    </div>
  );
}
