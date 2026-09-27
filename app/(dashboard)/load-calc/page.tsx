'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Gauge,
  Download,
  Calendar,
  Layers,
  CheckCircle2,
  RefreshCw,
  Building2,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_BASE, DEPARTMENTS } from '@/lib/constants';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';
import InlineSpinner from '@/components/common/InlineSpinner';

const LOAD_DEPTS = [
  { key: 'knitting', label: 'Knitting', pendingQtyField: 'KnitBala' },
  { key: 'dyeing', label: 'Dyeing', pendingQtyField: 'DyeingBala' },
  { key: 'delivery', label: 'Delivery', pendingQtyField: 'DeliBal' },
  { key: 'yd', label: 'YD', pendingQtyField: 'YD DELIVERY BALANCE' },
  { key: 'deliveryfloor', label: 'Delivery (Floor)', pendingQtyField: 'DeliBal' },
];

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function parseLoadDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function inclusiveDays(startDate: Date, endDate: Date): number {
  const d1 = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const d2 = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.floor((d2.getTime() - d1.getTime()) / 86400000) + 1;
}

function calculateLoadAllocation(pendingQty: number, planStartVal: any, planEndVal: any, reportMonths: Date[]) {
  const qty = Math.max(0, pendingQty);
  const planStart = parseLoadDate(planStartVal);
  const planEnd = parseLoadDate(planEndVal);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const empty = { leadDay: 0, loadPerDay: 0, monthlyLoads: [0, 0, 0, 0, 0] };
  if (!planStart || !planEnd || qty <= 0) return empty;

  if (planEnd <= today) {
    return {
      leadDay: 1,
      loadPerDay: Math.round(qty),
      monthlyLoads: reportMonths.map((_, i) => (i === 0 ? Math.round(qty) : 0)),
    };
  }

  const allocStart = planStart > today ? planStart : today;
  const leadDay = Math.max(1, inclusiveDays(allocStart, planEnd));

  const monthlyLoads = reportMonths.map((mStart) => {
    const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0);
    const prevEnd = new Date(mStart.getFullYear(), mStart.getMonth(), 0);
    const curCutoff = planEnd < mEnd ? planEnd : mEnd;
    const prevCutoff = planEnd < prevEnd ? planEnd : prevEnd;

    const curDays = Math.max(0, inclusiveDays(allocStart, curCutoff));
    const prevDays = Math.max(0, inclusiveDays(allocStart, prevCutoff));

    const curCum = Math.round((qty * curDays) / leadDay);
    const prevCum = Math.round((qty * prevDays) / leadDay);

    return Math.max(0, curCum - prevCum);
  });

  return {
    leadDay,
    loadPerDay: Math.round(qty / leadDay),
    monthlyLoads,
  };
}

function LoadCalculationContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'detailed' | 'summary'>(
    tabParam === 'detailed' ? 'detailed' : 'summary'
  );

  useEffect(() => {
    if (tabParam === 'detailed' || tabParam === 'summary') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [selectedDept, setSelectedDept] = useState<string>('knitting');
  const [loading, setLoading] = useState(false);
  const [downloadingDept, setDownloadingDept] = useState<string | null>(null);

  // Month selector
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [startMonth, setStartMonth] = useState(currentMonthStr);

  // Data cache
  const [departmentData, setDepartmentData] = useState<Record<string, any[]>>({});

  // Generate 5 months array
  const [y, m] = startMonth.split('-').map(Number);
  const firstMonth = new Date(y, m - 1, 1);
  const reportMonths = Array.from({ length: 5 }, (_, i) => addMonths(firstMonth, i));
  const monthLabels = reportMonths.map((d) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));

  // Month options (-12 to +24)
  const monthOptions = [];
  for (let i = -6; i <= 18; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lbl = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    monthOptions.push({ val, lbl });
  }

  // Fetch load data for selected department
  const fetchDeptData = async (deptKey: string) => {
    if (departmentData[deptKey]) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const dbDept = deptKey === 'deliveryfloor' ? 'delivery' : deptKey;

      const res = await fetch(`${API_BASE}/api/orders/tracking/${deptKey}?all=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const { planDocs = [], orderMap = {} } = data;
        const rows: any[] = [];

        planDocs.forEach((plan: any) => {
          const deptItems = plan[dbDept] || [];
          const oInfo = orderMap[plan.orderNo] || {};
          const buyer = oInfo.buyer || plan.buyer || 'Unspecified';

          deptItems.forEach((it: any) => {
            const planType = deptKey === 'deliveryfloor' ? it.floorPlanType : it.planType;
            if (planType !== 'Confirm' && planType !== 'Tentative') return;

            const sd = deptKey === 'deliveryfloor' ? it.floorStartDate : it.startDate;
            const ed = deptKey === 'deliveryfloor' ? it.floorEndDate : it.endDate;

            // Extract pending qty
            let pendingQty = 0;
            const itData = it.itemData || it;
            if (deptKey === 'knitting') {
              pendingQty = Number(itData['Knit. Bala.'] || itData['KnitBala'] || itData['Knit Bala'] || 0);
            } else if (deptKey === 'dyeing') {
              pendingQty = Number(itData['Dyeing Bala.'] || itData['DyeingBala'] || itData['Dyeing Bal.'] || 0);
            } else if (deptKey === 'delivery' || deptKey === 'deliveryfloor') {
              pendingQty = Number(itData['Deli. Bal.'] || itData['DeliBal'] || itData['Deli. Bala.'] || 0);
            } else if (deptKey === 'yd') {
              pendingQty = Number(itData['YD DELIVERY BALANCE'] || itData['YD Balance_1'] || 0);
            }

            rows.push({
              orderNo: plan.orderNo,
              buyer,
              pendingQty,
              planStart: sd,
              planEnd: ed,
              planType,
            });
          });
        });

        setDepartmentData((prev) => ({ ...prev, [deptKey]: rows }));
      }
    } catch (err) {
      console.error(`Error loading load calculation data for ${deptKey}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeptData(selectedDept);
  }, [selectedDept]);

  // Compute Buyer-Wise Summary
  const currentDeptRows = departmentData[selectedDept] || [];
  const buyerMap = new Map<string, number[]>();

  currentDeptRows.forEach((row) => {
    const buyer = row.buyer || 'Unspecified';
    if (!buyerMap.has(buyer)) buyerMap.set(buyer, [0, 0, 0, 0, 0]);

    const alloc = calculateLoadAllocation(row.pendingQty, row.planStart, row.planEnd, reportMonths);
    const curMonths = buyerMap.get(buyer)!;
    alloc.monthlyLoads.forEach((val, idx) => {
      curMonths[idx] += val;
    });
  });

  const summaryRows = Array.from(buyerMap.entries())
    .map(([buyer, monthlyLoads]) => ({
      buyer,
      monthlyLoads,
      total: monthlyLoads.reduce((sum, v) => sum + v, 0),
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const grandMonthlyTotals = [0, 0, 0, 0, 0];
  summaryRows.forEach((r) => {
    r.monthlyLoads.forEach((val, idx) => {
      grandMonthlyTotals[idx] += val;
    });
  });
  const grandTotal = grandMonthlyTotals.reduce((sum, v) => sum + v, 0);

  // Download Detailed Load Excel
  const downloadDetailedExcel = async (deptKey: string) => {
    setDownloadingDept(deptKey);
    try {
      const token = localStorage.getItem('token');
      window.open(
        `${API_BASE}/api/orders/load-download/detailed?dept=${deptKey}&startMonth=${startMonth}&token=${token}`,
        '_blank'
      );
    } catch (err) {
      console.error('Detailed download failed:', err);
    } finally {
      setDownloadingDept(null);
    }
  };

  // Download Summary Excel
  const downloadSummaryExcel = () => {
    const headers = ['Buyer', ...monthLabels, 'Total [Kg]'];
    const exportData = summaryRows.map((r) => {
      const rowObj: Record<string, any> = { Buyer: r.buyer };
      monthLabels.forEach((lbl, idx) => {
        rowObj[lbl] = r.monthlyLoads[idx];
      });
      rowObj['Total [Kg]'] = r.total;
      return rowObj;
    });

    // Add Grand Total row
    const totalRow: Record<string, any> = { Buyer: 'GRAND TOTAL' };
    monthLabels.forEach((lbl, idx) => {
      totalRow[lbl] = grandMonthlyTotals[idx];
    });
    totalRow['Total [Kg]'] = grandTotal;
    exportData.push(totalRow);

    const ws = XLSX.utils.json_to_sheet(exportData, { header: headers });
    ws['!cols'] = headers.map((c) => ({ wch: Math.max(14, c.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${selectedDept.toUpperCase()} Summary`);
    XLSX.writeFile(wb, `${selectedDept}_load_summary_${startMonth}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" />
            5-Month Capacity & Load Forecasting
          </h2>
          <p className="text-xs text-base-content/60">
            Project pending machine allocations and departmental load requirements across a rolling 5-month horizon.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="join bg-base-100 p-1 border border-base-300">
          <button
            onClick={() => setActiveTab('summary')}
            className={`join-item btn btn-sm font-bold ${
              activeTab === 'summary' ? 'btn-primary' : 'btn-ghost'
            }`}
          >
            Buyer-wise Load Summary
          </button>
          <button
            onClick={() => setActiveTab('detailed')}
            className={`join-item btn btn-sm font-bold ${
              activeTab === 'detailed' ? 'btn-primary' : 'btn-ghost'
            }`}
          >
            Detailed Load Download
          </button>
        </div>
      </div>

      {/* Control Card */}
      <div className="card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <span className="text-xs font-bold text-base-content/70">Start Month:</span>
          <select
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="select select-bordered select-sm font-bold text-xs"
          >
            {monthOptions.map((opt) => (
              <option key={opt.val} value={opt.val}>
                {opt.lbl}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-base-content/60">
          Projection Window:{' '}
          <span className="font-bold text-primary">
            {monthLabels[0]} &rarr; {monthLabels[4]}
          </span>
        </div>
      </div>

      {/* Tab 1: Detailed Load Download Cards */}
      {activeTab === 'detailed' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {LOAD_DEPTS.map((d) => (
            <div
              key={d.key}
              className="card bg-base-100 border border-base-300 p-5 shadow-sm hover:shadow-md transition-shadow space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base text-base-content">{d.label} Detailed Load</h3>
                <span className="badge badge-primary badge-outline text-xs font-bold uppercase">{d.key}</span>
              </div>

              <p className="text-xs text-base-content/60">
                Item-level detailed machine allocation mapping pending quantities across 5 projection months.
              </p>

              <div className="text-[11px] bg-base-200/50 p-2.5 rounded text-base-content/70">
                <span className="font-semibold">Pending Metric:</span> {d.pendingQtyField}
              </div>

              <button
                onClick={() => downloadDetailedExcel(d.key)}
                disabled={downloadingDept === d.key}
                className="btn btn-primary btn-sm w-full gap-2 font-bold shadow-md shadow-primary/20"
              >
                {downloadingDept === d.key ? (
                  <InlineSpinner size={14} />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download {d.label} Excel
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Tab 2: Buyer-wise Summary Live Table */
        <div className="space-y-4">
          {/* Department Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {LOAD_DEPTS.map((d) => (
              <button
                key={d.key}
                onClick={() => setSelectedDept(d.key)}
                className={`btn btn-sm font-bold shrink-0 ${
                  selectedDept === d.key ? 'btn-primary' : 'btn-ghost bg-base-200/60'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Table Container */}
          <div className="card bg-base-100 border border-base-300 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-base-200">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {LOAD_DEPTS.find((d) => d.key === selectedDept)?.label} Buyer-Wise Load Summary
                </h3>
                <p className="text-xs text-base-content/60">
                  Allocated pending weight (Kg) aggregated by buyer across the 5 projection months.
                </p>
              </div>

              <button
                onClick={downloadSummaryExcel}
                disabled={summaryRows.length === 0}
                className="btn btn-success text-white btn-sm gap-2 font-bold shadow-md"
              >
                <Download className="h-4 w-4" />
                Export Summary Excel ({summaryRows.length} Buyers)
              </button>
            </div>

            {loading ? (
              <div className="p-16 flex items-center justify-center">
                <ExpLoadingSpinner
                  message="Loading Summary Data..."
                  subMessage="Please wait while data is being processed"
                  overlay={false}
                />
              </div>
            ) : summaryRows.length === 0 ? (
              <div className="p-16 text-center text-base-content/60">
                No active load allocation found for {selectedDept} in this 5-month window.
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="table table-xs w-full border border-base-300">
                  <thead className="bg-base-200/80 text-xs font-bold text-base-content">
                    <tr>
                      <th className="w-12 text-center">#</th>
                      <th className="px-4 py-2 text-left">Buyer Name</th>
                      {monthLabels.map((lbl) => (
                        <th key={lbl} className="px-4 py-2 text-right">
                          {lbl} [Kg]
                        </th>
                      ))}
                      <th className="px-4 py-2 text-right font-black bg-primary/10 text-primary">
                        Total [Kg]
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-base-200">
                    {summaryRows.map((r, i) => (
                      <tr key={r.buyer} className="hover:bg-base-200/40 transition-colors">
                        <td className="text-center font-bold text-base-content/40">{i + 1}</td>
                        <td className="font-bold text-base-content">{r.buyer}</td>
                        {r.monthlyLoads.map((val, idx) => (
                          <td key={idx} className="text-right font-mono text-base-content/80">
                            {val > 0 ? Number(val).toLocaleString() : '—'}
                          </td>
                        ))}
                        <td className="text-right font-mono font-black text-primary bg-primary/5">
                          {Number(r.total).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Grand Totals Footer */}
                  <tfoot className="bg-base-200 font-extrabold text-xs">
                    <tr>
                      <td colSpan={2} className="text-center uppercase font-black text-primary">
                        GRAND TOTAL
                      </td>
                      {grandMonthlyTotals.map((tot, idx) => (
                        <td key={idx} className="text-right font-mono font-black text-base-content">
                          {Number(tot).toLocaleString()}
                        </td>
                      ))}
                      <td className="text-right font-mono font-black text-primary bg-primary/20 text-sm">
                        {Number(grandTotal).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoadCalculationPage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-[400px]">
          <ExpLoadingSpinner
            message="Loading Capacity & Load Forecasting..."
            subMessage="Synchronizing 5-month projection matrix"
          />
        </div>
      }
    >
      <LoadCalculationContent />
    </Suspense>
  );
}
