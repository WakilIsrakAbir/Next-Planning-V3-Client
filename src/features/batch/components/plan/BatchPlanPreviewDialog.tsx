'use client';

/* Read-only, zoomable full view of the report (old #batchPlanPreviewDialog), shown while
   S.batchPlanPreviewState is set. As the old openBatchPlanPreview did, the rendered #reportContent is copied
   into the paper as a read-only snapshot: edit controls, buttons and notes are removed, inputs become text,
   and the page is as wide as its widest table. Zoom, Fit width / Fit page and 100% never change the
   booking; Print keeps the saved-PDF layout. Escape closes; Tab stays inside. */
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  S,
  actualSizeBatchPlanPreview,
  closeBatchPlanPreview,
  fitBatchPlanPreview,
  floorLabel,
  printBatchPlan,
  useBatchVersion,
  zoomBatchPlanPreview,
} from '@/features/batch/lib';
import type { Row } from '@/features/batch/lib';
import { trapTab } from './dialogKeys';

export default function BatchPlanPreviewDialog() {
  useBatchVersion();
  const state = S.batchPlanPreviewState;
  if (!state) return null;
  return <PreviewPanel state={state} />;
}

/** Old openBatchPlanPreview's copy of the report: a read-only page for the paper. */
function readOnlyReportCopy(source: HTMLElement): HTMLElement {
  const page = source.cloneNode(true) as HTMLElement;
  page.removeAttribute('id');
  page.removeAttribute('aria-live');
  page.classList.add('batch-plan-preview-page');
  page.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  page.querySelectorAll('.report-edit-table').forEach((table) => {
    const heading = table.querySelector('thead tr');
    if (heading?.lastElementChild?.textContent?.trim() === 'Action') heading.lastElementChild.remove();
    table.querySelectorAll('.report-row-actions').forEach((element) => element.remove());
  });
  page
    .querySelectorAll('button,.report-floor-links,.manual-report-notice:not(.internal-change-notice),.print-note,.manual-row-label,.row-edit-label,.cc-mode-control')
    .forEach((element) => element.remove());
  // Inputs become their text (cloneNode keeps the values shown on the screen, as before).
  page.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select').forEach((element) => {
    const text = document.createElement('span');
    text.textContent =
      element.tagName === 'SELECT'
        ? Array.from(element.querySelectorAll('option')).find((option) => option.selected)?.textContent || element.value
        : element.value;
    element.replaceWith(text);
  });
  return page;
}

/** Old setBatchPlanPreviewZoom's DOM part: scales the copied page and sizes the paper to it. */
function applyPreviewZoom(paper: HTMLElement | null, width: number, scale: number): void {
  const page = paper?.firstElementChild as HTMLElement | null | undefined;
  if (!paper || !page) return;
  const height = Math.max(page.scrollHeight || 0, page.offsetHeight || 0, 1);
  page.style.transform = 'scale(' + scale + ')';
  paper.style.width = width * scale + 'px';
  paper.style.height = height * scale + 'px';
}

