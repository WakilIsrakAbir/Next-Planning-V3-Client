'use client';

import React, { useState, useEffect, use } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Printer,
  Filter,
  CheckCircle2,
  Layers,
  FileDown,
} from 'lucide-react';
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
  const [downloading, setDownloading] = useState(false);
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
    setDownloading(true);
    const token = localStorage.getItem('token');
    window.open(`${API_BASE}/api/orders/report-download/${dept}?token=${token}`, '_blank');
    setTimeout(() => setDownloading(false), 2000);
  };

  const filteredOrders = orders.filter((o) => {
    if (buyer && o.buyer !== buyer) return false;
    if (search && !String(o.orderNo || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const availableBuyers = Array.from(new Set(orders.map((o) => o.buyer))).filter(Boolean).sort();

  return (
    <div className="space-y-6 pb-20 max-w-[1850px] mx-auto text-[11px] animate-fade-in">
      {/* Prominent Exp Report Action Card matching index.html lines 1347-1375 */}
      <div className="bg-white dark:bg-[#151921] rounded-md shadow-sm border border-gray-200 dark:border-[#2a3346] w-full p-6 sm:p-8 flex flex-col items-center justify-center text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-[#313644] dark:text-gray-100 mb-6">
          Updated {dept.toUpperCase()} Report
        </h2>

        <div className="bg-white dark:bg-[#1b2230] rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-[#2a3346] p-6 sm:p-8 flex flex-col items-center text-center max-w-[480px] w-full border-t-[5px] border-t-emerald-600 hover:-translate-y-1 transition-transform">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center text-3xl mb-4 sm:mb-6 shadow-inner">
            <Layers className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 sm:mb-3">
            Updated Report
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-[12px] sm:text-[13px] mb-6 leading-relaxed">
            Extract all data (both Confirm & Tentative). All buyers will be combined into a{' '}
            <strong className="text-gray-700 dark:text-gray-200">single sheet.</strong>
          </p>

          <button
            onClick={downloadExcel}
            disabled={downloading}
            className="w-full max-w-[280px] py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-md shadow-emerald-600/20 transition-colors flex justify-center items-center gap-2 text-sm disabled:opacity-50"
          >
            {downloading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            <span>Download {dept.toUpperCase()} Data</span>
          </button>
        </div>
      </div>

      {/* Detailed Confirmed & Tentative Orders Table for Inspection & Print */}
      <div className="card bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] shadow-sm rounded-sm overflow-hidden">
        {/* Sub Header & Controls */}
        <div className="bg-gray-100 dark:bg-[#1f2637] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-[#2a3346]">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              className="px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded text-xs font-semibold bg-white dark:bg-[#151921] text-gray-800 dark:text-gray-200"
            >
              <option value="">All Buyers ({availableBuyers.length})</option>
              {availableBuyers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Order No..."
                className="w-48 px-2 py-1 pl-7 border border-gray-300 dark:border-[#2a3346] rounded text-xs outline-none bg-white dark:bg-[#151921] text-gray-800 dark:text-gray-200"
              />
              <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2 top-2" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 border border-gray-300 dark:border-[#2a3346] rounded text-xs font-bold hover:bg-gray-200 dark:hover:bg-[#283347] transition flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button
              onClick={downloadExcel}
              className="px-4 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm"
            >
              <Download className="h-3.5 w-3.5" /> Excel Export
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto custom-scrollbar">
          {loading ? (
            <div className="p-12">
              <ExpLoadingSpinner message={`Generating ${dept.toUpperCase()} consolidated report...`} overlay={false} />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No Confirmed or Tentative data available for {dept.toUpperCase()}.
            </div>
          ) : (
            <table className="w-full text-left whitespace-nowrap min-w-[900px] border-collapse">
              <thead className="bg-gray-100 dark:bg-[#1f2637] border-b border-gray-300 dark:border-[#2a3346] text-gray-700 dark:text-gray-200 text-[10px] font-bold">
                <tr>
                  <th className="p-2 border-r border-gray-300 dark:border-[#2a3346]">Order No</th>
                  <th className="p-2 border-r border-gray-300 dark:border-[#2a3346]">Buyer</th>
                  <th className="p-2 border-r border-gray-300 dark:border-[#2a3346]">Style</th>
                  <th className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">Booking Date</th>
                  <th className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">Plan Status</th>
                  <th className="p-2 border-r border-gray-300 dark:border-[#2a3346]">Gmt Unit / Floor</th>
                  <th className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">Fabric Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-[#2a3346] text-[11px]">
                {filteredOrders.map((ord) => {
                  const items = ord[`${dept}Items`] || [];
                  const statusKey = `${dept}PlanStatus`;
                  const planStatus = ord[statusKey] || 'Pending';

                  return (
                    <tr
                      key={ord._id || ord.orderNo}
                      className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors"
                    >
                      <td className="p-2 border-r border-gray-200 dark:border-[#2a3346] font-bold text-emerald-700 dark:text-emerald-400">
                        {ord.orderNo}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-[#2a3346] font-semibold">
                        {ord.buyer || 'N/A'}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-[#2a3346]">
                        {ord.style || '—'}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-[#2a3346] text-center">
                        {formatDateDisplay(ord.bookingDate)}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-[#2a3346] text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            planStatus === 'Confirm'
                              ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300'
                              : planStatus === 'Tentative'
                              ? 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {planStatus}
                        </span>
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-[#2a3346]">
                        {ord.gmtUnit || ord.floor || '—'}
                      </td>
                      <td className="p-2 border-r border-gray-200 dark:border-[#2a3346] text-center font-bold">
                        {items.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
