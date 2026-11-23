'use client';

import { useEffect, useRef } from 'react';
import { registerUnsavedChanges } from '@/lib/unsaved-changes';

/* The React side of the unsaved-work guard (src/lib/unsaved-changes.ts). */

/**
 * Registers `labels` as unsaved work of source `id` while the list is not empty; an empty list, another id or
 * unmounting unregisters it. While registered the labels follow the latest render and the source keeps its place.
 */
export function useUnsavedChanges(id: string, labels: string[]): void {
  const latest = useRef(labels);
  useEffect(() => {
    latest.current = labels;
  });
  const active = labels.length > 0;
  useEffect(() => {
    if (!active) return undefined;
    return registerUnsavedChanges(id, () => latest.current);
  }, [id, active]);
}
