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
 *
 * `onlyOnWindowResize`: after the first measurement, the row count changes only when the window is resized or the
 * area's width changes (sidebar toggle). Height changes caused by the page's own content (buyer buttons, counts or
 * fonts arriving after the first load) are ignored, so a slow list is never requested a second time on first open.
 */
export function useFitRows(
  scrollRef: React.RefObject<HTMLElement | null>,
  rowHeight: number,
  minRows = 5,
  onlyOnWindowResize = false
): FitRows | null {
  const [fit, setFit] = useState<FitRows | null>(null);

  // Measured before the browser paints, so the first screen already shows the fitted rows.
  useLayoutEffect(() => {
    const area = scrollRef.current;
    if (!area || typeof ResizeObserver === 'undefined') return;

    let timer: number | undefined;
    // Available height of the last applied measurement. Changes smaller than SMALL_CHANGE_PX (e.g. a scrollbar
    // showing up in a row above the table) keep the current row count, so they never trigger a second list request.
    let lastAvailable = -1;
    const SMALL_CHANGE_PX = 12;
    const measure = () => {
      const header = area.querySelector('thead');
      const available = area.clientHeight - (header ? header.getBoundingClientRect().height : 0);
      if (available <= 0) return;
      if (lastAvailable > 0 && Math.abs(available - lastAvailable) < SMALL_CHANGE_PX) return;
      lastAvailable = available;
      const rows = Math.max(minRows, Math.floor(available / rowHeight));
      const exact = rows * rowHeight <= available ? Math.floor((available / rows) * 100) / 100 : rowHeight;
      setFit((current) => (current && current.rows === rows && current.rowHeight === exact ? current : { rows, rowHeight: exact }));
    };

    measure();
    // Resizes come in bursts (dragging the window, the sidebar animation); settle before changing the row count.
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 150);
    };
    let lastWidth = area.clientWidth;
    const observer = new ResizeObserver(() => {
      if (onlyOnWindowResize && lastAvailable > 0) {
        // Content-driven height changes are ignored; a width change (sidebar toggle) still re-measures.
        if (area.clientWidth === lastWidth) return;
        lastWidth = area.clientWidth;
        lastAvailable = -1;
      }
      schedule();
    });
    observer.observe(area);
    const onWindowResize = () => {
      lastAvailable = -1;
      schedule();
    };
    if (onlyOnWindowResize) window.addEventListener('resize', onWindowResize);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      if (onlyOnWindowResize) window.removeEventListener('resize', onWindowResize);
    };
  }, [scrollRef, rowHeight, minRows, onlyOnWindowResize]);

  return fit;
}

/** Page that keeps the first visible row in view when the page size changes. */
export function pageForNewLimit(page: number, oldLimit: number, newLimit: number): number {
  return Math.floor(((page - 1) * oldLimit) / newLimit) + 1;
}
