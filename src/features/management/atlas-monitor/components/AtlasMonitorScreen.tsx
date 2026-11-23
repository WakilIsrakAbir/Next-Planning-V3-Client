'use client';

/*
 * Data Management > Atlas Monitor: database health (GET /api/monitor/stats) drawn as SVG charts, and the full
 * database backup download (GET /api/monitor/backup, Admin only).
 * V3 shares its database with the old app (Shimul Mama Project V2), which has the same page: both show the same
 * numbers, the same daily history and the same "last backup".
 */

import { useCallback, useEffect, useState } from 'react';
import { HeartPulse, RefreshCw, ShieldAlert } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { batchHasMenu } from '@/features/batch/lib/batch-navigation';
import type { MonitorStats, ShowTip, TipState } from '@/features/management/atlas-monitor/types';
import { errorText, fmtDateTime } from '@/features/management/atlas-monitor/lib/format';
import { Tooltip } from '@/features/management/atlas-monitor/components/Tooltip';
import { ChartCard } from '@/features/management/atlas-monitor/components/ChartCard';
import { StorageCard } from '@/features/management/atlas-monitor/components/StorageCard';
import { BackupCard } from '@/features/management/atlas-monitor/components/BackupCard';
import { KpiRow } from '@/features/management/atlas-monitor/components/KpiRow';
import { UploadsTable } from '@/features/management/atlas-monitor/components/UploadsTable';

// ---------- page ----------
export default function AtlasMonitorScreen() {
  // The dashboard renders pages only on the client (after the session check), so localStorage is readable here.
  const [allowed] = useState(() => batchHasMenu('dataManagement', 'atlasMonitor'));
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [loading, setLoading] = useState(allowed); // the first load starts at once
  const [error, setError] = useState<string | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const showTip = useCallback<ShowTip>((x, y, title, rows) => setTip({ x, y, title, rows }), []);
  const hideTip = useCallback(() => setTip(null), []);

  // Refresh button (and after a backup, to show it as the last backup).
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await apiClient<MonitorStats>('/api/monitor/stats'));
    } catch (e: unknown) {
      setError(errorText(e, 'Could not load database stats.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Without the permission the API is never called (a 403 would sign the user out).
    if (!allowed) return;
    let live = true;
    apiClient<MonitorStats>('/api/monitor/stats')
      .then((s) => {
        if (live) setStats(s);
      })
      .catch((e: unknown) => {
        if (live) setError(errorText(e, 'Could not load database stats.'));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [allowed]);

  if (!allowed) {
    return (
      <div className="card bg-base-100 border border-base-300 p-8 text-center max-w-xl mx-auto mt-10">
        <ShieldAlert className="w-8 h-8 mx-auto text-warning" />
        <h2 className="font-bold mt-3">Access denied</h2>
        <p className="text-xs text-base-content/60 mt-1">Atlas Monitor needs the Atlas Monitor permission (Data Management). Ask an Admin.</p>
      </div>
    );
  }

  return (
    <div className="am-root space-y-5 w-full max-w-375 mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/50 mb-1">Data Management › Atlas Monitor</div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <HeartPulse className="h-6 w-6" style={{ color: 'var(--am-s1)' }} />
            Atlas Monitor
          </h2>
          <p className="text-xs text-base-content/60 mt-1">
            {error
              ? `${error} Try Refresh.`
              : stats
                ? `Live from database "${stats.database.name}" (MongoDB ${stats.database.serverVersion || '-'}). Updated ${fmtDateTime(stats.generatedAt)}.`
                : 'Loading database health…'}
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-outline gap-1" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {stats && (
        // While it reloads, the previous numbers stay on screen, dimmed.
        <div className="flex flex-col gap-5" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .2s' }}>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <StorageCard stats={stats} />
            <BackupCard stats={stats} onDone={load} />
          </div>
          <KpiRow stats={stats} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ChartCard id="history" title="Storage used over time" subtitle="Data + index, one reading per day. The line at 512 MB is the free-tier limit." stats={stats} showTip={showTip} hideTip={hideTip} />
            <ChartCard id="collections" title="Space by collection" subtitle="Data size of each collection, largest first." stats={stats} showTip={showTip} hideTip={hideTip} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ChartCard id="status" title="Plan status by department" subtitle="Orders in each department's latest file, as the plan list tabs count them." stats={stats} showTip={showTip} hideTip={hideTip} />
            <ChartCard id="uploads" title="Files uploaded per day" subtitle="All categories, last 30 days." stats={stats} showTip={showTip} hideTip={hideTip} />
          </div>
          <UploadsTable stats={stats} />
        </div>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}
