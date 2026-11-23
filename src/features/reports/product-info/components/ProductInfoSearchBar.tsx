'use client';

import { Search } from 'lucide-react';

interface ProductInfoSearchBarProps {
  search: string;
  setSearch: (value: string) => void;
  applySearchNow: () => void;
  totalCount: number;
}

/** Control Card: the search box and the total number of orders. */
export default function ProductInfoSearchBar({ search, setSearch, applySearchNow, totalCount }: ProductInfoSearchBarProps) {
  return (
    <div className="flex-none card bg-base-100 border border-base-300 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-base-content/40" />
          <input
            type="text"
            placeholder="Search by order or buyer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applySearchNow();
            }}
            className="input input-bordered input-sm w-full pl-9"
          />
        </div>

        <div className="text-xs font-bold text-base-content/60">
          Total Orders: <span className="text-primary font-black">{totalCount}</span>
        </div>
      </div>
    </div>
  );
}
