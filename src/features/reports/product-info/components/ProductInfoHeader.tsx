'use client';

import { Layers, RefreshCw } from 'lucide-react';

export default function ProductInfoHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex-none flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />
          Product Info (Color-wise Specification)
        </h2>
        <p className="text-xs text-base-content/60">
          View order specifications, yarn balance, knitting & dyeing metrics, and color-wise allocation breakdowns.
        </p>
      </div>

      <button onClick={onRefresh} className="btn btn-outline btn-sm gap-2">
        <RefreshCw className="h-4 w-4" /> Refresh
      </button>
    </div>
  );
}
