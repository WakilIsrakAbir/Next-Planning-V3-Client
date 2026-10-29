'use client';

/* Reports route page (/batch/report/detail | summary | daily): the old #reportsView with the Dyeable Batch,
   Dyeable Batch Summary and Daily Confirm panels and their filter dialogs.
   Once the data has loaded, the old BatchApi.route() rule for the kind runs (showReportRoute): the report of
   the kind is shown and its filters dialog opens. A preview that moved the page here does not open it again.
   The rule runs again after a data reload and when the sidebar re-opens this page (BATCH_NAVIGATE_EVENT).
   The panel shown follows S.dyeableReportMode, as the old renderDyeableReport did. */
import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { BATCH_NAVIGATE_EVENT } from '@/features/batch/lib/batch-navigation';
import BatchHeader from '@/features/batch/components/shell/BatchHeader';
import { S, showReportRoute, useBatchVersion } from '@/features/batch/lib';
import type { BatchReportKind } from '@/features/batch/lib';
import DailyConfirmPanel from './DailyConfirmPanel';
import { DyeableReportEmpty, DyeableReportPanel, DyeableSummaryPanel } from './DyeableReportPanels';
import DyeableFiltersDialog from './DyeableFiltersDialog';
import DailyConfirmFiltersDialog from './DailyConfirmFiltersDialog';

const TITLES: Record<BatchReportKind, string> = {
  detail: 'Dyeable Batch',
  summary: 'Dyeable Batch Summary',
  daily: 'Daily Confirm Batch Plan',
};

export default function BatchReportsPage({ kind }: { kind: 'detail' | 'summary' | 'daily' }) {
  useBatchVersion();
  const ready = !S.loading;
  const appState = S.appState;
  const shown = useRef<{ kind: BatchReportKind; appState: unknown } | null>(null);

  useEffect(() => {
    if (!ready) return;
    const last = shown.current;
    // Skips React's second development run of the same route (it would open the dialog of a preview again).
    if (last && last.kind === kind && last.appState === appState) return;
    shown.current = { kind, appState };
    showReportRoute(kind);
  }, [kind, ready, appState]);

  useEffect(() => {
    const onNavigate = (event: Event) => {
      if ((event as CustomEvent<{ route?: string }>).detail?.route === 'report/' + kind && !S.loading) showReportRoute(kind);
    };
    window.addEventListener(BATCH_NAVIGATE_EVENT, onNavigate);
    return () => window.removeEventListener(BATCH_NAVIGATE_EVENT, onNavigate);
  }, [kind]);

  const mode = S.dyeableReportMode;
  const result = mode === 'summary' ? S.dyeableSummaryResult : S.dyeableReportResult;
  return (
    <>
      <BatchHeader eyebrow="Reports" title={TITLES[kind]} badge="Report Preview" />
      {/* Scrolls on its own below the heading. Printed only by the Summary and Daily Confirm print modes; the
          Daily Confirm print shows only its own panel. */}
      <div
        id="reportsView"
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-auto print:hidden!',
          'print:[body.printing-dyeable-summary_&]:block! print:[body.printing-daily-confirm_&]:block!',
          'print:h-auto print:min-h-0 print:overflow-visible',
          'print:[body.printing-daily-confirm_&>:not(#dailyConfirmPanel)]:hidden!'
        )}
      >
        <DailyConfirmPanel hidden={mode !== 'daily'} />
        <DyeableReportEmpty hidden={mode === 'daily' || !!result} />
        <DyeableReportPanel hidden={mode !== 'detail' || !S.dyeableReportResult} />
        <DyeableSummaryPanel hidden={mode !== 'summary' || !S.dyeableSummaryResult} />
      </div>
      <DyeableFiltersDialog />
      <DailyConfirmFiltersDialog />
    </>
  );
}
