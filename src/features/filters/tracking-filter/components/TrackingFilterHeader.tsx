'use client';

import { FileCheck, RefreshCw } from 'lucide-react';

interface TrackingFilterHeaderProps {
  title: string;
  loading: boolean;
  handleRefresh: () => void;
}

/** Page title, description and the "Refresh" button. */
export default function TrackingFilterHeader({ title, loading, handleRefresh }: TrackingFilterHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <FileCheck className="h-6 w-6 text-primary" />
          {title}
        </h2>
        <p className="text-xs text-base-content/60">
          Pass / Fail conformance analytics and delay attribution filter across planning and actual execution.
        </p>
      </div>

      <button
        onClick={handleRefresh}
        disabled={loading}
        className="btn btn-outline btn-sm gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );
}
