'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Printer,
  Filter,
  Layers,
  Eye,
  EyeOff,
  FolderOpen,
  Hourglass,
} from 'lucide-react';
import { API_BASE } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import { deptShortName } from '@/lib/page-title';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import InlineSpinner from '@/components/ui/InlineSpinner';

interface PageProps {
  params: Promise<{ dept: string }>;
}

// One order of /api/orders/report/:dept (dept-specific keys such as `<dept>Items` / `<dept>PlanStatus` are dynamic).
interface ReportOrder {
  _id?: string;
  orderNo?: string;
  buyer?: string;
  style?: string;
  bookingDate?: string;
  gmtUnit?: string;
  floor?: string;
  [key: string]: unknown;
}

// "Preview Table" / "Hide Table" button of a report card
function PreviewToggleButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full sm:w-auto px-4 py-3 border border-gray-300 dark:border-[#2a3346] hover:bg-gray-100 dark:hover:bg-[#252f44] text-gray-700 dark:text-gray-200 font-bold rounded shadow-sm transition-colors flex justify-center items-center gap-1.5 text-sm"
      title={open ? 'Hide Table' : 'Preview Table Data'}
    >
      {open ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      <span>{open ? 'Hide Table' : 'Preview Table'}</span>
    </button>
  );
}

type PreviewKind = 'updated' | 'pending';
const EMPTY_PREVIEWS: Record<PreviewKind, ReportOrder[] | null> = { updated: null, pending: null };
const NOT_LOADING: Record<PreviewKind, boolean> = { updated: false, pending: false };

