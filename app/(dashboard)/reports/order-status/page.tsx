'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Search, Filter, RefreshCw, Eye } from 'lucide-react';
import { API_BASE, STATUS_COLORS } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';

export default function OrderStatusPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

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

  return (
    <div className="space-y-6">
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
                  <td colSpan={8} className="p-12 text-center">
                    <span className="loading loading-spinner text-primary" />
                    <p className="mt-2 text-xs text-base-content/60">Loading pipeline status...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-base-content/60">
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
    </div>
  );
}
