'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Calendar,
  Layers,
} from 'lucide-react';
import { API_BASE } from '@/lib/constants';
import { formatDateDisplay, calcLeadDay, calcOTTStatus } from '@/lib/date-utils';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';
import ExpPagination from '@/components/common/ExpPagination';

export default function PlanningProdInfoPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [planData, setPlanData] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/orders/all-list?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 1);
        }
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
      console.error('Failed to load order detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!selectedOrder ? (
        <>
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Booking / Order No..."
                className="input input-bordered input-sm w-48 sm:w-64 pl-8 text-xs"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/50" />
            </div>
          </div>

          {/* Order List Table */}
          <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden relative min-h-[360px]">
            {/* Exact Exp 3-Ring Loading Overlay */}
            {loading && (
              <ExpLoadingSpinner
                message="Processing PPI Records..."
                subMessage="Fetching 3-section order specifications"
              />
            )}

            <div className="overflow-x-auto flex-1">
              <table className="table table-sm w-full">
                <thead className="bg-base-200/60 text-xs">
                  <tr>
                    <th>Order / Booking No</th>
                    <th>Buyer</th>
                    <th>Booking Date</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {!loading && orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-base-content/60">
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    orders.map((ord) => (
                      <tr key={ord._id} className="hover">
                        <td className="font-bold text-primary">{ord.orderNo}</td>
                        <td className="font-semibold">{ord.buyer}</td>
                        <td>{formatDateDisplay(ord.bookingDate)}</td>
                        <td>
                          <span className="badge badge-sm badge-outline font-bold">
                            {ord.status || 'Active'}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => loadOrderDetail(ord.orderNo)}
                            className="btn btn-xs btn-primary font-bold"
                          >
                            Open 3-Section PPI &rarr;
                          </button>
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
        <div className="space-y-6">
          {/* Detailed View Header */}
          <div className="flex items-center justify-between border-b border-base-300 pb-4">
            <button
              onClick={() => setSelectedOrder(null)}
              className="btn btn-sm btn-ghost gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Order List
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="btn btn-sm btn-outline font-bold"
              >
                <Printer className="w-4 h-4 mr-1" /> Print PPI Report
              </button>
            </div>
          </div>

          {detailLoading ? (
            <div className="p-12 text-center">
              <ExpLoadingSpinner message="Loading Order Details..." size="sm" overlay={false} />
            </div>
          ) : (
            <div className="space-y-6">
              {/* SECTION 1: ORDER SPECIFICATIONS */}
              <div className="card bg-base-100 border border-base-300 p-6 shadow-sm">
                <div className="border-b border-base-200 pb-3 mb-4 flex items-center justify-between">
                  <h3 className="text-base font-black text-primary uppercase tracking-wide">
                    Section 1: General Information & Order Specifications
                  </h3>
                  <span className="badge badge-primary font-bold">
                    Order: {selectedOrder.orderNo}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-base-content/60 block">Buyer Brand:</span>
                    <strong className="text-sm font-bold">{selectedOrder.buyer}</strong>
                  </div>
                  <div>
                    <span className="text-base-content/60 block">Style Number:</span>
                    <strong className="text-sm font-bold">{selectedOrder.style || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-base-content/60 block">Booking Date:</span>
                    <strong>{formatDateDisplay(selectedOrder.bookingDate)}</strong>
                  </div>
                  <div>
                    <span className="text-base-content/60 block">Required Order Qty:</span>
                    <strong className="font-mono text-sm">{selectedOrder.requiredQtyKgs?.toLocaleString() || '—'} Kgs</strong>
                  </div>
                  <div>
                    <span className="text-base-content/60 block">GMT Unit / Floor:</span>
                    <strong>{selectedOrder.gmtUnit || selectedOrder.floor || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-base-content/60 block">Merchandiser / PMC:</span>
                    <strong>{selectedOrder.bookedBy || selectedOrder.pmc || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-base-content/60 block">BP Status Date:</span>
                    <strong>{formatDateDisplay(selectedOrder.bpStatus)}</strong>
                  </div>
                  <div>
                    <span className="text-base-content/60 block">Program Type:</span>
                    <strong>{selectedOrder.programType || '—'}</strong>
                  </div>
                </div>

                {selectedOrder.fabricNotes && (
                  <div className="mt-4 p-3 bg-base-200/50 rounded-lg text-xs">
                    <span className="font-bold text-base-content/70 block mb-1">Fabric & Technical Notes:</span>
                    <p>{selectedOrder.fabricNotes}</p>
                  </div>
                )}
              </div>

              {/* SECTION 2: PRODUCTION MILESTONES & LEAD TIMES WITH OTT PASS/FAIL */}
              <div className="card bg-base-100 border border-base-300 p-6 shadow-sm">
                <div className="border-b border-base-200 pb-3 mb-4">
                  <h3 className="text-base font-black text-secondary uppercase tracking-wide">
                    Section 2: Production Milestones, Lead Times & OTT Status
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="table table-sm w-full text-xs">
                    <thead className="bg-base-200/60 font-bold">
                      <tr>
                        <th>Milestone Stage</th>
                        <th>Target Plan Start</th>
                        <th>Target Plan End</th>
                        <th>Actual Floor End</th>
                        <th>Lead Days</th>
                        <th>OTT Status (On-Time)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Yarn Ok */}
                      <tr>
                        <td className="font-bold">Yarn Ok Date</td>
                        <td>{formatDateDisplay(selectedOrder.yarnDate)}</td>
                        <td>{formatDateDisplay(selectedOrder.yarnDate)}</td>
                        <td>{formatDateDisplay(planData?.knittingActual?.yarnDate || selectedOrder.yarnDate)}</td>
                        <td>{calcLeadDay(selectedOrder.yarnDate, planData?.knittingActual?.yarnDate || selectedOrder.yarnDate)}</td>
                        <td>
                          {calcOTTStatus(selectedOrder.yarnDate, planData?.knittingActual?.yarnDate || selectedOrder.yarnDate) === 'Pass' ? (
                            <span className="badge badge-success badge-sm font-bold text-white flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Pass
                            </span>
                          ) : (
                            <span className="badge badge-error badge-sm font-bold text-white flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Fail
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Knitting */}
                      <tr>
                        <td className="font-bold">Knitting Production</td>
                        <td>{formatDateDisplay(selectedOrder.knitStart)}</td>
                        <td>{formatDateDisplay(selectedOrder.knitEnd)}</td>
                        <td>{formatDateDisplay(planData?.knittingActual?.actualEnd)}</td>
                        <td>{calcLeadDay(selectedOrder.knitEnd, planData?.knittingActual?.actualEnd)}</td>
                        <td>
                          {calcOTTStatus(selectedOrder.knitEnd, planData?.knittingActual?.actualEnd) === 'Pass' ? (
                            <span className="badge badge-success badge-sm font-bold text-white flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Pass
                            </span>
                          ) : (
                            <span className="badge badge-error badge-sm font-bold text-white flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Fail
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Dyeing */}
                      <tr>
                        <td className="font-bold">Dyeing Production</td>
                        <td>{formatDateDisplay(selectedOrder.dyeStart)}</td>
                        <td>{formatDateDisplay(selectedOrder.dyeEnd)}</td>
                        <td>{formatDateDisplay(planData?.dyeingActual?.actualEnd)}</td>
                        <td>{calcLeadDay(selectedOrder.dyeEnd, planData?.dyeingActual?.actualEnd)}</td>
                        <td>
                          {calcOTTStatus(selectedOrder.dyeEnd, planData?.dyeingActual?.actualEnd) === 'Pass' ? (
                            <span className="badge badge-success badge-sm font-bold text-white flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Pass
                            </span>
                          ) : (
                            <span className="badge badge-error badge-sm font-bold text-white flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Fail
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Delivery */}
                      <tr>
                        <td className="font-bold">Delivery & Shipment</td>
                        <td>{formatDateDisplay(selectedOrder.deliStart)}</td>
                        <td>{formatDateDisplay(selectedOrder.deliEnd)}</td>
                        <td>{formatDateDisplay(planData?.deliveryActual?.actualEnd)}</td>
                        <td>{calcLeadDay(selectedOrder.deliEnd, planData?.deliveryActual?.actualEnd)}</td>
                        <td>
                          {calcOTTStatus(selectedOrder.deliEnd, planData?.deliveryActual?.actualEnd) === 'Pass' ? (
                            <span className="badge badge-success badge-sm font-bold text-white flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Pass
                            </span>
                          ) : (
                            <span className="badge badge-error badge-sm font-bold text-white flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Fail
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 3: COLOR SUMMARY & DEPARTMENT BALANCES */}
              <div className="card bg-base-100 border border-base-300 p-6 shadow-sm">
                <div className="border-b border-base-200 pb-3 mb-4">
                  <h3 className="text-base font-black text-accent uppercase tracking-wide">
                    Section 3: Color Summary & Department Fabric Breakdown
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="table table-xs w-full text-xs">
                    <thead className="bg-base-200 font-bold">
                      <tr>
                        <th>Color Name</th>
                        <th>Construction</th>
                        <th>GSM</th>
                        <th>Grey Req</th>
                        <th>Knit Prod</th>
                        <th>Knit Bala</th>
                        <th>Dyeing Prod</th>
                        <th>Dyeing Bala</th>
                        <th>Delivery Qty</th>
                        <th>Delivery Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrder.knittingItems || selectedOrder.dyeingItems || []).map((it: any, idx: number) => (
                        <tr key={idx} className="hover">
                          <td className="font-bold">{it.Color || it.color || '—'}</td>
                          <td>{it.FabricConstruction || it.fabricConstruction || '—'}</td>
                          <td>{it.GSM || it.gsm || '—'}</td>
                          <td className="font-mono">{it.GreyReq || it['Grey Req.'] || '—'}</td>
                          <td className="font-mono">{it.KnitProd || it['Knit Prod.'] || '—'}</td>
                          <td className="font-mono text-warning font-bold">{it.KnitBala || it['Knit. Bala.'] || '—'}</td>
                          <td className="font-mono">{it.DyeingProd || it['Dyeing Prod.'] || '—'}</td>
                          <td className="font-mono text-warning font-bold">{it.DyeingBala || it['Dyeing Bala.'] || '—'}</td>
                          <td className="font-mono">{it.NetDeliveryQtyKgs || it.NetDeliveryQty || '—'}</td>
                          <td className="font-mono text-error font-bold">{it.DeliBal || it['Deli. Bal.'] || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
