'use client';

/* Batch Plan report view (old #reportContainer): the toolbar and <article id="reportContent">, whose content
   is the report body (reportui's ReportBody). Toolbar buttons show and hide as the old openBatchPlanReport
   set them (and only with the matching permission, old .perm-no-* rules), and the status buttons are
   disabled while a save runs, the data is not ready, or the confirmed plan is locked (old setMutationBusy). */
import React from 'react';
import {
  BatchApi,
  S,
  backToList,
  confirmedReportLocked,
  getStoredMasterList,
  openBatchPlanPreview,
  openConfirmChecks,
  openInternalChangeDialog,
  printBatchPlan,
  reportBookingStatus,
  updateBookingStatus,
  useBatchVersion,
} from '@/features/batch/lib';
import { cn } from '@/lib/cn';
import { button, card, type ButtonVariant } from '../ui/styles';
import ReportBody from '@/features/batch/components/plan/report/ReportBody';

/** A toolbar button; the old page's buttons used the browser's control font (Arial). */
const toolbarButton = (variant: ButtonVariant) => cn(button(variant), 'font-[Arial]');

export default function BatchPlanReportView() {
  useBatchVersion();
  // (ReportBody scrolls the article to the top on every openBatchPlanReport, old reportContent.scrollTop = 0.)
  const number = S.currentViewingNumber,
    floor = S.currentViewingFloor,
    review = S.currentReportReviewLatest;

  const original = number ? getStoredMasterList().find((booking) => booking.number === number) : undefined;
  const status = original ? reportBookingStatus(original, floor) : 'Pending';
  const locked = S.mutationBusy || !S.storageReady || confirmedReportLocked();

  const showInternalChange = !review && status === 'Confirm' && BatchApi.has('actions.batchInternalChange');
  const showMovePending = !review && status !== 'Pending' && BatchApi.has('actions.batchMovePending');
  const showMakeTentative = !review && status !== 'Tentative' && BatchApi.has('actions.batchTentative');
  const showMakeConfirm = (review || status !== 'Confirm') && BatchApi.has('actions.batchConfirm');

  return (
    <div
      id="reportContainer"
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden print:block print:h-auto print:overflow-visible',
        'print:[body.printing-batch-card_&]:hidden print:[body.printing-daily-confirm_&]:hidden print:[body.printing-dyeable-summary_&]:hidden'
      )}
    >
      <div className="relative top-auto z-20 mb-1 flex flex-none flex-wrap items-center justify-between gap-2.5 bg-[#f4f7fb] px-0 py-3 shadow-[0_3px_6px_rgba(18,47,75,.08)] dark:bg-[#151921] dark:shadow-[0_3px_8px_rgba(0,0,0,0.45)] print:hidden">
        <button type="button" className={toolbarButton('secondary')} id="btnBackToList" onClick={backToList}>
          ← Back to List
        </button>
        <div className="flex flex-wrap gap-2">
          {showInternalChange && (
            <button
              type="button"
              className={toolbarButton('warning')}
              id="btnInternalChange"
              disabled={locked}
              onClick={() => openInternalChangeDialog()}
            >
              Internal change
            </button>
          )}
          {showMovePending && (
            <button
              type="button"
              className={toolbarButton('secondary')}
              id="btnMovePending"
              title="Revert to Pending"
              disabled={locked}
              onClick={() => void updateBookingStatus('Pending')}
            >
              Move to Pending
            </button>
          )}
          {showMakeTentative && (
            <button
              type="button"
              className={toolbarButton('warning')}
              id="btnMakeTentative"
              disabled={locked}
              onClick={() => void updateBookingStatus('Tentative')}
            >
              Make Tentative
            </button>
          )}
          {showMakeConfirm && (
            <button type="button" className={toolbarButton('success')} id="btnMakeConfirm" disabled={locked} onClick={() => openConfirmChecks()}>
              {review ? 'Re-Confirm Latest Plan' : 'Confirm Batch Plan'}
            </button>
          )}
          <button type="button" className={toolbarButton('secondary')} id="btnViewBatchPlan" onClick={() => openBatchPlanPreview()}>
            View Batch Plan
          </button>
          {BatchApi.has('downloads.batchPlanPrint') && (
            <button type="button" className={toolbarButton('primary')} id="btnPrintReport" onClick={printBatchPlan}>
              Print / Save PDF
            </button>
          )}
        </div>
      </div>
      <article
        id="reportContent"
        className={cn(
          card,
          'm-0 min-h-0 flex-1 overflow-y-auto overscroll-contain p-[26px]',
          'print:m-0 print:block print:h-auto print:max-h-none print:flex-none print:overflow-visible print:border-0 print:bg-white print:p-0 print:shadow-none! print:[page:batch-plan]'
        )}
        aria-live="polite"
      >
        <ReportBody />
      </article>
    </div>
  );
}
