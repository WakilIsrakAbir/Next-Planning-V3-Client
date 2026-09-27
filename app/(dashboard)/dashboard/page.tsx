'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  UploadCloud,
  Activity,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
  Database,
  Layers,
} from 'lucide-react';
import { API_BASE } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';

export default function DashboardPage() {
  const [recentFiles, setRecentFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    confirmedPlans: 0,
    pendingPlans: 0,
    activeFiles: 0,
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch recent files
        const filesRes = await fetch(`${API_BASE}/api/files/all`, { headers });
        if (filesRes.ok) {
          const filesData = await filesRes.json();
          setRecentFiles(filesData.slice(0, 5));
          setStats((prev) => ({ ...prev, activeFiles: filesData.length }));
        }

        // Fetch overall orders count
        const ordersRes = await fetch(`${API_BASE}/api/orders/all-list?page=1&limit=1`, { headers });
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setStats((prev) => ({ ...prev, totalOrders: ordersData.total || 0 }));
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-800 p-6 text-white shadow-xl lg:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="badge badge-warning text-xs font-bold mb-2">Textile PPC Suite V3</div>
          <h2 className="text-2xl font-black tracking-tight lg:text-3xl">
            Epylion Production Planning Dashboard
          </h2>
          <p className="mt-2 text-sm text-emerald-100">
            Real-time synchronization across YD, Knitting, Dyeing, Finishing, and Dispatch floor operations. Select an operation from the sidebar to begin.
          </p>
        </div>
        <div className="absolute -right-8 -bottom-8 opacity-10">
          <Layers className="w-80 h-80" />
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card bg-base-100 p-5 shadow-sm border border-base-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-base-content/60">Total Active Orders</span>
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Database className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black">{stats.totalOrders.toLocaleString()}</p>
          <span className="text-[11px] text-success font-semibold mt-1 flex items-center">
            Synced from latest Excel files
          </span>
        </div>

        <div className="card bg-base-100 p-5 shadow-sm border border-base-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-base-content/60">Uploaded Files</span>
            <div className="rounded-lg bg-info/10 p-2 text-info">
              <UploadCloud className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black">{stats.activeFiles}</p>
          <span className="text-[11px] text-base-content/60 mt-1">GridFS binary archives</span>
        </div>

        <div className="card bg-base-100 p-5 shadow-sm border border-base-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-base-content/60">Core Departments</span>
            <div className="rounded-lg bg-success/10 p-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black">5</p>
          <span className="text-[11px] text-base-content/60 mt-1">YD, Knit, Dye, Finish, Deli</span>
        </div>

        <div className="card bg-base-100 p-5 shadow-sm border border-base-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-base-content/60">Shift Expiration</span>
            <div className="rounded-lg bg-warning/10 p-2 text-warning">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black font-mono">12:00 AM</p>
          <span className="text-[11px] text-base-content/60 mt-1">Dhaka Timezone (UTC+6)</span>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div>
        <h3 className="text-base font-bold mb-3">Operational Portals</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/planning/knitting"
            className="card bg-base-100 border border-base-300 p-5 shadow-sm hover:border-primary hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-500 group-hover:scale-105 transition-transform">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Knitting Planning</h4>
                <p className="text-xs text-base-content/60">Yarn allocation, grey req, & capacity dates</p>
              </div>
            </div>
          </Link>

          <Link
            href="/planning/dyeing"
            className="card bg-base-100 border border-base-300 p-5 shadow-sm hover:border-primary hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-500/10 p-3 text-violet-500 group-hover:scale-105 transition-transform">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Dyeing Planning</h4>
                <p className="text-xs text-base-content/60">Machine process allocation & limitation tracking</p>
              </div>
            </div>
          </Link>

          <Link
            href="/tracking/knitting"
            className="card bg-base-100 border border-base-300 p-5 shadow-sm hover:border-primary hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-teal-500/10 p-3 text-teal-600 group-hover:scale-105 transition-transform">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Plan vs Actual Floor Tracking</h4>
                <p className="text-xs text-base-content/60">Live production actuals & lead day variance</p>
              </div>
            </div>
          </Link>

          <Link
            href="/reports/planning-prod-info"
            className="card bg-base-100 border border-base-300 p-5 shadow-sm hover:border-primary hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-500/10 p-3 text-amber-500 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Planning & Production Info (PPI)</h4>
                <p className="text-xs text-base-content/60">3-Section report with OTT Pass/Fail indicator</p>
              </div>
            </div>
          </Link>

          <Link
            href="/load-calc"
            className="card bg-base-100 border border-base-300 p-5 shadow-sm hover:border-primary hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-500/10 p-3 text-rose-500 group-hover:scale-105 transition-transform">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm">5-Month Load Forecasting</h4>
                <p className="text-xs text-base-content/60">Capacity projections and buyer-wise summaries</p>
              </div>
            </div>
          </Link>

          <Link
            href="/management/setup"
            className="card bg-base-100 border border-base-300 p-5 shadow-sm hover:border-primary hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-500/10 p-3 text-slate-500 group-hover:scale-105 transition-transform">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Dropdown Master Setup</h4>
                <p className="text-xs text-base-content/60">Standardized Units, Processes & delete protection</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Upload Activity */}
      <div className="card bg-base-100 border border-base-300 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-primary" /> Recent File Upload Archives
          </h3>
          <Link href="/management/upload" className="text-xs text-primary hover:underline font-semibold">
            View All Uploads &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <ExpLoadingSpinner message="Loading Upload Archives..." size="sm" overlay={false} />
          </div>
        ) : recentFiles.length === 0 ? (
          <div className="text-center py-8 text-xs text-base-content/60">No files uploaded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="bg-base-200/50 text-xs">
                  <th>Original Name</th>
                  <th>Category</th>
                  <th>Uploaded By</th>
                  <th>Upload Date</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {recentFiles.map((file) => (
                  <tr key={file._id} className="hover">
                    <td className="font-semibold">{file.originalName}</td>
                    <td>
                      <span className="badge badge-outline badge-sm font-bold">{file.category}</span>
                    </td>
                    <td>{file.uploadedBy} ({file.role})</td>
                    <td>{formatDateDisplay(file.createdAt)}</td>
                    <td>{((file.size || 0) / 1024).toFixed(1)} KB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
