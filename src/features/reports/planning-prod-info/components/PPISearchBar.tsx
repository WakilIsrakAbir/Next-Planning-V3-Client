'use client';

import { Search } from 'lucide-react';

interface PPISearchBarProps {
  search: string;
  setSearch: (value: string) => void;
  styleSearch: string;
  setStyleSearch: (value: string) => void;
  applySearchNow: () => void;
}

/** Search: Booking / Order No. and Style (US-12) */
export default function PPISearchBar({ search, setSearch, styleSearch, setStyleSearch, applySearchNow }: PPISearchBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applySearchNow();
          }}
          placeholder="Search Booking / Order No..."
          aria-label="Search Booking / Order No."
          className="input input-bordered input-sm w-44 sm:w-56 pl-8 text-xs"
        />
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/50" />
      </div>
      <div className="relative">
        <input
          type="text"
          value={styleSearch}
          onChange={(e) => setStyleSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applySearchNow();
          }}
          placeholder="Search Style..."
          aria-label="Search Style"
          className="input input-bordered input-sm w-36 sm:w-48 pl-8 text-xs"
        />
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-base-content/50" />
      </div>
    </div>
  );
}
