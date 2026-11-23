'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { REPORT_MAX_WIDTH, ZOOM_MAX, ZOOM_MIN } from '@/features/reports/planning-prod-info/lib/constants';

/** The report's zoom and screen fit (sheet scaling, auto-fit on open and on window resize). */
export function useReportZoom(isReportReady: boolean, reportOrderNo: string | undefined) {
  // ==========================================
  // Zoom & screen fit
  // ==========================================
  const viewportRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const autoFitRef = useRef(false);
  const [reportZoom, setReportZoomValue] = useState(1);
  const [reportAutoFit, setReportAutoFit] = useState(false);

  /** Applies the zoom: the sheet is scaled from its top-left corner and the sizer reserves its scaled size. */
  const layoutReportSheet = useCallback(() => {
    const viewport = viewportRef.current;
    const sizer = sizerRef.current;
    const sheet = sheetRef.current;
    if (!viewport || !sizer || !sheet) return;
    const available = viewport.clientWidth;
    if (available <= 0) return;
    const zoom = zoomRef.current;
    // Zoomed out, the sheet may lay out wider (up to its max width) so the smaller report still fills the view.
    const layoutWidth = zoom < 1 ? Math.min(REPORT_MAX_WIDTH, available / zoom) : Math.min(REPORT_MAX_WIDTH, available);
    sheet.style.width = `${layoutWidth}px`;
    sheet.style.transform = `scale(${zoom})`;
    sizer.style.width = `${layoutWidth * zoom}px`;
    sizer.style.height = `${sheet.offsetHeight * zoom}px`;
  }, []);

  const setReportZoom = useCallback(
    (value: number, fitted = false) => {
      const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
      zoomRef.current = clamped;
      autoFitRef.current = fitted;
      setReportZoomValue(clamped);
      setReportAutoFit(fitted);
      layoutReportSheet();
    },
    [layoutReportSheet]
  );

  const fitReportToScreen = useCallback(() => {
    const viewport = viewportRef.current;
    const sheet = sheetRef.current;
    if (!viewport || !sheet) return;
    const available = viewport.clientWidth;
    // Measure the sheet at its natural (100%) width.
    const previousWidth = sheet.style.width;
    sheet.style.width = `${Math.min(REPORT_MAX_WIDTH, available)}px`;
    const originalWidth = sheet.scrollWidth || sheet.offsetWidth || REPORT_MAX_WIDTH;
    sheet.style.width = previousWidth;
    if (available > 0 && originalWidth > 0) {
      setReportZoom(Math.min(1, available / originalWidth), true);
    }
  }, [setReportZoom]);

  const changeReportZoom = (delta: number) => setReportZoom(zoomRef.current + delta, false);
  const resetReportZoom = () => setReportZoom(1, false);

  useLayoutEffect(() => {
    if (!isReportReady) return;
    const viewport = viewportRef.current;
    const sheet = sheetRef.current;
    if (!viewport || !sheet) return;

    layoutReportSheet();
    let layoutFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(layoutReportSheet);
    });
    observer.observe(viewport);
    observer.observe(sheet);

    // Opening a report fits it to the screen; while fitted, a window resize fits it again.
    const fitFrame = requestAnimationFrame(fitReportToScreen);
    const onResize = () => {
      if (autoFitRef.current) requestAnimationFrame(fitReportToScreen);
    };
    window.addEventListener('resize', onResize);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(layoutFrame);
      cancelAnimationFrame(fitFrame);
      window.removeEventListener('resize', onResize);
    };
  }, [isReportReady, reportOrderNo, layoutReportSheet, fitReportToScreen]);

  return {
    viewportRef,
    sizerRef,
    sheetRef,
    reportZoom,
    reportAutoFit,
    fitReportToScreen,
    changeReportZoom,
    resetReportZoom,
  };
}
