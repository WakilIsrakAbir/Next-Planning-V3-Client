'use client';

import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import type { MonitorStats } from '@/features/management/atlas-monitor/types';
import { fmtMB, pct } from '@/features/management/atlas-monitor/lib/format';

export function StorageCard({ stats }: { stats: MonitorStats }) {
  const d = stats.database;
  const used = d.dataSize + d.indexSize;
  const share = pct(used, d.limitBytes);
  const level =
    share >= 85
      ? { color: '--am-crit', icon: <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--am-crit)' }} />, label: 'Almost full' }
      : share >= 70
        ? { color: '--am-warn', icon: <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--am-warn)' }} />, label: 'Getting full' }
        : { color: '--am-good', icon: <CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--am-good)' }} />, label: 'Healthy' };
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm p-5 xl:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-base-content/70">Atlas storage used (data + index)</div>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <span className="font-semibold" style={{ fontSize: 48, lineHeight: 1 }}>
              {fmtMB(used)}
            </span>
            <span className="text-sm text-base-content/70">
              of {fmtMB(d.limitBytes)} · {share}%
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border border-base-300">
          {level.icon}
          {level.label}
        </span>
      </div>
      <div className="mt-4 relative">
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={share}
          aria-label={`Storage used ${share}%`}
          style={{ height: 10, borderRadius: 999, background: 'var(--am-track)', overflow: 'hidden' }}
        >
          <div style={{ height: '100%', width: `${Math.min(100, share)}%`, background: `var(${share >= 70 ? level.color : '--am-s1'})`, borderRadius: 999 }} />
        </div>
        {/* 70% warning mark */}
        <div style={{ position: 'absolute', left: '70%', top: -3, width: 1, height: 16, background: 'var(--am-ink2)' }} />
      </div>
      <div className="relative text-[11px] text-base-content/60 mt-1" style={{ height: 16, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ position: 'absolute', left: 0 }}>0</span>
        <span style={{ position: 'absolute', left: '70%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>70% warning</span>
        <span style={{ position: 'absolute', right: 0 }}>{fmtMB(d.limitBytes)}</span>
      </div>
      <p className="text-xs text-base-content/70 mt-3 leading-relaxed">
        Atlas counts only data ({fmtMB(d.dataSize)}) and indexes ({fmtMB(d.indexSize)}) against the limit. The files on disk take {fmtMB(d.storageSize)}, of
        which {fmtMB(d.freeStorageSize)} is free space that new data reuses; disk size is not counted.
      </p>
    </div>
  );
}
