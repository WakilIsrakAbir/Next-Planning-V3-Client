'use client';

import React, { useState, useEffect, use } from 'react';
import { FileSpreadsheet, Download, Search, Printer, Filter, CheckCircle2 } from 'lucide-react';
import { API_BASE, DEPARTMENTS } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';

interface PageProps {
  params: Promise<{ dept: string }>;
}

export default function DepartmentReportPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';
  const deptConfig = DEPARTMENTS[dept] || { name: `${dept.toUpperCase()} Report` };

  const [orders, setOrders] = useState<any[]>([]);
  const [planMap, setPlanMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [buyer, setBuyer] = useState('');

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/orders/report/${dept}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
          setPlanMap(data.planMap || {});
        }
      } catch (err) {
        console.error('Failed to load report:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [dept]);

  const downloadExcel = () => {
    const token = localStorage.getItem('token');
    window.open(`${API_BASE}/api/orders/report-download/${dept}?token=${token}`, '_blank');
  };

  const filteredOrders = orders.filter((o) => {
    if (buyer && o.buyer !== buyer) return false;
    if (search && !o.orderNo.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const availableBuyers = Array.from(new Set(orders.map((o) => o.buyer))).filter(Boolean).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Confirmed & Tentative Report: <span className="uppercase">{dept}</span>
          </h2>
          <p className="text-xs text-base-content/60">
            Consolidated operational schedule with full fabric specifications and confirmed dates.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="btn btn-sm btn-outline font-bold shadow-sm"
          >
            <Printer className="w-4 h-4 mr-1" /> Print Report
          </button>
          <button
            onClick={downloadExcel}
            className="btn btn-sm btn-primary font-bold shadow-sm shadow-primary/25"
          >
            <Download className="w-4 h-4 mr-1" /> Download Excel
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card bg-base-100 p-4 border border-base-300 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-base-content/60" />
          <select
            value={buyer}
            onChange={(e) => setBuyer(e.target.value)}
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

        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter Booking / Order No..."
            className="input input-bordered input-sm w-48 sm:w-64 pl-8 text-xs"
          />
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/50" />
        </div>
      </div>

      {/* Report Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden relative min-h-[360px]">
        {/* Exact Exp 3-Ring Loading Overlay */}
        {loading && (
          <ExpLoadingSpinner
            message="Generating Department Report..."
            subMessage="Processing synchronized department records"
          />
        )}

        <div className="overflow-x-auto custom-scrollbar flex-1">
          <table className="table table-xs w-full">
            <thead className="bg-base-200/80 text-xs font-bold">
              <tr>
                <th>Booking / Order No</th>
                <th>Buyer</th>
                <th>Style</th>
                <th>Color</th>
                <th>Construction</th>
                <th>GSM</th>
                <th>Req Qty</th>
                <th>Plan Type</th>
                <th>Plan Start</th>
                <th>Plan End</th>
                <th>Unit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {!loading && filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-base-content/60">
                    No confirmed or tentative orders found for {dept.toUpperCase()}.
                  </td>
                </tr>
              ) : (
                filteredOrders.flatMap((ord) => {
                  const items = ord[`${dept}Items`] || [];
                  const plan = planMap[ord.orderNo];
                  const planItems = plan ? plan[dept] || [] : [];
                  const planItemMap = new Map();
                  planItems.forEach((pi: any) => {
                    if (pi.itemId) planItemMap.set(pi.itemId, pi);
                  });

                  if (items.length === 0) {
                    return (
                      <tr key={ord.orderNo} className="hover">
                        <td className="font-bold text-primary">{ord.orderNo}</td>
                        <td>{ord.buyer}</td>
                        <td>{ord.style || '—'}</td>
                        <td colSpan={9} className="text-base-content/50 italic">
                          No fabric item breakdown
                        </td>
                      </tr>
                    );
                  }

                  return items.map((item: any, idx: number) => {
                    const pItem = planItemMap.get(item.itemId || `row-${idx}`) || {};
                    return (
                      <tr key={`${ord.orderNo}-${idx}`} className="hover">
                        <td className="font-bold text-primary">{ord.orderNo}</td>
                        <td>{ord.buyer}</td>
                        <td>{ord.style || '—'}</td>
                        <td className="font-semibold">{item.Color || item.color || '—'}</td>
                        <td>{item.FabricConstruction || item.fabricConstruction || '—'}</td>
                        <td>{item.GSM || item.gsm || '—'}</td>
                        <td className="font-mono">{item.RequiredQtyKgs || item.reqQty || '—'}</td>
                        <td>
                          <span
                            className={`badge badge-xs font-bold ${
                              pItem.planType === 'Confirm'
                                ? 'badge-success'
                                : pItem.planType === 'Tentative'
                                ? 'badge-warning'
                                : 'badge-neutral'
                            }`}
                          >
                            {pItem.planType || 'Pending'}
                          </span>
                        </td>
                        <td>{formatDateDisplay(pItem.startDate || pItem.planStart)}</td>
                        <td>{formatDateDisplay(pItem.endDate || pItem.planEnd)}</td>
                        <td>{pItem.unit || pItem.Unit || item.Unit || item.unit || '—'}</td>
                        <td>
                          <span className="badge badge-xs badge-outline font-semibold">
                            {ord[`${dept}PlanStatus`] || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
