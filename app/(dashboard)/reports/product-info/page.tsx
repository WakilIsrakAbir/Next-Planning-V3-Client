'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Search, ChevronRight, ChevronDown, Download, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';
import ExpPagination from '@/components/common/ExpPagination';

export default function ProductInfoPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

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
            View order specifications, yarn balance, and color-wise allocation breakdowns.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="btn btn-outline btn-sm gap-2"
        >
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
        {/* Exact Exp 3-Ring Loading Overlay */}
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
                              <div className="flex py-4 justify-center">
                                <ExpLoadingSpinner message="Loading Details..." size="sm" overlay={false} />
                              </div>
                            ) : orderDetails ? (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-base-100 p-3 rounded-lg border border-base-300 text-xs">
                                  <div>
                                    <span className="text-base-content/50 block text-[10px]">Order No</span>
                                    <span className="font-bold">{orderDetails.orderNo}</span>
                                  </div>
                                  <div>
                                    <span className="text-base-content/50 block text-[10px]">Buyer</span>
                                    <span className="font-bold">{orderDetails.buyer}</span>
                                  </div>
                                  <div>
                                    <span className="text-base-content/50 block text-[10px]">Style</span>
                                    <span className="font-bold">{orderDetails.style || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="text-base-content/50 block text-[10px]">Required Qty</span>
                                    <span className="font-bold">{orderDetails.requiredQtyKgs || 0} kg</span>
                                  </div>
                                </div>

                                {/* Items table */}
                                <div className="rounded-lg border border-base-300 overflow-hidden bg-base-100">
                                  <div className="bg-base-200 px-3 py-1.5 text-[11px] font-bold">
                                    Fabric & Color Breakdown ({orderDetails.knittingItems?.length || 0} items)
                                  </div>
                                  <table className="table table-xs">
                                    <thead className="bg-base-200/40 text-[10px]">
                                      <tr>
                                        <th>Color</th>
                                        <th>Fabric Construction</th>
                                        <th>GSM</th>
                                        <th>Dia</th>
                                        <th>Grey Req</th>
                                        <th>Knit Prod</th>
                                        <th>Knit Bala</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(orderDetails.knittingItems || []).map((it: any, idx: number) => (
                                        <tr key={idx} className="hover">
                                          <td className="font-bold">{it.Color || it.color || '—'}</td>
                                          <td>{it.FabricConstruction || it.fabric || '—'}</td>
                                          <td>{it.GSM || it.gsm || '—'}</td>
                                          <td>{it.Dia || it.dia || '—'}</td>
                                          <td>{it.GreyReq || it.greyReq || '—'}</td>
                                          <td>{it.KnitProd || it.knitProd || '—'}</td>
                                          <td className="font-bold text-primary">{it.KnitBala || it.knitBala || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
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
