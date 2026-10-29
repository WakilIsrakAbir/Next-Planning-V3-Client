'use client';

/* Batch Plan report view (old #reportContainer): the toolbar and <article id="reportContent">, whose content
   is the report body (reportui's ReportBody). Toolbar buttons show and hide as the old openBatchPlanReport
   set them, and the status buttons are disabled while a save runs, the data is not ready, or the confirmed
   plan is locked (old setMutationBusy). */
import React from 'react';
import {
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
import ReportBody from '@/features/batch/components/plan/report/ReportBody';

export default function BatchPlanReportView() {
  useBatchVersion();
  // (ReportBody scrolls the article to the top on every openBatchPlanReport, old reportContent.scrollTop = 0.)
  const number = S.currentViewingNumber,
    floor = S.currentViewingFloor,
    review = S.currentReportReviewLatest;

  const original = number ? getStoredMasterList().find((booking) => booking.number === number) : undefined;
  const status = original ? reportBookingStatus(original, floor) : 'Pending';
  const locked = S.mutationBusy || !S.storageReady || confirmedReportLocked();

  return (
    <div id="reportContainer">
      <div className="report-toolbar">
        <button type="button" className="btn secondary" id="btnBackToList" onClick={backToList}>
          ← Back to List
        </button>
        <div className="btn-group-actions">
          <button
            type="button"
            className={'btn warning' + (review || status !== 'Confirm' ? ' hidden' : '')}
            id="btnInternalChange"
            disabled={locked}
            onClick={() => openInternalChangeDialog()}
          >
            Internal change
          </button>
          <button
            type="button"
            className="btn secondary"
            id="btnMovePending"
            title="Revert to Pending"
            style={{ display: review || status === 'Pending' ? 'none' : 'inline-flex' }}
            disabled={locked}
            onClick={() => void updateBookingStatus('Pending')}
          >
            Move to Pending
          </button>
          <button
            type="button"
            className="btn warning"
            id="btnMakeTentative"
            style={{ display: review || status === 'Tentative' ? 'none' : 'inline-flex' }}
            disabled={locked}
            onClick={() => void updateBookingStatus('Tentative')}
          >
            Make Tentative
          </button>
          <button
            type="button"
            className="btn success"
            id="btnMakeConfirm"
            style={{ display: !review && status === 'Confirm' ? 'none' : 'inline-flex' }}
            disabled={locked}
            onClick={() => openConfirmChecks()}
          >
            {review ? 'Re-Confirm Latest Plan' : 'Confirm Batch Plan'}
          </button>
          <button type="button" className="btn secondary" id="btnViewBatchPlan" onClick={() => openBatchPlanPreview()}>
            View Batch Plan
          </button>
          <button type="button" className="btn" id="btnPrintReport" onClick={printBatchPlan}>
            Print / Save PDF
          </button>
        </div>
      </div>
      <article id="reportContent" className="report card" aria-live="polite">
        <ReportBody />
      </article>
    </div>
  );
}
