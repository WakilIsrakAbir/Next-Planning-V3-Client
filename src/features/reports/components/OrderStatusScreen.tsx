'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Search,
  Filter,
  RefreshCw,
  Eye,
  X,
  Calendar,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { API_BASE, STATUS_COLORS } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import { sharedGetJson } from '@/lib/shared-request';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import { pageForNewLimit, useFitRows } from '@/lib/use-fit-rows';

function parseNum(val: any): number {
  if (val === undefined || val === null || val === '' || val === '-') return 0;
  const num = parseFloat(String(val).replace(/,/g, '').trim());
  return isNaN(num) ? 0 : num;
}

const cachedOrderStatus: Record<string, { orders: any[]; total: number; totalPages: number }> = {};
// Rows per page of the last list request, so a revisit can show that cached first page before "Auto" has measured the table
const lastListRequest = { limit: 10 };

// Natural height of a list row (eye button + status badges + padding); "Auto" stretches rows slightly to fill the table area.
const ROW_HEIGHT = 41;

export default function OrderStatusScreen() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limitChoice, setLimitChoice] = useState<number | 'auto'>('auto');
  // The table area: "Auto" shows as many rows as fit in it, so the page neither scrolls nor leaves an empty band
  const scrollRef = useRef<HTMLDivElement>(null);
  const fit = useFitRows(scrollRef, ROW_HEIGHT);
  const limit = limitChoice === 'auto' ? (fit?.rows ?? null) : limitChoice;

  const initialKey = `1_${lastListRequest.limit}_`;
  const initialCache = cachedOrderStatus[initialKey];

  const [orders, setOrders] = useState<any[]>(() => initialCache?.orders || []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [totalPages, setTotalPages] = useState(() => initialCache?.totalPages || 1);
  const [total, setTotal] = useState(() => initialCache?.total || 0);

  // Detailed Modal State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [planData, setPlanData] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Bumped by a search submit so the fetch effect runs exactly once for it (also when already on page 1)
  const [searchRun, setSearchRun] = useState(0);
  // Only the newest list / detail request may update the screen (responses can arrive out of order)
  const latestRequestRef = useRef(0);
  const latestDetailRef = useRef(0);

  // When "Auto" fits a different number of rows (window or sidebar resized), keep the first visible row in view
  const [prevLimit, setPrevLimit] = useState(limit);
  if (limit !== prevLimit) {
    setPrevLimit(limit);
    if (limitChoice === 'auto' && prevLimit && limit) setPage(pageForNewLimit(page, prevLimit, limit));
  }

  const fetchOrderStatus = async () => {
    // "Auto" waits until the table area has been measured
    if (limit === null) return;
    lastListRequest.limit = limit;
    const key = `${page}_${limit}_${search}`;
    if (cachedOrderStatus[key]) {
      setOrders(cachedOrderStatus[key].orders);
      setTotal(cachedOrderStatus[key].total);
      setTotalPages(cachedOrderStatus[key].totalPages);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const requestId = ++latestRequestRef.current;
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
      });

      const data = await sharedGetJson<Partial<(typeof cachedOrderStatus)[string]>>(
        `${API_BASE}/api/orders/all-list?${query.toString()}`
      );

      if (data) {
        const ords = data.orders || [];
        const tTotal = data.total || 0;
        const tPages = data.totalPages || 1;
        cachedOrderStatus[key] = { orders: ords, total: tTotal, totalPages: tPages };
        // A newer request (page / search change) owns the table now
        if (requestId !== latestRequestRef.current) return;
        setOrders(ords);
        setTotal(tTotal);
        setTotalPages(tPages);
      }
    } catch (err) {
      console.error('Failed to load order status:', err);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderStatus();
    // The typed search applies on submit (searchRun), not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, searchRun]);

  const handleLimitChange = (newLimit: number | 'auto') => {
    setLimitChoice(newLimit);
    setPage(1);
  };

  // At most one page of rows (the previous page's rows are cut while a smaller page loads); "Auto" rows fill the table area
  const visibleOrders = limit ? orders.slice(0, limit) : orders;
  const rowStyle = limitChoice === 'auto' && fit ? { height: fit.rowHeight } : undefined;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchRun((n) => n + 1);
  };

  const openOrderDetails = async (orderNo: string) => {
    setModalLoading(true);
    const requestId = ++latestDetailRef.current;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderNo)}?dept=knitting`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        // Another order was clicked meanwhile: its response owns the modal
        if (requestId !== latestDetailRef.current) return;
        setSelectedOrder(data.order);
        setPlanData(data.planData);
      }
    } catch (err) {
      console.error('Failed to load order details:', err);
    } finally {
      if (requestId === latestDetailRef.current) setModalLoading(false);
    }
  };

  // Compute 10 summary metrics from raw items
  let allocatedQty = 0;
  let yarnBala = 0;
  let knitProd = 0;
  let knitBala = 0;
  let dyeingProd = 0;
  let dyeingBala = 0;
  let netDeliveryQty = 0;
  let slowMoving = 0;
  let deliBal = 0;
  let rfd = 0;

  if (selectedOrder) {
    (selectedOrder.knittingItems || []).forEach((item: any) => {
      knitProd += parseNum(item['Knit Prod.'] || item['KnitProd']);
      knitBala += parseNum(item['Knit. Bala.'] || item['KnitBala']);
    });

    (selectedOrder.dyeingItems || []).forEach((item: any) => {
      dyeingProd += parseNum(item['Dyeing Prod.'] || item['DyeingProd']);
      dyeingBala += parseNum(item['Dyeing Bala.'] || item['DyeingBala']);
    });

    (selectedOrder.deliveryItems || []).forEach((item: any) => {
      allocatedQty += parseNum(item['Allocated Qty '] || item['AllocatedQty'] || item['Allocated Qty']);
      yarnBala += parseNum(item['Yarn bala.'] || item['YarnBala'] || item['Yarn Bala']);
      netDeliveryQty += parseNum(item['NetDeliveryQtyKgs'] || item['NetDeliveryQty'] || item['DeliveryQty']);
      slowMoving += parseNum(item['Slowmoving']);
      deliBal += parseNum(item['Deli. Bal.'] || item['DeliBal'] || item['Delivery Balance'] || item['Deli. Bala.']);
      rfd += parseNum(item['RFD']);
    });
  }

  // Aggregate planning dates from planData
  let kStart = '—', kEnd = '—', kType = '—';
  let dStart = '—', dEnd = '—', dType = '—';
  let delStart = '—', delEnd = '—', delType = '—';
  let delFloorStart = '—', delFloorEnd = '—', delFloorType = '—';

  if (planData) {
    const getMin = (arr: string[]) => (arr.length ? [...arr].sort()[0] : '—');
    const getMax = (arr: string[]) => (arr.length ? [...arr].sort()[arr.length - 1] : '—');

    if (planData.knitting && Array.isArray(planData.knitting)) {
      const starts = planData.knitting.map((i: any) => i.startDate).filter(Boolean);
      const ends = planData.knitting.map((i: any) => i.endDate).filter(Boolean);
      kStart = getMin(starts);
      kEnd = getMax(ends);
      kType = planData.knitting.find((i: any) => i.planType)?.planType || '—';
    }

    if (planData.dyeing && Array.isArray(planData.dyeing)) {
      const starts = planData.dyeing.map((i: any) => i.startDate).filter(Boolean);
      const ends = planData.dyeing.map((i: any) => i.endDate).filter(Boolean);
      dStart = getMin(starts);
      dEnd = getMax(ends);
      dType = planData.dyeing.find((i: any) => i.planType)?.planType || '—';
    }

    if (planData.delivery && Array.isArray(planData.delivery)) {
      const starts = planData.delivery.map((i: any) => i.startDate).filter(Boolean);
      const ends = planData.delivery.map((i: any) => i.endDate).filter(Boolean);
      delStart = getMin(starts);
      delEnd = getMax(ends);
      delType = planData.delivery.find((i: any) => i.planType)?.planType || '—';

      const fStarts = planData.delivery.map((i: any) => i.floorStartDate).filter(Boolean);
      const fEnds = planData.delivery.map((i: any) => i.floorEndDate).filter(Boolean);
      delFloorStart = getMin(fStarts);
      delFloorEnd = getMax(fEnds);
      delFloorType = planData.delivery.find((i: any) => i.floorPlanType)?.floorPlanType || '—';
    }
  }

  return (
    // The page fills the content area: the header and the pagination stay put, only the table rows scroll.
    <div className="flex h-full min-h-0 w-full flex-col gap-6">
      {/* Header */}
      <div className="flex-none flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Order Status Cross-Department Pipeline
          </h2>
          <p className="text-xs text-base-content/60">
            Bird's-eye view tracking active production orders across Knitting, Dyeing, Finishing, and Delivery.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Booking / Order No..."
              className="input input-bordered input-sm w-48 sm:w-64 pl-8 text-xs"
            />
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/50" />
          </div>
          <button type="submit" className="btn btn-primary btn-sm font-bold text-xs">
            Search
          </button>
        </form>
      </div>

      {/* Orders Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden flex-1 min-h-0 relative flex flex-col">
        {/* Exact Exp 3-Ring Loading Overlay */}
        {loading && (
          <LoadingSpinner
            message="Compiling Order Data..."
            subMessage="Fetching records from all departments"
          />
        )}

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          <table className="table table-sm w-full">
            {/* Sticky header: an opaque base under the same tint, so scrolled rows do not show through */}
            <thead className="sticky top-0 z-10 bg-base-100 text-xs">
              <tr className="bg-base-200/60">
                <th className="text-center w-12">Action</th>
                <th>Booking / Order No</th>
                <th>Buyer</th>
                <th>Booking Date</th>
                <th>Knitting Stage</th>
                <th>Dyeing Stage</th>
                <th>Finishing Stage</th>
                <th>Delivery Stage</th>
                <th>Overall Status</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {!loading && visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-base-content/60">
                    No orders found.
                  </td>
                </tr>
              ) : (
                visibleOrders.map((ord) => (
                  <tr key={ord._id} style={rowStyle} className="hover">
                    <td className="text-center">
                      <button
                        onClick={() => openOrderDetails(ord.orderNo)}
                        className="btn btn-ghost btn-xs text-primary"
                        title="View Detailed Summary"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="font-bold text-primary">{ord.orderNo}</td>
                    <td className="font-semibold">{ord.buyer}</td>
                    <td>{formatDateDisplay(ord.bookingDate)}</td>
                    <td>
                      <span className={`badge badge-sm font-bold ${STATUS_COLORS[ord.knittingPlanStatus] || 'badge-neutral'}`}>
                        {ord.knittingPlanStatus || 'Pending'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-sm font-bold ${STATUS_COLORS[ord.dyeingPlanStatus] || 'badge-neutral'}`}>
                        {ord.dyeingPlanStatus || 'Pending'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-sm font-bold ${STATUS_COLORS[ord.finishingPlanStatus] || 'badge-neutral'}`}>
                        {ord.finishingPlanStatus || 'Pending'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-sm font-bold ${STATUS_COLORS[ord.deliveryPlanStatus] || 'badge-neutral'}`}>
                        {ord.deliveryPlanStatus || 'Pending'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-sm badge-outline font-bold">
                        {ord.status || 'Active'}
                      </span>
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
          limit={limit ?? fit?.rows ?? 10}
          onPageChange={(newPage) => setPage(newPage)}
          onLimitChange={handleLimitChange}
          autoRows={fit?.rows}
          isAuto={limitChoice === 'auto'}
        />
      </div>

      {/* Detailed Modal replicating Exp order-status.js */}
      {(selectedOrder || modalLoading) && (
        <div className="modal modal-open">
          <div className="modal-box max-w-5xl space-y-5 p-6 border border-base-300">
            <div className="flex items-center justify-between border-b border-base-200 pb-3">
              <div>
                <h3 className="font-black text-lg text-primary flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Order Pipeline Summary: #{selectedOrder?.orderNo}
                </h3>
                <p className="text-xs text-base-content/60">
                  Buyer: <span className="font-bold text-base-content">{selectedOrder?.buyer || 'N/A'}</span>
                </p>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="btn btn-sm btn-circle btn-ghost"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalLoading ? (
              <div className="p-16 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                <span className="text-xs font-semibold text-base-content/60">
                  Loading order detailed specifications...
                </span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 10 Summary Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-base-200/60 p-3 rounded-lg border border-base-300">
                    <span className="text-[10px] uppercase font-bold text-base-content/60 block">Allocated Qty</span>
                    <span className="text-base font-black text-base-content mt-1">{allocatedQty.toLocaleString()}</span>
                  </div>
                  <div className="bg-base-200/60 p-3 rounded-lg border border-base-300">
                    <span className="text-[10px] uppercase font-bold text-base-content/60 block">Yarn Bala</span>
                    <span className="text-base font-black text-base-content mt-1">{yarnBala.toLocaleString()}</span>
                  </div>
                  <div className="bg-base-200/60 p-3 rounded-lg border border-base-300">
                    <span className="text-[10px] uppercase font-bold text-base-content/60 block">Knit Prod</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1">{knitProd.toLocaleString()}</span>
                  </div>
                  <div className="bg-base-200/60 p-3 rounded-lg border border-base-300">
                    <span className="text-[10px] uppercase font-bold text-base-content/60 block">Dyeing Prod</span>
                    <span className="text-base font-black text-emerald-600 mt-1">{dyeingProd.toLocaleString()}</span>
                  </div>
                  <div className="bg-base-200/60 p-3 rounded-lg border border-base-300">
                    <span className="text-[10px] uppercase font-bold text-base-content/60 block">Net Delivery Qty</span>
                    <span className="text-base font-black text-amber-600 mt-1">{netDeliveryQty.toLocaleString()}</span>
                  </div>

                  <div className="bg-base-200/60 p-3 rounded-lg border border-base-300">
                    <span className="text-[10px] uppercase font-bold text-base-content/60 block">Slow Moving</span>
                    <span className="text-base font-black text-base-content mt-1">{slowMoving.toLocaleString()}</span>
                  </div>
                  <div className="bg-base-200/60 p-3 rounded-lg border border-base-300">
                    <span className="text-[10px] uppercase font-bold text-base-content/60 block">Knit Bala</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1">{knitBala.toLocaleString()}</span>
                  </div>
                  <div className="bg-base-200/60 p-3 rounded-lg border border-base-300">
                    <span className="text-[10px] uppercase font-bold text-base-content/60 block">Dyeing Bala</span>
                    <span className="text-base font-black text-emerald-600 mt-1">{dyeingBala.toLocaleString()}</span>
                  </div>
                  <div className="bg-base-200/60 p-3 rounded-lg border border-base-300">
                    <span className="text-[10px] uppercase font-bold text-base-content/60 block">Deli Bal</span>
                    <span className="text-base font-black text-amber-600 mt-1">{deliBal.toLocaleString()}</span>
                  </div>
                  <div className="bg-base-200/60 p-3 rounded-lg border border-base-300">
                    <span className="text-[10px] uppercase font-bold text-base-content/60 block">RFD</span>
                    <span className="text-base font-black text-base-content mt-1">{rfd.toLocaleString()}</span>
                  </div>
                </div>

                {/* 12-Column Cross-Department Matrix */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase text-base-content/70">
                    Cross-Department Planning Timeline Matrix
                  </h4>
                  <div className="overflow-x-auto border border-base-300 rounded-lg">
                    <table className="table table-xs w-full text-center">
                      <thead className="bg-base-200 text-[10px]">
                        <tr>
                          <th colSpan={3} className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-r border-base-300">
                            Knitting Plan
                          </th>
                          <th colSpan={3} className="bg-emerald-500/10 text-emerald-700 border-r border-base-300">
                            Dyeing Plan
                          </th>
                          <th colSpan={3} className="bg-amber-500/10 text-amber-700 border-r border-base-300">
                            Delivery Plan
                          </th>
                          <th colSpan={3} className="bg-purple-500/10 text-purple-700">
                            Delivery (Floor) Plan
                          </th>
                        </tr>
                        <tr className="border-t border-base-300">
                          <th className="border-r border-base-200">Start Date</th>
                          <th className="border-r border-base-200">End Date</th>
                          <th className="border-r border-base-300">Type</th>

                          <th className="border-r border-base-200">Start Date</th>
                          <th className="border-r border-base-200">End Date</th>
                          <th className="border-r border-base-300">Type</th>

                          <th className="border-r border-base-200">Start Date</th>
                          <th className="border-r border-base-200">End Date</th>
                          <th className="border-r border-base-300">Type</th>

                          <th className="border-r border-base-200">Start Date</th>
                          <th className="border-r border-base-200">End Date</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-semibold">
                        <tr>
                          <td className="border-r border-base-200 text-emerald-700 dark:text-emerald-400">{formatDateDisplay(kStart) || '—'}</td>
                          <td className="border-r border-base-200 text-emerald-700 dark:text-emerald-400">{formatDateDisplay(kEnd) || '—'}</td>
                          <td className="border-r border-base-300 font-bold bg-emerald-500/5">{kType}</td>

                          <td className="border-r border-base-200 text-emerald-600">{formatDateDisplay(dStart) || '—'}</td>
                          <td className="border-r border-base-200 text-emerald-600">{formatDateDisplay(dEnd) || '—'}</td>
                          <td className="border-r border-base-300 font-bold bg-emerald-500/5">{dType}</td>

                          <td className="border-r border-base-200 text-amber-600">{formatDateDisplay(delStart) || '—'}</td>
                          <td className="border-r border-base-200 text-amber-600">{formatDateDisplay(delEnd) || '—'}</td>
                          <td className="border-r border-base-300 font-bold bg-amber-500/5">{delType}</td>

                          <td className="border-r border-base-200 text-purple-600">{formatDateDisplay(delFloorStart) || '—'}</td>
                          <td className="border-r border-base-200 text-purple-600">{formatDateDisplay(delFloorEnd) || '—'}</td>
                          <td className="font-bold bg-purple-500/5">{delFloorType}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
