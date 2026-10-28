'use client';

/* Knit status badge (old knittingBadge(state, summary)): shown in Colour & Batch Info and the Dyeable Batch
   report. Nothing is shown without a state. */
import React from 'react';
import { knittingBadge, type Row } from '@/features/batch/engine';

export default function KnittingBadge({ state, summary = false }: { state: Row | null | undefined; summary?: boolean }) {
  const badge = knittingBadge(state, summary);
  if (!badge) return null;
  return (
    <span className={badge.className} title={badge.title || undefined}>
      {badge.label}
    </span>
  );
}
