'use client';

import { FileText } from 'lucide-react';
import PPISearchBar from '@/features/reports/planning-prod-info/components/PPISearchBar';

interface PPIListHeaderProps {
  search: string;
  setSearch: (value: string) => void;
  styleSearch: string;
  setStyleSearch: (value: string) => void;
  applySearchNow: () => void;
}

export default function PPIListHeader({ search, setSearch, styleSearch, setStyleSearch, applySearchNow }: PPIListHeaderProps) {
  return (
    <div className="flex-none flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Planning & Production Info (PPI)
        </h2>
        <p className="text-xs text-base-content/60">
          Select an order to view the 3-section comprehensive specification and milestone report.
        </p>
      </div>

      {/* Search: Booking / Order No. and Style (US-12) */}
      <PPISearchBar
        search={search}
        setSearch={setSearch}
        styleSearch={styleSearch}
        setStyleSearch={setStyleSearch}
        applySearchNow={applySearchNow}
      />
    </div>
  );
}
