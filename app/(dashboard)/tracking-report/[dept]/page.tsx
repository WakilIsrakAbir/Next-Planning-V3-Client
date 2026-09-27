'use client';

import React, { useState, useEffect, use } from 'react';
import {
  FileSpreadsheet,
  Download,
  Clock,
  CheckCircle2,
  FileText,
  RefreshCw,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { API_BASE, DEPARTMENTS } from '@/lib/constants';
import InlineSpinner from '@/components/common/InlineSpinner';

interface PageProps {
  params: Promise<{ dept: string }>;
}

const DEPT_NAMES: Record<string, string> = {
  yd: 'YD',
  knitting: 'Knitting',
  dyeing: 'Dyeing',
  finishing: 'Finishing',
  delivery: 'Delivery',
  deliveryfloor: 'Delivery (Floor)',
};

export default function TrackingReportPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const dept = resolvedParams.dept || 'knitting';
  const deptName = DEPT_NAMES[dept] || dept.toUpperCase();

  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [completeCount, setCompleteCount] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Fetch counts
  const fetchCounts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/orders/tracking/${dept}?all=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const { planDocs = [] } = data;
        const actualKey = (dept === 'deliveryfloor' ? 'delivery' : dept) + 'Actual';

        let pCount = 0;
        let cCount = 0;

        planDocs.forEach((doc: any) => {
          const act = doc[actualKey];
          const hasActualEnd = act && act.actualEnd && act.actualEnd.trim() !== '' && act.actualEnd !== '-';
          if (hasActualEnd) cCount++;
          else pCount++;
        });

        setPendingCount(pCount);
        setCompleteCount(cCount);
      }
    } catch (err) {
      console.error('Failed to fetch tracking counts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [dept]);

  // Download Excel
  const handleDownloadExcel = async (status: 'Pending' | 'Complete') => {
    setDownloading(`excel-${status}`);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/orders/tracking-download/${dept}?status=${status}&token=${token}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        alert('No data found for this report.');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deptName}_${status}_Tracking_Report_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            {deptName} Tracking Report
          </h2>
          <p className="text-xs text-base-content/60">
            Export official production tracking reports with full conformance Pass/Fail analysis and delay attribution.
          </p>
        </div>

        <button
          onClick={fetchCounts}
          disabled={loading}
          className="btn btn-outline btn-sm gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* Two Main Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pending Report Card */}
        <div className="card bg-base-100 border border-base-300 shadow-sm p-6 space-y-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                <Clock className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-base-content">
                  Pending Tracking Report
                </h3>
                <p className="text-xs text-base-content/60">
                  Active orders currently running on floor with unclosed actual end dates.
                </p>
              </div>
            </div>

            <div className="badge badge-warning badge-lg font-bold">
              {loading ? '...' : `${pendingCount} Orders`}
            </div>
          </div>

          <div className="bg-base-200/50 p-4 rounded-lg text-xs space-y-2 text-base-content/70">
            <div className="flex items-center justify-between">
              <span>Department:</span>
              <span className="font-bold text-base-content">{deptName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Report Type:</span>
              <span className="font-bold text-amber-600">Pending Execution</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Contains:</span>
              <span>SL, Booking No, Buyer, Plan & Actual Dates, Pass/Fail, Fail Reason, Related Dept</span>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => handleDownloadExcel('Pending')}
              disabled={downloading !== null || pendingCount === 0}
              className="btn btn-primary btn-sm flex-1 gap-2 font-bold shadow-md shadow-primary/20"
            >
              {downloading === 'excel-Pending' ? (
                <InlineSpinner size={14} />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download Pending Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Complete Report Card */}
        <div className="card bg-base-100 border border-base-300 shadow-sm p-6 space-y-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-success/10 text-success rounded-xl">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-base-content">
                  Completed Tracking Report
                </h3>
                <p className="text-xs text-base-content/60">
                  Archived orders that have successfully recorded completed actual end dates.
                </p>
              </div>
            </div>

            <div className="badge badge-success text-white badge-lg font-bold">
              {loading ? '...' : `${completeCount} Orders`}
            </div>
          </div>

          <div className="bg-base-200/50 p-4 rounded-lg text-xs space-y-2 text-base-content/70">
            <div className="flex items-center justify-between">
              <span>Department:</span>
              <span className="font-bold text-base-content">{deptName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Report Type:</span>
              <span className="font-bold text-success">Finished / Completed</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Contains:</span>
              <span>SL, Booking No, Buyer, Plan & Actual Dates, Pass/Fail, Fail Reason, Related Dept</span>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => handleDownloadExcel('Complete')}
              disabled={downloading !== null || completeCount === 0}
              className="btn btn-success text-white btn-sm flex-1 gap-2 font-bold shadow-md"
            >
              {downloading === 'excel-Complete' ? (
                <InlineSpinner size={14} />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download Complete Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
