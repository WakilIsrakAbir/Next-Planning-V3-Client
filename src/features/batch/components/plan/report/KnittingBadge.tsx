'use client';

/* Knit status badge (old knittingBadge(state, summary)): shown in Colour & Batch Info and the Dyeable Batch
   report. Nothing is shown without a state. */
import React from 'react';
import { knittingBadge, type Row } from '@/features/batch/lib';
import { cn } from '@/lib/cn';

/** Colours per readiness kind (old `.knit-ready`, `.knit-short`, `.knit-unknown`, `.knit-cc`, `.knit-empty`). */
const KIND: Record<string, string> = {
  ready: 'bg-[#e7f6ed] text-[#12623b] dark:bg-[rgba(16,185,129,0.16)] dark:text-[#6ee7b7]',
  short: 'bg-[#fcebec] text-[#a32432] dark:bg-[rgba(239,68,68,0.16)] dark:text-[#fca5a5]',
  unknown: 'bg-[#fff3d6] text-[#875909] dark:bg-[rgba(234,179,8,0.16)] dark:text-[#fde68a]',
  cc: 'bg-[#fff3d6] text-[#875909] dark:bg-[rgba(234,179,8,0.16)] dark:text-[#fde68a]',
  empty: 'bg-[#edf1f5] text-[#63758b] dark:bg-[#1e2330] dark:text-[#94a3b8]',
};

export default function KnittingBadge({ state, summary = false }: { state: Row | null | undefined; summary?: boolean }) {
  const badge = knittingBadge(state, summary);
  if (!badge) return null;
  return (
    <span
      className={cn(
        'inline-block whitespace-normal rounded px-1.5 py-[3px] font-semibold leading-[1.35]',
        badge.summary ? 'min-w-[96px] max-w-[190px] text-[11px]' : 'text-[10px]',
        KIND[badge.kind]
      )}
      title={badge.title || undefined}
    >
      {badge.label}
    </span>
  );
}
