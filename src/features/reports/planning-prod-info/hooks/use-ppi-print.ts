'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { PPIOrder } from '@/features/reports/planning-prod-info/lib/ppi-utils';
import {
  buildPrintPages,
  clearPrintPages,
  hasPrintPages,
  removePrintContainer,
  type PPIPrintSources,
} from '@/features/reports/planning-prod-info/print/print-engine';

/** A4 landscape print: the report sections' refs, the Print button handler and the browser print (Ctrl+P) hooks. */
export function usePPIPrint(isReportReady: boolean, selectedOrder: PPIOrder | null, colorCountText: string) {
  // ==========================================
  // A4 landscape print
  // ==========================================
  const specSectionRef = useRef<HTMLElement>(null);
  const planSectionRef = useRef<HTMLElement>(null);
  const summaryHeaderRef = useRef<HTMLDivElement>(null);
  const summaryTheadRef = useRef<HTMLTableSectionElement>(null);
  const summaryTbodyRef = useRef<HTMLTableSectionElement>(null);

  const getPrintSources = useCallback(
    (): PPIPrintSources => ({
      specSection: specSectionRef.current,
      planSection: planSectionRef.current,
      summaryHeader: summaryHeaderRef.current,
      summaryThead: summaryTheadRef.current,
      summaryTbody: summaryTbodyRef.current,
      bookingTitle: `Booking #${selectedOrder?.orderNo || '—'}`,
      colorCountText,
    }),
    [selectedOrder, colorCountText]
  );

  const printReport = () => {
    buildPrintPages(getPrintSources());
    window.print();
  };

  useEffect(() => {
    if (!isReportReady) return;
    // Browser print (Ctrl+P) builds the pages too; they are discarded once printing ends.
    const onBeforePrint = () => {
      if (!hasPrintPages()) buildPrintPages(getPrintSources());
    };
    const onAfterPrint = () => clearPrintPages();
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
      removePrintContainer();
    };
  }, [isReportReady, getPrintSources]);

  return {
    specSectionRef,
    planSectionRef,
    summaryHeaderRef,
    summaryTheadRef,
    summaryTbodyRef,
    printReport,
  };
}
