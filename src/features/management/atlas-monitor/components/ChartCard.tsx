'use client';

import { useState } from 'react';
import { Table as TableIcon } from 'lucide-react';
import type { ChartId, MonitorStats, ShowTip } from '@/features/management/atlas-monitor/types';
import { useWidth } from '@/features/management/atlas-monitor/hooks/use-width';
import { ChartTable } from '@/features/management/atlas-monitor/components/charts/ChartTable';
import { CollectionsChart } from '@/features/management/atlas-monitor/components/charts/CollectionsChart';
import { HistoryChart } from '@/features/management/atlas-monitor/components/charts/HistoryChart';
import { StatusChart } from '@/features/management/atlas-monitor/components/charts/StatusChart';
import { UploadsChart } from '@/features/management/atlas-monitor/components/charts/UploadsChart';

export function ChartCard({
  id,
  title,
  subtitle,
  stats,
  showTip,
  hideTip,
}: {
  id: ChartId;
  title: string;
  subtitle: string;
  stats: MonitorStats;
  showTip: ShowTip;
  hideTip: () => void;
}) {
  const [table, setTable] = useState(false);
  const [ref, width] = useWidth<HTMLDivElement>();
  const w = Math.max(280, width || 600);
  const props = { stats, width: w, showTip, hideTip };
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm p-5 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-bold text-sm">{title}</div>
          <div className="text-[11px] text-base-content/60 mt-0.5">{subtitle}</div>
        </div>
        <button type="button" className="am-toggle" aria-pressed={table} onClick={() => setTable((t) => !t)}>
          <TableIcon className="w-3 h-3" /> Table
        </button>
      </div>
      <div ref={ref} className="w-full min-w-0">
        {table ? (
          <ChartTable id={id} stats={stats} />
        ) : width > 0 ? (
          id === 'history' ? (
            <HistoryChart {...props} />
          ) : id === 'collections' ? (
            <CollectionsChart {...props} />
          ) : id === 'status' ? (
            <StatusChart {...props} />
          ) : (
            <UploadsChart {...props} />
          )
        ) : null}
      </div>
    </div>
  );
}
