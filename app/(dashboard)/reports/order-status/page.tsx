'use client';

import React, { useState, useEffect } from 'react';
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

function parseNum(val: any): number {
  if (val === undefined || val === null || val === '' || val === '-') return 0;
  const num = parseFloat(String(val).replace(/,/g, '').trim());
  return isNaN(num) ? 0 : num;
}

export default function OrderStatusPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Detailed Modal State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [planData, setPlanData] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchOrderStatus = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const query = new URLSearchParams({
        page: String(page),
        limit: '15',
        search,
      });

      const res = await fetch(`${API_BASE}/api/orders/all-list?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load order status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderStatus();
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrderStatus();
  };

  const openOrderDetails = async (orderNo: string) => {
    setModalLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderNo)}?dept=knitting`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data.order);
        setPlanData(data.planData);
      }
    } catch (err) {
      console.error('Failed to load order details:', err);
    } finally {
      setModalLoading(false);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="table table-sm w-full">
            <thead className="bg-base-200/60 text-xs">
              <tr>
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
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
                    <span className="loading loading-spinner text-primary" />
                    <p className="mt-2 text-xs text-base-content/60">Loading pipeline status...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-base-content/60">
                    No orders found.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord._id} className="hover">
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

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-base-300 px-4 py-3 text-xs">
          <span className="text-base-content/60">
            Total {total} orders (Page {page} of {totalPages})
          </span>
          <div className="join">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn btn-xs join-item"
            >
              Prev
            </button>
            <button className="btn btn-xs join-item btn-active">{page}</button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="btn btn-xs join-item"
            >
              Next
            </button>
          </div>
        </div>
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
                    <span className="text-base font-black text-blue-600 mt-1">{knitProd.toLocaleString()}</span>
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
                    <span className="text-base font-black text-blue-600 mt-1">{knitBala.toLocaleString()}</span>
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
                          <th colSpan={3} className="bg-blue-500/10 text-blue-700 border-r border-base-300">
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
                          <td className="border-r border-base-200 text-blue-600">{formatDateDisplay(kStart) || '—'}</td>
                          <td className="border-r border-base-200 text-blue-600">{formatDateDisplay(kEnd) || '—'}</td>
                          <td className="border-r border-base-300 font-bold bg-blue-500/5">{kType}</td>

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