export default function DepartmentReportScreen({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';

  // Fast count check state (Exp technique: limit=1)
  const [checking, setChecking] = useState(true);
  const [confirmCount, setConfirmCount] = useState(0);
  const [tentativeCount, setTentativeCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // US-12: the Delivery Plan (Floor) / (Lock) reports list the Delivery orders (deliveryItems) with their Floor / Lock
  // status (<dept>PlanStatus from the server).
  const isDeliverySplit = dept === 'deliveryfloor' || dept === 'deliverylock';
  const itemsDept = isDeliverySplit ? 'delivery' : dept;
  const reportName = deptShortName(dept).toUpperCase();
  // Old data-processing.js (HEAD): YD and Delivery reports also include Pending orders (so do Floor and Lock).
  const includesPending = dept === 'yd' || dept === 'delivery' || isDeliverySplit;
  // Updated card: Confirm / Tentative (plus Pending for YD / Delivery). Pending card: the Pending orders alone.
  const hasUpdatedData = confirmCount > 0 || tentativeCount > 0 || (includesPending && pendingCount > 0);
  const hasPendingData = pendingCount > 0;
  const hasData = hasUpdatedData || hasPendingData;

  // Lazy preview tables (only loaded if the user asks): Updated (Confirm / Tentative) or Pending orders.
  // Each is loaded once per department; the table shows the one that is open.
  const [previewKind, setPreviewKind] = useState<PreviewKind | null>(null);
  const [previewOrders, setPreviewOrders] = useState<Record<PreviewKind, ReportOrder[] | null>>(EMPTY_PREVIEWS);
  const [previewLoading, setPreviewLoading] = useState<Record<PreviewKind, boolean>>(NOT_LOADING);
  const currentDept = useRef(dept);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPending, setDownloadingPending] = useState(false);
  const [search, setSearch] = useState('');
  const [buyer, setBuyer] = useState('');

  // 1. Fast lightweight data check on page mount (O(1) database count, <50ms)
  useEffect(() => {
    let isMounted = true;

    const checkDataExists = async () => {
      currentDept.current = dept;
      setChecking(true);
      setPreviewKind(null);
      setPreviewOrders(EMPTY_PREVIEWS);
      setPreviewLoading(NOT_LOADING);
      setConfirmCount(0);
      setTentativeCount(0);
      setPendingCount(0);

      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

        const [confirmRes, tentativeRes, pendingRes] = await Promise.all([
          fetch(`${API_BASE}/api/orders?dept=${dept}&status=Confirm&limit=1`, { headers }),
          fetch(`${API_BASE}/api/orders?dept=${dept}&status=Tentative&limit=1`, { headers }),
          // Every department has a Pending card. A failed Pending check must not hide the
          // Confirm / Tentative result (old app: .catch(() => null)).
          fetch(`${API_BASE}/api/orders?dept=${dept}&status=Pending&limit=1`, { headers }).catch(() => null),
        ]);

        let cCount = 0;
        let tCount = 0;
        let pCount = 0;

        if (confirmRes.ok) {
          const d = await confirmRes.json();
          cCount = d.total || 0;
        }

        if (tentativeRes.ok) {
          const d = await tentativeRes.json();
          tCount = d.total || 0;
        }

        if (pendingRes && pendingRes.ok) {
          try {
            const d = await pendingRes.json();
            pCount = d.total || 0;
          } catch {
            pCount = 0;
          }
        }

        if (isMounted) {
          setConfirmCount(cCount);
          setTentativeCount(tCount);
          setPendingCount(pCount);
        }
      } catch (err) {
        console.error('Failed to check report data availability:', err);
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    };

    checkDataExists();

    return () => {
      isMounted = false;
    };
  }, [dept]);

  // 2. Lazy load a preview table on demand (the same button hides it again)
  const handleTogglePreview = async (kind: PreviewKind) => {
    if (previewKind === kind) {
      setPreviewKind(null);
      return;
    }

    setPreviewKind(kind);
    setBuyer('');
    setSearch('');
    if (previewOrders[kind] || previewLoading[kind]) return;

    const requestDept = dept;
    setPreviewLoading((prev) => ({ ...prev, [kind]: true }));
    try {
      const token = localStorage.getItem('token');
      const query = kind === 'pending' ? '?pendingOnly=true' : '';
      const res = await fetch(`${API_BASE}/api/orders/report/${dept}${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // A late answer for a department the user already left is dropped
      if (res.ok && currentDept.current === requestDept) {
        const data = await res.json();
        setPreviewOrders((prev) => ({ ...prev, [kind]: data.orders || [] }));
      }
    } catch (err) {
      console.error('Failed to load detailed report data:', err);
    } finally {
      if (currentDept.current === requestDept) {
        setPreviewLoading((prev) => ({ ...prev, [kind]: false }));
      }
    }
  };

  // 3. Fast Server-Side Excel Generation Download (Updated report, or the Pending orders alone)
  const downloadReportFile = async (
    endpoint: 'report-download' | 'pending-download',
    fileTag: 'Updated' | 'Pending',
    setBusy: (busy: boolean) => void
  ) => {
    setBusy(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/orders/${endpoint}/${dept}?token=${token}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        alert(`No data found for ${fileTag === 'Pending' ? 'Pending ' : ''}${reportName} report.`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `${dept.toUpperCase()}_${fileTag}_Report_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download report Excel.');
    } finally {
      setBusy(false);
    }
  };

  const downloadExcel = () => downloadReportFile('report-download', 'Updated', setDownloading);
  const downloadPendingExcel = () => downloadReportFile('pending-download', 'Pending', setDownloadingPending);

  const isPendingPreview = previewKind === 'pending';
  const tableLoading = previewKind ? previewLoading[previewKind] : false;
  const orders = (previewKind && previewOrders[previewKind]) || [];
  const filteredOrders = orders.filter((o) => {
    if (buyer && o.buyer !== buyer) return false;
    if (search && !String(o.orderNo || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const availableBuyers = Array.from(new Set(orders.map((o) => o.buyer))).filter(Boolean).sort();

  return (
    <div className="space-y-6 pb-20 max-w-[1850px] mx-auto text-[11px] animate-fade-in">
      {/* Prominent Exp Report Action Card matching Exp index.html */}
      <div className="bg-white dark:bg-[#151921] rounded-md shadow-sm border border-gray-200 dark:border-[#2a3346] w-full p-6 sm:p-8 flex flex-col items-center justify-center text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-[#313644] dark:text-gray-100 mb-6">
          {reportName} Department Reports
        </h2>

        {checking ? (
          <div className="p-8">
            <LoadingSpinner message={`Checking ${reportName} report availability...`} overlay={false} />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center text-center p-8 sm:p-10 w-full max-w-lg bg-gray-50 dark:bg-[#1a202c] border border-gray-200 dark:border-[#2a3346] rounded-xl shadow-sm">
            <FolderOpen className="h-14 w-14 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">
              No Report Data Available
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              There is no Confirmed, Tentative or Pending planning data available for this department yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-6 w-full max-w-[1040px]">
            {/* Pending orders alone (orders not yet planned as Confirm or Tentative) */}
            {hasPendingData && (
              <div className="bg-white dark:bg-[#1b2230] rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-[#2a3346] p-6 sm:p-8 flex flex-col items-center text-center max-w-[500px] w-full border-t-[5px] border-t-amber-500 hover:-translate-y-1 transition-transform">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center text-3xl mb-4 sm:mb-6 shadow-inner">
                  <Hourglass className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 sm:mb-3">
                  Pending Report
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-[12px] sm:text-[13px] mb-4 leading-relaxed">
                  Extract only <strong className="text-gray-700 dark:text-gray-200">Pending</strong> orders (not yet
                  planned as Confirm or Tentative). All buyers will be combined into a{' '}
                  <strong className="text-gray-700 dark:text-gray-200">single sheet.</strong>
                </p>

                <div className="flex items-center gap-2 mb-6">
                  <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-bold rounded-full text-xs">
                    Pending: {pendingCount}
                  </span>
                </div>

                <div className="mt-auto flex flex-col sm:flex-row items-center gap-3 w-full max-w-[380px]">
                  <button
                    onClick={downloadPendingExcel}
                    disabled={downloadingPending}
                    className="flex-1 w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-md shadow-amber-600/20 transition-colors flex justify-center items-center gap-2 text-sm disabled:opacity-50"
                  >
                    {downloadingPending ? <InlineSpinner size={16} /> : <FileSpreadsheet className="h-4 w-4" />}
                    <span>Download Pending Data</span>
                  </button>

                  <PreviewToggleButton open={previewKind === 'pending'} onClick={() => handleTogglePreview('pending')} />
                </div>
              </div>
            )}

            {hasUpdatedData && (
              <div className="bg-white dark:bg-[#1b2230] rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-[#2a3346] p-6 sm:p-8 flex flex-col items-center text-center max-w-[500px] w-full border-t-[5px] border-t-emerald-600 hover:-translate-y-1 transition-transform">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center text-3xl mb-4 sm:mb-6 shadow-inner">
                  <Layers className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 sm:mb-3">
                  Updated Report
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-[12px] sm:text-[13px] mb-4 leading-relaxed">
                  Extract all data (both Confirm &amp; Tentative). All buyers will be combined into a{' '}
                  <strong className="text-gray-700 dark:text-gray-200">single sheet.</strong>
                </p>

                {/* Quick Count Badges */}
                <div className="flex items-center gap-2 mb-6">
                  <span className="px-2.5 py-1 bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 font-bold rounded-full text-xs">
                    Confirm: {confirmCount}
                  </span>
                  <span className="px-2.5 py-1 bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300 font-bold rounded-full text-xs">
                    Tentative: {tentativeCount}
                  </span>
                  {includesPending && (
                    <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 font-bold rounded-full text-xs">
                      Pending: {pendingCount}
                    </span>
                  )}
                  <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold rounded-full text-xs">
                    Total: {confirmCount + tentativeCount + (includesPending ? pendingCount : 0)}
                  </span>
                </div>

                <div className="mt-auto flex flex-col sm:flex-row items-center gap-3 w-full max-w-[380px]">
                  <button
                    onClick={downloadExcel}
                    disabled={downloading}
                    className="flex-1 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-md shadow-emerald-600/20 transition-colors flex justify-center items-center gap-2 text-sm disabled:opacity-50"
                  >
                    {downloading ? <InlineSpinner size={16} /> : <FileSpreadsheet className="h-4 w-4" />}
                    <span>Download {reportName} Data</span>
                  </button>

                  <PreviewToggleButton open={previewKind === 'updated'} onClick={() => handleTogglePreview('updated')} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detailed Orders Table of the open preview: Updated (Confirm & Tentative) or Pending (Lazy Loaded on Demand) */}
      {previewKind && (
        <div className="card bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] shadow-sm rounded-sm overflow-hidden animate-fade-in">
          {/* Sub Header & Controls */}
          <div className="bg-gray-100 dark:bg-[#1f2637] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-[#2a3346]">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-1 rounded text-xs font-bold ${
                  isPendingPreview
                    ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {isPendingPreview ? 'Pending Report' : 'Updated Report'}
                {!tableLoading && ` · ${filteredOrders.length} order${filteredOrders.length === 1 ? '' : 's'}`}
              </span>
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
                onClick={isPendingPreview ? downloadPendingExcel : downloadExcel}
                disabled={isPendingPreview ? downloadingPending : downloading}
                className={`px-4 py-1.5 text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 ${
                  isPendingPreview ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <Download className="h-3.5 w-3.5" /> Excel Export
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto custom-scrollbar">
            {tableLoading ? (
              <div className="p-12">
                <LoadingSpinner
                  message={
                    isPendingPreview
                      ? `Loading ${reportName} pending orders...`
                      : `Generating ${reportName} consolidated report...`
                  }
                  overlay={false}
                />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No {isPendingPreview ? 'Pending' : 'Confirmed or Tentative'} data matching filter for {reportName}.
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
                    const deptItems = ord[`${itemsDept}Items`];
                    const items = Array.isArray(deptItems) ? deptItems : [];
                    const statusKey = `${dept}PlanStatus`;
                    const planStatus = String(ord[statusKey] || 'Pending');

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
                                : planStatus === 'Pending'
                                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                                : 'bg-gray-100 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300'
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
      )}
    </div>
  );
}
