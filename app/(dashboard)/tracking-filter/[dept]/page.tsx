'use client';

import React, { useState, useEffect, use } from 'react';
import {
  FileCheck,
  Calendar,
  Download,
  Eye,
  Search,
  RefreshCw,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_BASE, DEPARTMENTS } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';

interface PageProps {
  params: Promise<{ dept: string }>;
}

const PVATF_CONFIGS: Record<string, { title: string }> = {
  yd: { title: 'YD Plan Tracking Filter' },
  knitting: { title: 'Knitting Plan Tracking Filter' },
  dyeing: { title: 'Dyeing Plan Tracking Filter' },
  delivery: { title: 'Delivery Plan Tracking Filter' },
  deliveryfloor: { title: 'Delivery Plan (Floor) Tracking Filter' },
};

function isUnitProcessDept(deptKey: string): boolean {
  return deptKey === 'dyeing' || deptKey === 'delivery' || deptKey === 'deliveryfloor';
}

function calcTrackingResult(actualDateStr?: string, planDateStr?: string): 'Pass' | 'Fail' | '—' {
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

export default function TrackingFilterPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';
  const config = PVATF_CONFIGS[dept] || { title: `${dept.toUpperCase()} Tracking Filter` };
  const showUnitProcess = isUnitProcessDept(dept);

  // Default dates
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d: Date) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  const [fromDate, setFromDate] = useState(fmt(firstDay));
  const [toDate, setToDate] = useState(fmt(today));
  const [dateType, setDateType] = useState<'planStart' | 'planEnd' | 'actualStart' | 'actualEnd'>('planStart');
  const [resultFilter, setResultFilter] = useState<'all' | 'pass' | 'fail'>('all');

  // Buyers
  const [allBuyers, setAllBuyers] = useState<string[]>([]);
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [buyerDropdownOpen, setBuyerDropdownOpen] = useState(false);
  const [buyerSearch, setBuyerSearch] = useState('');

  // Data
  const [allRows, setAllRows] = useState<any[]>([]);
  const [filteredRows, setFilteredRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Summary Metrics
  const [metrics, setMetrics] = useState({
    total: 0,
    startPass: 0,
    startPassPct: '0%',
    startFail: 0,
    startFailPct: '0%',
    endPass: 0,
    endPassPct: '0%',
    endFail: 0,
    endFailPct: '0%',
  });

  const fetchData = async () => {
    setLoading(true);
    const rows: any[] = [];
    const buyersSet = new Set<string>();

    try {
      const token = localStorage.getItem('token');
      const dbDeptKey = dept === 'deliveryfloor' ? 'delivery' : dept;

      const res = await fetch(`${API_BASE}/api/orders/tracking/${dept}?all=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const { planDocs = [], orderMap = {} } = data;

        planDocs.forEach((plan: any) => {
          const deptItems = plan[dbDeptKey] || [];
          let startDates: string[] = [];
          let endDates: string[] = [];
          let planStart = '';
          let planEnd = '';

          if (Array.isArray(deptItems) && deptItems.length > 0) {
            if (dept === 'deliveryfloor') {
              const floorItems = deptItems.filter(
                (i: any) => i.floorPlanType === 'Confirm' || i.floorPlanType === 'Tentative'
              );
              startDates = floorItems.map((i: any) => i.floorStartDate).filter(Boolean);
              endDates = floorItems.map((i: any) => i.floorEndDate).filter(Boolean);
            } else {
              startDates = deptItems.map((i: any) => i.startDate).filter(Boolean);
              endDates = deptItems.map((i: any) => i.endDate).filter(Boolean);
            }

            if (startDates.length > 0) { startDates.sort(); planStart = startDates[0]; }
            if (endDates.length > 0) { endDates.sort(); planEnd = endDates[endDates.length - 1]; }
          }

          if (!planStart && !planEnd) {
            const oInfo = orderMap[plan.orderNo] || {};
            if (dept === 'knitting') { planStart = oInfo.knitStart || ''; planEnd = oInfo.knitEnd || ''; }
            else if (dept === 'dyeing') { planStart = oInfo.dyeStart || ''; planEnd = oInfo.dyeEnd || ''; }
            else if (dept === 'delivery' || dept === 'deliveryfloor') { planStart = oInfo.deliStart || ''; planEnd = oInfo.deliEnd || ''; }
          }

          const actualKey = (dept === 'deliveryfloor' ? 'delivery' : dept) + 'Actual';
          let actualStart = '';
          let actualEnd = '';
          let failReason = '';
          let relatedDept = '';

          if (plan[actualKey]) {
            actualStart = plan[actualKey].actualStart || '';
            actualEnd = plan[actualKey].actualEnd || '';
            failReason = plan[actualKey].failReason || plan[actualKey].remarks || '';
            relatedDept = plan[actualKey].relatedDept || '';
          }

          const orderInfo = orderMap[plan.orderNo] || {};
          let displayBuyer = orderInfo.buyer || plan.buyer || 'N/A';
          if (displayBuyer && displayBuyer !== 'N/A') buyersSet.add(displayBuyer.trim());

          // Unit & Process
          let rowUnit = plan.unit || '';
          let rowProcessName = plan.processName || '';
          if (!rowUnit && deptItems.length > 0) {
            const u = deptItems.map((it: any) => it.Unit || (it.itemData && it.itemData.Unit)).filter(Boolean);
            if (u.length > 0) rowUnit = u.join('+');
          }
          if (!rowProcessName && deptItems.length > 0) {
            const p = deptItems.map((it: any) => it.ProcessName || (it.itemData && it.itemData.ProcessName)).filter(Boolean);
            if (p.length > 0) rowProcessName = p.join('+');
          }

          rows.push({
            orderNo: plan.orderNo,
            buyer: displayBuyer,
            unit: rowUnit,
            processName: rowProcessName,
            planStart,
            planEnd,
            actualStart,
            actualEnd,
            failReason,
            relatedDept,
          });
        });
      }

      setAllRows(rows);
      setAllBuyers(Array.from(buyersSet).sort());
    } catch (err) {
      console.error('Failed to fetch tracking filter data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dept]);

  const handlePreview = () => {
    if (!fromDate || !toDate) {
      alert('Please select both From and To dates.');
      return;
    }

    const buyerSet = new Set(selectedBuyers.map((b) => b.toLowerCase()));

    const filtered = allRows
      .filter((r) => {
        const d = r[dateType];
        if (!d || d < fromDate || d > toDate) return false;
        if (buyerSet.size > 0 && !buyerSet.has(String(r.buyer || '').toLowerCase())) return false;
        return true;
      })
      .map((r) => {
        const startResult = calcTrackingResult(r.actualStart, r.planStart);
        const endResult = calcTrackingResult(r.actualEnd, r.planEnd);
        return {
          ...r,
          startResult,
          endResult,
        };
      })
      .filter((r) => {
        if (resultFilter === 'pass') {
          return r.startResult === 'Pass' || r.endResult === 'Pass';
        }
        if (resultFilter === 'fail') {
          return r.startResult === 'Fail' || r.endResult === 'Fail';
        }
        return true;
      });

    // Compute Metrics
    const total = filtered.length;
    const startPass = filtered.filter((r) => r.startResult === 'Pass').length;
    const startFail = filtered.filter((r) => r.startResult === 'Fail').length;
    const endPass = filtered.filter((r) => r.endResult === 'Pass').length;
    const endFail = filtered.filter((r) => r.endResult === 'Fail').length;

    const pct = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%');

    setMetrics({
      total,
      startPass,
      startPassPct: pct(startPass),
      startFail,
      startFailPct: pct(startFail),
      endPass,
      endPassPct: pct(endPass),
      endFail,
      endFailPct: pct(endFail),
    });

    setFilteredRows(filtered);
    setPreviewOpen(true);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = showUnitProcess
      ? ['SL', 'Order/Booking No.', 'Buyer', 'Unit', 'Process Name', 'Plan Start', 'Plan End', 'Actual Start', 'Actual End', 'Start Result', 'End Result', 'Fail Reason', 'Related Dept.']
      : ['SL', 'Order/Booking No.', 'Buyer', 'Plan Start', 'Plan End', 'Actual Start', 'Actual End', 'Start Result', 'End Result', 'Fail Reason', 'Related Dept.'];

    const exportData = filteredRows.map((r, i) => {
      if (showUnitProcess) {
        return {
          'SL': i + 1,
          'Order/Booking No.': r.orderNo,
          'Buyer': r.buyer,
          'Unit': r.unit || '',
          'Process Name': r.processName || '',
          'Plan Start': r.planStart,
          'Plan End': r.planEnd,
          'Actual Start': r.actualStart,
          'Actual End': r.actualEnd,
          'Start Result': r.startResult,
          'End Result': r.endResult,
          'Fail Reason': r.failReason,
          'Related Dept.': r.relatedDept,
        };
      }
      return {
        'SL': i + 1,
        'Order/Booking No.': r.orderNo,
        'Buyer': r.buyer,
        'Plan Start': r.planStart,
        'Plan End': r.planEnd,
        'Actual Start': r.actualStart,
        'Actual End': r.actualEnd,
        'Start Result': r.startResult,
        'End Result': r.endResult,
        'Fail Reason': r.failReason,
        'Related Dept.': r.relatedDept,
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData, { header: headers });
    ws['!cols'] = headers.map((c) => ({ wch: Math.max(12, Math.min(26, c.length + 3)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${dept.toUpperCase()} Tracking Filter`);
    XLSX.writeFile(wb, `${dept}_tracking_filter_${Date.now()}.xlsx`);
  };

  const filteredBuyerOptions = allBuyers.filter((b) =>
    b.toLowerCase().includes(buyerSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-primary" />
            {config.title}
          </h2>
          <p className="text-xs text-base-content/60">
            Pass / Fail conformance analytics and delay attribution filter across planning and actual execution.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="btn btn-outline btn-sm gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter Parameters */}
      <div className="card bg-base-100 border border-base-300 p-5 shadow-sm space-y-5">
        <h3 className="font-bold text-sm text-base-content/80 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Filter Parameters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                if (toDate && toDate < e.target.value) setToDate(e.target.value);
              }}
              className="input input-bordered input-sm w-full"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
              Filter By Date Field
            </label>
            <select
              value={dateType}
              onChange={(e) => setDateType(e.target.value as any)}
              className="select select-bordered select-sm w-full"
            >
              <option value="planStart">Plan Start Date</option>
              <option value="planEnd">Plan End Date</option>
              <option value="actualStart">Actual Start Date</option>
              <option value="actualEnd">Actual End Date</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
              Conformance Status
            </label>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value as any)}
              className="select select-bordered select-sm w-full"
            >
              <option value="all">All Orders</option>
              <option value="pass">Pass Only (Any Stage)</option>
              <option value="fail">Fail Only (Any Stage)</option>
            </select>
          </div>
        </div>

        {/* Buyer Selection */}
        <div className="pt-2 border-t border-base-200">
          <div className="relative max-w-md">
            <label className="block text-[11px] font-bold text-base-content/70 uppercase mb-1">
              Buyer Selection ({selectedBuyers.length === 0 ? 'All Buyers' : `${selectedBuyers.length} Selected`})
            </label>
            <button
              type="button"
              onClick={() => setBuyerDropdownOpen(!buyerDropdownOpen)}
              className="btn btn-outline btn-sm w-full justify-between font-normal text-xs"
            >
              <span className="truncate">
                {selectedBuyers.length === 0
                  ? 'All Buyers (Click to filter)'
                  : selectedBuyers.length <= 2
                  ? selectedBuyers.join(', ')
                  : `${selectedBuyers.length} Buyers Selected`}
              </span>
              <Building2 className="h-4 w-4 ml-2 opacity-50 shrink-0" />
            </button>

            {buyerDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-xl p-3 max-h-64 flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Search buyer..."
                  value={buyerSearch}
                  onChange={(e) => setBuyerSearch(e.target.value)}
                  className="input input-bordered input-xs w-full"
                />
                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-base-200 font-bold">
                  <button
                    type="button"
                    onClick={() => setSelectedBuyers([])}
                    className="text-primary hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBuyers(allBuyers)}
                    className="text-base-content/60 hover:underline"
                  >
                    Check All
                  </button>
                </div>
                <div className="overflow-y-auto max-h-40 space-y-1 custom-scrollbar">
                  {filteredBuyerOptions.map((b) => (
                    <label key={b} className="flex items-center gap-2 p-1 rounded hover:bg-base-200 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedBuyers.includes(b)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedBuyers([...selectedBuyers, b]);
                          else setSelectedBuyers(selectedBuyers.filter((x) => x !== b));
                        }}
                        className="checkbox checkbox-xs checkbox-primary"
                      />
                      <span className="truncate">{b}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handlePreview}
            disabled={loading}
            className="btn btn-primary btn-sm gap-2 font-bold shadow-md shadow-primary/20"
          >
            <Eye className="h-4 w-4" />
            Preview Conformance Analysis
          </button>
        </div>
      </div>

      {/* Preview Section */}
      {previewOpen && (
        <div className="space-y-4">
          {/* Conformance Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
              <span className="text-xs text-base-content/60 font-semibold uppercase">Total Rows</span>
              <span className="text-2xl font-black text-primary mt-1">{metrics.total}</span>
            </div>

            <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
              <span className="text-xs text-base-content/60 font-semibold uppercase">Start Plan Conformance</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold text-success">Pass: {metrics.startPass} ({metrics.startPassPct})</span>
                <span className="text-sm font-bold text-error">Fail: {metrics.startFail} ({metrics.startFailPct})</span>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 p-4 shadow-sm col-span-2">
              <span className="text-xs text-base-content/60 font-semibold uppercase">End Plan Conformance</span>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-sm font-bold text-success">Pass: {metrics.endPass} ({metrics.endPassPct})</span>
                <span className="text-sm font-bold text-error">Fail: {metrics.endFail} ({metrics.endFailPct})</span>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div className="card bg-base-100 border border-base-300 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-base-200">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Filtered Tracking Results ({filteredRows.length} Orders)
                </h3>
                <p className="text-xs text-base-content/60">
                  {dateType}: {fromDate} to {toDate} | {selectedBuyers.length === 0 ? 'All Buyers' : selectedBuyers.join(', ')}
                </p>
              </div>

              <button
                onClick={handleExportExcel}
                disabled={filteredRows.length === 0}
                className="btn btn-success text-white btn-sm gap-2 font-bold shadow-md"
              >
                <Download className="h-4 w-4" />
                Export Excel ({filteredRows.length})
              </button>
            </div>

            {filteredRows.length === 0 ? (
              <div className="p-10 text-center text-base-content/50">
                No matching tracking data found for the selected criteria.
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
                <table className="table table-xs table-pin-rows table-pin-cols w-full border border-base-300">
                  <thead className="bg-base-200 text-base-content font-bold">
                    <tr>
                      <th className="text-center w-10">SL</th>
                      <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Order/Booking No.</th>
                      <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Buyer</th>
                      {showUnitProcess && (
                        <>
                          <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Unit</th>
                          <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Process Name</th>
                        </>
                      )}
                      <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Plan Start</th>
                      <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Plan End</th>
                      <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Actual Start</th>
                      <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Actual End</th>
                      <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Start Result</th>
                      <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">End Result</th>
                      <th className="text-center whitespace-nowrap px-3 py-2 border-r border-base-300">Fail Reason</th>
                      <th className="text-center whitespace-nowrap px-3 py-2">Related Dept.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r, i) => (
                      <tr key={i} className="hover:bg-base-200/50 transition-colors border-b border-base-200">
                        <td className="text-center font-bold text-base-content/50 border-r border-base-300">{i + 1}</td>
                        <td className="px-3 py-1.5 text-center font-bold text-primary border-r border-base-200">{r.orderNo}</td>
                        <td className="px-3 py-1.5 text-center font-medium border-r border-base-200">{r.buyer}</td>
                        {showUnitProcess && (
                          <>
                            <td className="px-3 py-1.5 text-center border-r border-base-200">{r.unit || '—'}</td>
                            <td className="px-3 py-1.5 text-center border-r border-base-200">{r.processName || '—'}</td>
                          </>
                        )}
                        <td className="px-3 py-1.5 text-center border-r border-base-200">{formatDateDisplay(r.planStart) || '—'}</td>
                        <td className="px-3 py-1.5 text-center border-r border-base-200">{formatDateDisplay(r.planEnd) || '—'}</td>
                        <td className="px-3 py-1.5 text-center border-r border-base-200">{formatDateDisplay(r.actualStart) || '—'}</td>
                        <td className="px-3 py-1.5 text-center border-r border-base-200">{formatDateDisplay(r.actualEnd) || '—'}</td>
                        <td className="px-3 py-1.5 text-center border-r border-base-200">
                          {r.startResult === 'Pass' ? (
                            <span className="badge badge-success text-white badge-xs font-bold">Pass</span>
                          ) : r.startResult === 'Fail' ? (
                            <span className="badge badge-error text-white badge-xs font-bold">Fail</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center border-r border-base-200">
                          {r.endResult === 'Pass' ? (
                            <span className="badge badge-success text-white badge-xs font-bold">Pass</span>
                          ) : r.endResult === 'Fail' ? (
                            <span className="badge badge-error text-white badge-xs font-bold">Fail</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-1.5 border-r border-base-200 text-xs">{r.failReason || '—'}</td>
                        <td className="px-3 py-1.5 text-xs">{r.relatedDept || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
