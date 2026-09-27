'use client';

import React, { useState, useEffect, use } from 'react';
import {
  Activity,
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Save,
  X,
} from 'lucide-react';
import { API_BASE, DEPARTMENTS } from '@/lib/constants';
import { formatDateDisplay, calcLeadDay } from '@/lib/date-utils';
import { ITrackingOrder } from '@/types/order';

interface PageProps {
  params: Promise<{ dept: string }>;
}

export default function TrackingPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';
  const deptConfig = DEPARTMENTS[dept] || { name: `${dept.toUpperCase()} Tracking` };

  const [orders, setOrders] = useState<ITrackingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [buyer, setBuyer] = useState('');
  const [availableBuyers, setAvailableBuyers] = useState<string[]>([]);
  const [startMin, setStartMin] = useState('');
  const [startMax, setStartMax] = useState('');
  const [endMin, setEndMin] = useState('');
  const [endMax, setEndMax] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Edit floor actual modal
  const [editingOrder, setEditingOrder] = useState<ITrackingOrder | null>(null);
  const [actualStart, setActualStart] = useState('');
  const [actualEnd, setActualEnd] = useState('');
  const [actualProd, setActualProd] = useState('');
  const [actualStatus, setActualStatus] = useState('Pending');
  const [saveLoading, setSaveLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchTracking = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const query = new URLSearchParams({
        page: String(page),
        limit: '10',
        buyer,
        search,
        startMin,
        startMax,
        endMin,
        endMax,
      });

      const res = await fetch(`${API_BASE}/api/orders/tracking/${dept}?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.buyers) setAvailableBuyers(data.buyers);
      }
    } catch (err) {
      console.error('Failed to fetch tracking data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
  }, [dept, buyer, page, startMin, startMax, endMin, endMax]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTracking();
  };

  const openEditActualModal = (ord: ITrackingOrder) => {
    setEditingOrder(ord);
    setActualStart(ord.actualStart || '');
    setActualEnd(ord.actualEnd || '');
    setActualProd(ord.actualProd || '');
    setActualStatus(ord.actualStatus || 'Pending');
  };

  const handleSaveFloorActual = async () => {
    if (!editingOrder) return;
    setSaveLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/orders/save-dates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderNo: editingOrder.orderNo,
          department: `${dept}Actual`,
          actualData: {
            actualStart,
            actualEnd,
            actualProd,
            status: actualStatus,
          },
        }),
      });

      if (res.ok) {
        setToastMessage(`Floor progress saved for ${editingOrder.orderNo}!`);
        setTimeout(() => setToastMessage(null), 3000);
        setEditingOrder(null);
        fetchTracking();
      }
    } catch (err) {
      console.error('Failed to save actuals:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  const downloadTrackingExcel = () => {
    const token = localStorage.getItem('token');
    const query = new URLSearchParams({ buyer, search });
    window.open(`${API_BASE}/api/orders/tracking-download/${dept}?${query.toString()}&token=${token}`, '_blank');
  };

  return (
    <div className="space-y-6">
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Plan vs Actual Floor Tracking: <span className="uppercase">{dept}</span>
          </h2>
          <p className="text-xs text-base-content/60">
            Monitor confirmed production schedules against actual floor completion and lead time variances.
          </p>
        </div>

        <button
          onClick={downloadTrackingExcel}
          className="btn btn-sm btn-outline btn-primary font-bold shadow-sm"
        >
          <Download className="w-4 h-4 mr-1" /> Export Tracking Excel
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card bg-base-100 p-4 border border-base-300 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Buyer */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-base-content/60" />
            <select
              value={buyer}
              onChange={(e) => {
                setBuyer(e.target.value);
                setPage(1);
              }}
              className="select select-bordered select-sm text-xs font-semibold"
            >
              <option value="">All Confirmed Buyers ({availableBuyers.length})</option>
              {availableBuyers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Booking No..."
                className="input input-bordered input-sm w-48 sm:w-64 pl-8 text-xs"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/50" />
            </div>
            <button type="submit" className="btn btn-primary btn-sm font-bold text-xs">
              Search
            </button>
          </form>
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-base-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base-content/70">Plan Start:</span>
            <input
              type="date"
              value={startMin}
              onChange={(e) => setStartMin(e.target.value)}
              className="input input-bordered input-xs"
            />
            <span>to</span>
            <input
              type="date"
              value={startMax}
              onChange={(e) => setStartMax(e.target.value)}
              className="input input-bordered input-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-base-content/70">Plan End:</span>
            <input
              type="date"
              value={endMin}
              onChange={(e) => setEndMin(e.target.value)}
              className="input input-bordered input-xs"
            />
            <span>to</span>
            <input
              type="date"
              value={endMax}
              onChange={(e) => setEndMax(e.target.value)}
              className="input input-bordered input-xs"
            />
          </div>

          {(startMin || startMax || endMin || endMax || buyer || search) && (
            <button
              onClick={() => {
                setStartMin('');
                setStartMax('');
                setEndMin('');
                setEndMax('');
                setBuyer('');
                setSearch('');
                setPage(1);
              }}
              className="btn btn-ghost btn-xs text-error font-bold"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Tracking Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="table table-sm w-full">
            <thead className="bg-base-200/60 text-xs">
              <tr>
                <th>Booking / Order No</th>
                <th>Buyer</th>
                <th>Plan Start</th>
                <th>Plan End</th>
                <th>Actual Start</th>
                <th>Actual End</th>
                <th>Actual Prod</th>
                <th>Lead Days Variance</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center">
                    <span className="loading loading-spinner text-primary" />
                    <p className="mt-2 text-xs text-base-content/60">Loading floor tracking data...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-base-content/60">
                    No confirmed orders matching tracking filters.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const leadDays = calcLeadDay(ord.planEnd, ord.actualEnd);
                  const isDelayed = leadDays.startsWith('+');
                  const isOnTime = leadDays === '0';
                  const isAhead = leadDays.startsWith('-');

                  return (
                    <tr key={ord.orderNo} className="hover">
                      <td className="font-bold text-primary">{ord.orderNo}</td>
                      <td className="font-semibold">{ord.buyer}</td>
                      <td>{formatDateDisplay(ord.planStart)}</td>
                      <td>{formatDateDisplay(ord.planEnd)}</td>
                      <td>{formatDateDisplay(ord.actualStart)}</td>
                      <td>{formatDateDisplay(ord.actualEnd)}</td>
                      <td className="font-mono">{ord.actualProd || '—'}</td>
                      <td>
                        {leadDays === '—' ? (
                          <span className="text-base-content/50">—</span>
                        ) : isDelayed ? (
                          <span className="badge badge-error badge-sm font-bold text-white">
                            {leadDays} Days Delay
                          </span>
                        ) : isOnTime ? (
                          <span className="badge badge-success badge-sm font-bold text-white">
                            On Time
                          </span>
                        ) : (
                          <span className="badge badge-info badge-sm font-bold text-white">
                            {leadDays} Days Ahead
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm font-bold ${
                            ord.actualStatus === 'Complete' ? 'badge-success' : 'badge-neutral'
                          }`}
                        >
                          {ord.actualStatus || 'Pending'}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => openEditActualModal(ord)}
                          className="btn btn-xs btn-outline btn-primary font-bold"
                        >
                          Update Floor
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-base-300 px-4 py-3 text-xs">
          <span className="text-base-content/60">
            Total {total} confirmed orders (Page {page} of {totalPages})
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

      {/* Floor Execution Entry Modal */}
      {editingOrder && (
        <div className="modal modal-open">
          <div className="modal-box w-full max-w-md p-6">
            <div className="flex items-center justify-between border-b border-base-300 pb-3">
              <h3 className="font-bold text-base">
                Record Floor Actual: <span className="text-primary">{editingOrder.orderNo}</span>
              </h3>
              <button
                onClick={() => setEditingOrder(null)}
                className="btn btn-sm btn-circle btn-ghost"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="bg-base-200/60 p-3 rounded-lg flex justify-between">
                <div>
                  <span className="text-base-content/60 block">Plan Start:</span>
                  <strong>{formatDateDisplay(editingOrder.planStart)}</strong>
                </div>
                <div>
                  <span className="text-base-content/60 block">Plan End:</span>
                  <strong>{formatDateDisplay(editingOrder.planEnd)}</strong>
                </div>
              </div>

              <div className="form-control">
                <label className="label py-1 font-bold">Actual Start Date</label>
                <input
                  type="date"
                  value={actualStart}
                  onChange={(e) => setActualStart(e.target.value)}
                  className="input input-bordered input-sm"
                />
              </div>

              <div className="form-control">
                <label className="label py-1 font-bold">Actual End Date</label>
                <input
                  type="date"
                  value={actualEnd}
                  onChange={(e) => setActualEnd(e.target.value)}
                  className="input input-bordered input-sm"
                />
              </div>

              <div className="form-control">
                <label className="label py-1 font-bold">Actual Production Qty (Kgs / Pcs)</label>
                <input
                  type="text"
                  value={actualProd}
                  onChange={(e) => setActualProd(e.target.value)}
                  placeholder="e.g. 5200"
                  className="input input-bordered input-sm"
                />
              </div>

              <div className="form-control">
                <label className="label py-1 font-bold">Floor Completion Status</label>
                <select
                  value={actualStatus}
                  onChange={(e) => setActualStatus(e.target.value)}
                  className="select select-bordered select-sm font-bold"
                >
                  <option value="Pending">Pending</option>
                  <option value="On Process">On Process</option>
                  <option value="Complete">Complete</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-base-300 pt-3">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="btn btn-sm btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFloorActual}
                disabled={saveLoading}
                className="btn btn-sm btn-primary font-bold"
              >
                {saveLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" /> Save Floor Record
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
