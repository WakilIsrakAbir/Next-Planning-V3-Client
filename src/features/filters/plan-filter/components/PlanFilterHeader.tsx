'use client';

import { Filter, RefreshCw } from 'lucide-react';

interface PlanFilterHeaderProps {
  title: string;
  loading: boolean;
  handleRefresh: () => void;
}

/** Page title, description and the "Refresh Data" button. */
export default function PlanFilterHeader({ title, loading, handleRefresh }: PlanFilterHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <Filter className="h-6 w-6 text-primary" />
          {title}
        </h2>
        <p className="text-xs text-base-content/60">
          Multi-criteria date range and buyer filtering engine across all confirmed and tentative plans.
        </p>
      </div>

      <button
        onClick={handleRefresh}
        disabled={loading}
        className="btn btn-outline btn-sm gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        Refresh Data
      </button>
    </div>
  );
}
