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
  RefreshCw,
} from 'lucide-react';
import { API_BASE, DEPARTMENTS } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';
import ExpPagination from '@/components/common/ExpPagination';
import InlineSpinner from '@/components/common/InlineSpinner';

interface PageProps {
  params: Promise<{ dept: string }>;
}

function calcTrackingBadge(actualDateStr?: string, planDateStr?: string) {
  const hasActual = actualDateStr && String(actualDateStr).trim() !== '' && String(actualDateStr).trim() !== '-';
  const hasPlan = planDateStr && String(planDateStr).trim() !== '' && String(planDateStr).trim() !== '-';

  if (hasActual) {
    if (!hasPlan) return '—';
    const aDate = new Date(actualDateStr).setHours(0, 0, 0, 0);
    const pDate = new Date(planDateStr).setHours(0, 0, 0, 0);
    return aDate <= pDate ? 'Pass' : 'Fail';
  }

  if (hasPlan) {
    const pDate = new Date(planDateStr).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    if (pDate < today) return 'Fail';
  }

  return '—';
}

const cachedTrackingOrders: Record<
  string,
  {
    orders: any[];
    total: number;
    totalPages: number;
    buyers: string[];
    initialEdits: Record<string, any>;
  }
> = {};

export default function TrackingPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';
  const deptConfig = DEPARTMENTS[dept] || { name: `${dept.toUpperCase()} Tracking` };

  const [activeTab, setActiveTab] = useState<'Pending' | 'Complete'>('Pending');
  const [search, setSearch] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [startMin, setStartMin] = useState('');
  const [startMax, setStartMax] = useState('');
  const [endMin, setEndMin] = useState('');
  const [endMax, setEndMax] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const initialKey = `${dept}_Pending__1_10_`;
  const initialCache = cachedTrackingOrders[initialKey];

  const [orders, setOrders] = useState<any[]>(() => initialCache?.orders || []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [availableBuyers, setAvailableBuyers] = useState<string[]>(() => initialCache?.buyers || []);
  const [totalPages, setTotalPages] = useState(() => initialCache?.totalPages || 1);
  const [total, setTotal] = useState(() => initialCache?.total || 0);
  const [editedRows, setEditedRows] = useState<Record<string, any>>(() => initialCache?.initialEdits || {});
  const [saveLoading, setSaveLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchTracking = async (overrideFilters?: {
    startMin?: string;
    startMax?: string;
    endMin?: string;
    endMax?: string;
  }) => {
    const sMin = overrideFilters?.startMin !== undefined ? overrideFilters.startMin : startMin;
    const sMax = overrideFilters?.startMax !== undefined ? overrideFilters.startMax : startMax;
    const eMin = overrideFilters?.endMin !== undefined ? overrideFilters.endMin : endMin;
    const eMax = overrideFilters?.endMax !== undefined ? overrideFilters.endMax : endMax;

    const key = `${dept}_${activeTab}_${selectedBuyer}_${page}_${limit}_${search}_${sMin}_${sMax}_${eMin}_${eMax}`;
    if (cachedTrackingOrders[key]) {
      const c = cachedTrackingOrders[key];
      setOrders(c.orders);
      setTotal(c.total);
      setTotalPages(c.totalPages);
      if (c.buyers) setAvailableBuyers(c.buyers);
      setEditedRows(c.initialEdits);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const token = localStorage.getItem('token');
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        buyer: selectedBuyer,
        search,
        status: activeTab,
        startMin: sMin,
        startMax: sMax,
        endMin: eMin,
        endMax: eMax,
      });

      const res = await fetch(`${API_BASE}/api/orders/tracking/${dept}?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const ords = data.orders || [];
        const tTotal = data.total || 0;
        const tPages = data.totalPages || 1;
        const buyersList = data.buyers || [];

        // Initialize editedRows with existing data
        const initialEdits: Record<string, any> = {};
        ords.forEach((o: any) => {
          initialEdits[o.orderNo] = {
            actualStart: o.actualStart || '',
            actualEnd: o.actualEnd || '',
            failReason: o.failReason || '',
            relatedDept: o.relatedDept || '',
          };
        });

        cachedTrackingOrders[key] = {
          orders: ords,
          total: tTotal,
          totalPages: tPages,
          buyers: buyersList,
          initialEdits,
        };

        setOrders(ords);
        setTotal(tTotal);
        setTotalPages(tPages);
        if (data.buyers) setAvailableBuyers(buyersList);
        setEditedRows(initialEdits);
      }
    } catch (err) {
      console.error('Failed to fetch tracking data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    setPage(1);
    fetchTracking();
  };

  const handleClearFilter = () => {
    setStartMin('');
    setStartMax('');
    setEndMin('');
    setEndMax('');
    setPage(1);
    fetchTracking({ startMin: '', startMax: '', endMin: '', endMax: '' });
  };

  useEffect(() => {
    fetchTracking();
  }, [dept, activeTab, selectedBuyer, page, limit]);

  const handleRowChange = (orderNo: string, field: string, value: string) => {
    setEditedRows((prev) => {
      const current = prev[orderNo] || { actualStart: '', actualEnd: '', failReason: '', relatedDept: '' };
      const updated = { ...current, [field]: value };

      // Validation: Actual End cannot be selected without Actual Start
      if (field === 'actualEnd' && !updated.actualStart && value) {
        alert('Actual End date cannot be selected without Actual Start date!');
        updated.actualEnd = '';
      }

      // Validation: Actual End cannot be before Actual Start
      if (field === 'actualEnd' && updated.actualStart && value) {
        if (new Date(value).setHours(0, 0, 0, 0) < new Date(updated.actualStart).setHours(0, 0, 0, 0)) {
          alert('Actual End date cannot be before Actual Start date!');
          updated.actualEnd = '';
        }
      }

      return { ...prev, [orderNo]: updated };
    });
  };

  const handleSaveAll = async () => {
    setSaveLoading(true);
    const actualKey = (dept === 'deliveryfloor' ? 'delivery' : dept) + 'Actual';
    let successCount = 0;
    let failCount = 0;

    try {
      const token = localStorage.getItem('token');
      const orderNos = Object.keys(editedRows);

      for (const orderNo of orderNos) {
        const edit = editedRows[orderNo];
        if (!edit) continue;

        try {
          const res = await fetch(`${API_BASE}/api/orders/save-dates`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderNo,
              department: actualKey,
              fabricItems: [],
              actualData: {
                actualStart: edit.actualStart,
                actualEnd: edit.actualEnd,
                failReason: edit.failReason,
                relatedDept: edit.relatedDept,
                status: edit.actualEnd ? 'Complete' : 'Pending',
              },
            }),
          });
          if (res.ok) successCount++;
          else failCount++;
        } catch {
          failCount++;
        }
      }

      setToastMessage(`Saved ${successCount} order(s) successfully!`);
      setTimeout(() => setToastMessage(null), 3000);
      fetchTracking();
    } catch (err) {
      console.error('Batch save error:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  const downloadTrackingExcel = () => {
    const token = localStorage.getItem('token');
    const query = new URLSearchParams({ buyer: selectedBuyer, search, status: activeTab });
    window.open(`${API_BASE}/api/orders/tracking-download/${dept}?${query.toString()}&token=${token}`, '_blank');
  };

  // Dynamic Header Columns
  let dynCol1 = '';
  let dynCol2 = '';
  if (dept === 'knitting') {
    dynCol1 = 'Knit Prod.';
    dynCol2 = 'Knit Bal.';
  } else if (dept === 'dyeing') {
    dynCol1 = 'Dyeing Prod.';
    dynCol2 = 'Dyeing Bal.';
  } else if (dept === 'delivery' || dept === 'deliveryfloor') {
    dynCol1 = 'NetDeliveryQtyKgs';
    dynCol2 = 'Deli. Bal.';
  }

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
            Plan vs Actual Tracking: <span className="uppercase">{dept}</span>
          </h2>
          <p className="text-xs text-base-content/60">
            Inline real-time floor execution tracking with instant Pass / Fail result calculation and delay attribution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadTrackingExcel}
            className="btn btn-sm btn-outline gap-2 font-bold"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saveLoading || orders.length === 0}
            className="btn btn-sm btn-primary gap-2 font-bold shadow-md shadow-primary/25"
          >
            {saveLoading ? <InlineSpinner size={14} /> : <Save className="w-4 h-4" />}
            Save Actual Tracking
          </button>
        </div>
      </div>

      {/* Tab Controls: Pending vs Complete */}
      <div className="flex items-center justify-between border-b border-base-300 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('Pending');
              setPage(1);
            }}
            className={`btn btn-sm font-bold ${
              activeTab === 'Pending' ? 'btn-primary' : 'btn-ghost text-base-content/70'
            }`}
          >
            Pending Execution
          </button>
          <button
            onClick={() => {
              setActiveTab('Complete');
              setPage(1);
            }}
            className={`btn btn-sm font-bold ${
              activeTab === 'Complete' ? 'btn-success text-white' : 'btn-ghost text-base-content/70'
            }`}
          >
            Completed Execution
          </button>
        </div>

        {/* Global Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Booking No..."
              className="input input-bordered input-sm w-48 sm:w-64 pl-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  fetchTracking();
                }
              }}
            />
          </div>
          <button
            onClick={() => {
              setPage(1);
              fetchTracking();
            }}
            className="btn btn-primary btn-sm font-bold text-xs"
          >
            Search
          </button>
        </div>
      </div>

      {/* Buyer Filter Pills */}
      {availableBuyers.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <button
            onClick={() => {
              setSelectedBuyer('');
              setPage(1);
            }}
            className={`btn btn-xs font-bold shrink-0 ${
              selectedBuyer === '' ? 'btn-primary' : 'btn-ghost bg-base-200/60'
            }`}
          >
            ALL BUYERS
          </button>
          {availableBuyers.map((b) => (
            <button
              key={b}
              onClick={() => {
                setSelectedBuyer(b);
                setPage(1);
              }}
              className={`btn btn-xs font-bold shrink-0 ${
                selectedBuyer === b ? 'btn-primary' : 'btn-ghost bg-base-200/60'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      {/* Date Range Filter (Exact 1-row layout matching Exp) */}
      <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap custom-scrollbar shrink-0 py-1">
        <span className="text-[11px] font-bold text-gray-600 bg-gray-100 dark:bg-base-200 dark:text-base-content/70 px-2 py-1 rounded">Start</span>
        <input
          type="date"
          value={startMin}
          onChange={(e) => setStartMin(e.target.value)}
          className="p-1 border border-gray-300 dark:border-base-300 rounded text-[11px] bg-base-100 focus:border-blue-500 outline-none w-[125px] shrink-0"
          title="Min Start Date"
        />
        <span className="text-gray-400 font-bold shrink-0">—</span>
        <input
          type="date"
          value={startMax}
          onChange={(e) => setStartMax(e.target.value)}
          className="p-1 border border-gray-300 dark:border-base-300 rounded text-[11px] bg-base-100 focus:border-blue-500 outline-none w-[125px] shrink-0"
          title="Max Start Date"
        />

        <span className="text-[11px] font-bold text-gray-600 bg-gray-100 dark:bg-base-200 dark:text-base-content/70 px-2 py-1 rounded ml-2 shrink-0">End</span>
        <input
          type="date"
          value={endMin}
          onChange={(e) => setEndMin(e.target.value)}
          className="p-1 border border-gray-300 dark:border-base-300 rounded text-[11px] bg-base-100 focus:border-blue-500 outline-none w-[125px] shrink-0"
          title="Min End Date"
        />
        <span className="text-gray-400 font-bold shrink-0">—</span>
        <input
          type="date"
          value={endMax}
          onChange={(e) => setEndMax(e.target.value)}
          className="p-1 border border-gray-300 dark:border-base-300 rounded text-[11px] bg-base-100 focus:border-blue-500 outline-none w-[125px] shrink-0"
          title="Max End Date"
        />

        <button
          onClick={handleApplyFilter}
          className="px-3 py-1 bg-green-600 text-white font-bold rounded text-[11px] hover:bg-green-700 transition-colors ml-2 shrink-0 shadow-xs"
        >
          Apply Filter
        </button>
        <button
          onClick={handleClearFilter}
          className="px-3 py-1 bg-gray-200 dark:bg-base-200 text-gray-600 dark:text-base-content/70 font-bold rounded text-[11px] hover:bg-gray-300 dark:hover:bg-base-300 transition-colors shrink-0"
        >
          Clear
        </button>
      </div>

      {/* Interactive Tracking Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden relative min-h-[380px]">
        {/* Exact Exp 3-Ring Loading Overlay */}
        {loading && <ExpLoadingSpinner message="Processing Tracking Data..." />}

        {!loading && orders.length === 0 ? (
          <div className="p-16 text-center text-base-content/60 space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-base-content/30" />
            <p className="text-sm font-bold">No {activeTab} tracking records found.</p>
            <p className="text-xs">Adjust your search or filter parameters to find confirmed plans.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar flex-1">
            <table className="table table-xs w-full">
              <thead className="bg-base-200/80 text-[11px] font-bold">
                <tr>
                  <th className="text-center w-10">SL</th>
                  <th>Order / Booking No</th>
                  <th>Buyer</th>
                  {dynCol1 && <th className="text-center bg-amber-500/10 text-amber-700">{dynCol1}</th>}
                  {dynCol2 && <th className="text-center bg-amber-500/10 text-amber-700">{dynCol2}</th>}
                  <th className="text-center bg-primary/10 text-primary">Plan Start</th>
                  <th className="text-center bg-primary/10 text-primary">Plan End</th>
                  <th className="text-center min-w-[125px]">Actual Start</th>
                  <th className="text-center min-w-[125px]">Actual End</th>
                  <th className="text-center w-16">Start Result</th>
                  <th className="text-center w-16">End Result</th>
                  <th className="min-w-[150px]">Fail Reason</th>
                  <th className="min-w-[130px]">Related Dept.</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-base-200">
                {orders.map((ord, idx) => {
                  const sl = (page - 1) * 15 + idx + 1;
                  const rowEdit = editedRows[ord.orderNo] || {
                    actualStart: ord.actualStart || '',
                    actualEnd: ord.actualEnd || '',
                    failReason: ord.failReason || '',
                    relatedDept: ord.relatedDept || '',
                  };

                  const startResult = calcTrackingBadge(rowEdit.actualStart, ord.planStart);
                  const endResult = calcTrackingBadge(rowEdit.actualEnd, ord.planEnd);

                  return (
                    <tr key={ord.orderNo} className="hover:bg-base-200/40 transition-colors">
                      <td className="text-center font-bold text-base-content/40">{sl}</td>
                      <td className="font-bold text-primary whitespace-nowrap">{ord.orderNo}</td>
                      <td className="font-medium whitespace-nowrap">{ord.buyer}</td>
                      {dynCol1 && (
                        <td className="text-center font-bold bg-amber-500/5 text-amber-800">
                          {ord.extProd !== undefined && ord.extProd !== null && ord.extProd !== '' && !isNaN(Number(ord.extProd))
                            ? Number(ord.extProd).toFixed(2)
                            : '—'}
                        </td>
                      )}
                      {dynCol2 && (
                        <td className="text-center font-bold bg-amber-500/5 text-amber-800">
                          {ord.extBal !== undefined && ord.extBal !== null && ord.extBal !== '' && !isNaN(Number(ord.extBal))
                            ? Number(ord.extBal).toFixed(2)
                            : '—'}
                        </td>
                      )}
                      <td className="text-center font-bold text-primary bg-primary/5 whitespace-nowrap">
                        {formatDateDisplay(ord.planStart) || '—'}
                      </td>
                      <td className="text-center font-bold text-primary bg-primary/5 whitespace-nowrap">
                        {formatDateDisplay(ord.planEnd) || '—'}
                      </td>

                      {/* Actual Start Input */}
                      <td className="text-center">
                        <input
                          type="date"
                          value={rowEdit.actualStart}
                          onChange={(e) => handleRowChange(ord.orderNo, 'actualStart', e.target.value)}
                          className="input input-bordered input-xs w-full text-center"
                        />
                      </td>

                      {/* Actual End Input */}
                      <td className="text-center">
                        <input
                          type="date"
                          value={rowEdit.actualEnd}
                          min={rowEdit.actualStart}
                          onChange={(e) => handleRowChange(ord.orderNo, 'actualEnd', e.target.value)}
                          className="input input-bordered input-xs w-full text-center"
                        />
                      </td>

                      {/* Start Result Badge */}
                      <td className="text-center">
                        {startResult === 'Pass' ? (
                          <span className="badge badge-success text-white badge-xs font-bold">Pass</span>
                        ) : startResult === 'Fail' ? (
                          <span className="badge badge-error text-white badge-xs font-bold">Fail</span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* End Result Badge */}
                      <td className="text-center">
                        {endResult === 'Pass' ? (
                          <span className="badge badge-success text-white badge-xs font-bold">Pass</span>
                        ) : endResult === 'Fail' ? (
                          <span className="badge badge-error text-white badge-xs font-bold">Fail</span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Fail Reason */}
                      <td>
                        <input
                          type="text"
                          value={rowEdit.failReason}
                          placeholder="Delay reason..."
                          onChange={(e) => handleRowChange(ord.orderNo, 'failReason', e.target.value)}
                          className="input input-bordered input-xs w-full"
                        />
                      </td>

                      {/* Related Dept. */}
                      <td>
                        <input
                          type="text"
                          value={rowEdit.relatedDept}
                          placeholder="Attributed dept..."
                          onChange={(e) => handleRowChange(ord.orderNo, 'relatedDept', e.target.value)}
                          className="input input-bordered input-xs w-full"
                        />
                      </td>
                    </tr>
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
          totalItems={total}
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
