'use client';

/* Page heading of every Batch page (old <header class="top-header">): eyebrow, title, optional unit tabs
   (Batch Plan and Batch Card pass <UnitTabs/>) and the status badge. */
import React from 'react';
import { cn } from '@/lib/cn';
import { S, useBatchVersion } from '@/features/batch/lib';
import { badge as badgeStyle } from '../ui/styles';

export default function BatchHeader({
  eyebrow,
  title,
  badge,
  children,
}: {
  eyebrow: string;
  title: string;
  /** Badge text when the data is ready (old viewBadgeText: 'Active Register', 'Storage Active', 'Report Preview'). */
  badge: string;
  children?: React.ReactNode;
}) {
  useBatchVersion();
  const badgeText = S.storageReady ? badge : S.loading ? 'Loading saved data…' : 'Storage unavailable';
  return (
    <header className="mb-[18px] flex flex-none items-start justify-between gap-[15px] print:hidden">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#4c6890] dark:text-[#64748b]" id="viewEyebrow">
          {eyebrow}
        </div>
        <h1 id="viewTitle" className="mx-0 mb-0 mt-[3px] text-[23px] font-bold text-[#13283f] dark:text-[#f8fafc]">
          {title}
        </h1>
        {children}
      </div>
      <span className={cn(badgeStyle.base, 'mt-1.5')} id="viewBadge" title={S.loadSummary || undefined}>
        <span className={badgeStyle.dot} />
        <span id="viewBadgeText">{badgeText}</span>
      </span>
    </header>
  );
}
