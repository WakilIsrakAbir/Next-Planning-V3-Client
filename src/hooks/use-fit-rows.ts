'use client';

import { useLayoutEffect, useState } from 'react';

export interface FitRows {
  /** How many rows fit in the scroll area without scrolling (at least `minRows`). */
  rows: number;
  /** Row height that fills the area exactly with `rows` rows (never below the natural `rowHeight`). */
  rowHeight: number;
}

/**
 * Measures a table's scroll area and returns how many rows of `rowHeight` px fit below its sticky header,
 * so a list page can request exactly one screen of rows: no scrollbar and no empty band at the bottom.
 * Re-measures when the area is resized (window resize, sidebar toggle); returns null until measured.
 */
export function useFitRows(
  scrollRef: React.RefObject<HTMLElement | null>,
  rowHeight: number,
  minRows = 5
): FitRows | null {
  const [fit, setFit] = useState<FitRows | null>(null);

  // Measured before the browser paints, so the first screen already shows the fitted rows.
  useLayoutEffect(() => {
    const area = scrollRef.current;
    if (!area || typeof ResizeObserver === 'undefined') return;

    let timer: number | undefined;
    const measure = () => {
      const header = area.querySelector('thead');
      const available = area.clientHeight - (header ? header.getBoundingClientRect().height : 0);
      if (available <= 0) return;
      const rows = Math.max(minRows, Math.floor(available / rowHeight));
      const exact = rows * rowHeight <= available ? Math.floor((available / rows) * 100) / 100 : rowHeight;
      setFit((current) => (current && current.rows === rows && current.rowHeight === exact ? current : { rows, rowHeight: exact }));
    };

    measure();
    // Resizes come in bursts (dragging the window, the sidebar animation); settle before changing the row count.
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 150);
    });
    observer.observe(area);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [scrollRef, rowHeight, minRows]);

  return fit;
}

/** Page that keeps the first visible row in view when the page size changes. */
export function pageForNewLimit(page: number, oldLimit: number, newLimit: number): number {
  return Math.floor(((page - 1) * oldLimit) / newLimit) + 1;
}