function PreviewPanel({ state }: { state: Row }) {
  useBatchVersion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scale = Number(state.scale) || 1;

  // Old fitBatchPlanPreview: the sizes it measured go to the engine; the viewport scrolls back to the start.
  const fit = useCallback((mode: string) => {
    const viewport = viewportRef.current,
      page = paperRef.current?.firstElementChild as HTMLElement | null;
    fitBatchPlanPreview(
      mode,
      viewport && page
        ? { viewportWidth: viewport.clientWidth, viewportHeight: viewport.clientHeight, pageHeight: page.scrollHeight || page.offsetHeight || 1 }
        : undefined
    );
    if (viewport) {
      viewport.scrollTop = 0;
      viewport.scrollLeft = 0;
    }
  }, []);

  // Opening: copy the report into the paper, set its width, fit the width and focus Close (old openBatchPlanPreview).
  useLayoutEffect(() => {
    const preview = S.batchPlanPreviewState,
      source = document.getElementById('reportContent'),
      paper = paperRef.current;
    if (!preview || !source || !paper) return;
    if (!preview.returnFocus) preview.returnFocus = document.activeElement;
    const page = readOnlyReportCopy(source);
    const widths = Array.from(source.querySelectorAll('table')).map((table) => table.scrollWidth || 0);
    const width = Math.max(1480, ...widths) + 48;
    page.style.width = width + 'px';
    preview.width = width;
    paper.replaceChildren(page);
    // The paper expands every table and section; only the outer viewport scrolls.
    const expandedWidth = Math.max(width, page.scrollWidth || 0);
    preview.width = expandedWidth;
    page.style.width = expandedWidth + 'px';
    fit('width');
    closeRef.current?.focus();
    return () => paper.replaceChildren();
  }, [fit]);

  // Old setBatchPlanPreviewZoom: the page is scaled and the paper takes the scaled size.
  useLayoutEffect(() => {
    applyPreviewZoom(paperRef.current, Number(S.batchPlanPreviewState?.width) || 0, scale);
  });

  // The fitted zoom follows the window size.
  useEffect(() => {
    const onResize = () => {
      const fitMode = S.batchPlanPreviewState?.fit;
      if (fitMode) fit(fitMode);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fit]);

  return (
    <div id="batchPlanPreviewDialog" className="batch-plan-preview-overlay" aria-hidden="false" ref={overlayRef}>
      <div
        className="batch-plan-preview-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batchPlanPreviewTitle"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeBatchPlanPreview();
            return;
          }
          trapTab(event, overlayRef.current, 'button,[tabindex="0"]');
        }}
      >
        <div className="batch-plan-preview-toolbar">
          <div>
            <h3 id="batchPlanPreviewTitle">Batch Plan · Full View</h3>
            <p id="batchPlanPreviewContext">
              {'Order ' + state.number + (state.floor ? ' · ' + floorLabel(state.floor) : '') + ' · Read-only view'}
            </p>
          </div>
          <div className="batch-plan-preview-controls" role="group" aria-label="Batch plan zoom controls">
            <button type="button" className="btn secondary" id="btnPreviewZoomOut" aria-label="Zoom out" disabled={scale <= 0.05} onClick={() => zoomBatchPlanPreview(-0.1)}>
              −
            </button>
            <output id="batchPlanPreviewZoom" aria-live="polite">
              {Math.round(scale * 100) + '%'}
            </output>
            <button type="button" className="btn secondary" id="btnPreviewZoomIn" aria-label="Zoom in" disabled={scale >= 2} onClick={() => zoomBatchPlanPreview(0.1)}>
              ＋
            </button>
            <button type="button" className="btn secondary" id="btnPreviewFitWidth" onClick={() => fit('width')}>
              Fit width
            </button>
            <button type="button" className="btn secondary" id="btnPreviewFitPage" onClick={() => fit('page')}>
              Fit page
            </button>
            <button type="button" className="btn secondary" id="btnPreviewActualSize" onClick={actualSizeBatchPlanPreview}>
              100%
            </button>
            <button type="button" className="btn" id="btnPreviewPrint" onClick={printBatchPlan}>
              Print / Save PDF
            </button>
            <button type="button" className="btn secondary" id="btnCloseBatchPlanPreview" ref={closeRef} onClick={() => closeBatchPlanPreview()}>
              Close ✕
            </button>
          </div>
        </div>
        <div
          id="batchPlanPreviewViewport"
          className="batch-plan-preview-viewport"
          tabIndex={0}
          aria-label="Full batch plan; scroll to view all rows and columns"
          ref={viewportRef}
        >
          <div id="batchPlanPreviewPaper" className="batch-plan-preview-paper" ref={paperRef} />
        </div>
      </div>
    </div>
  );
}
