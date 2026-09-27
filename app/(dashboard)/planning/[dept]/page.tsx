'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Search,
  Filter,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { API_BASE, DEPARTMENTS, STATUS_COLORS } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import { PlanStatus } from '@/types/order';

interface PageProps {
  params: Promise<{ dept: string }>;
}

export default function DepartmentPlanningPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';
  const deptConfig = DEPARTMENTS[dept] || { name: `${dept.toUpperCase()} Plan`, color: '#10b981' };

  const [activeTab, setActiveTab] = useState<PlanStatus>('Pending');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [buyer, setBuyer] = useState('');
  const [availableBuyers, setAvailableBuyers] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  // Fetch buyers for this department
  useEffect(() => {
    const fetchBuyers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/orders/buyers/${dept}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableBuyers(data);
        }
      } catch {}
    };
    fetchBuyers();
  }, [dept]);


  // Fetch paginated department orders
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const query = new URLSearchParams({
        dept,
        status: activeTab,
        buyer,
        page: String(page),
        limit: '10',
        search,
      });

      const res = await fetch(`${API_BASE}/api/orders?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setTotalPages(data.totalPages || 1);
        setTotalOrders(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [dept, activeTab, buyer, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            {deptConfig.name}
          </h2>
          <p className="text-xs text-base-content/60">
            Schedule fabric milestones and manage machine allocations for {dept.toUpperCase()}.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="tabs tabs-boxed bg-base-100 p-1 border border-base-300">
          {(['Pending', 'Confirm', 'Tentative', 'Completed'] as PlanStatus[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
              className={`tab tab-sm font-bold transition-all ${
                activeTab === tab ? 'tab-active !bg-primary text-primary-content shadow-sm' : ''
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card bg-base-100 p-4 border border-base-300 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Buyer Filter */}
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
              <option value="">All Buyers ({availableBuyers.length})</option>
              {availableBuyers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Search Form */}
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
            {(search || buyer) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setBuyer('');
                  setPage(1);
                }}
                className="btn btn-ghost btn-sm text-xs"
              >
                Reset
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="table table-sm w-full">
            <thead className="bg-base-200/60 text-xs">
              <tr>
                <th>Order / Booking No</th>
                <th>Buyer</th>
                <th>Style</th>
                <th>Booking Date</th>
                <th>Required Qty</th>
                <th>Unit / Floor</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <span className="loading loading-spinner text-primary" />
                    <p className="mt-2 text-xs text-base-content/60">Loading orders...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-base-content/60">
                    No {activeTab} orders found for {dept.toUpperCase()}.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord._id} className="hover">
                    <td className="font-bold text-primary">
                      <Link
                        href={`/planning/${dept}/${encodeURIComponent(ord.orderNo)}`}
                        className="hover:underline"
                      >
                        {ord.orderNo}
                      </Link>
                    </td>
                    <td className="font-semibold">{ord.buyer}</td>
                    <td>{ord.style || '—'}</td>
                    <td>{formatDateDisplay(ord.bookingDate)}</td>
                    <td className="font-mono">{ord.requiredQtyKgs?.toLocaleString() || '—'}</td>
                    <td>{ord.gmtUnit || ord.floor || '—'}</td>
                    <td>
                      <span className={`badge badge-sm font-bold ${STATUS_COLORS[activeTab] || 'badge-neutral'}`}>
                        {activeTab}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/planning/${dept}/${encodeURIComponent(ord.orderNo)}`}
                        className="btn btn-xs btn-outline btn-primary font-bold"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Plan Details
                      </Link>
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
            Total {totalOrders} orders (Page {page} of {totalPages})
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
