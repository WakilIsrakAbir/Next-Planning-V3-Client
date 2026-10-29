'use client';

/* Read-only, zoomable full view of the report (old #batchPlanPreviewDialog), shown while
   S.batchPlanPreviewState is set. As the old openBatchPlanPreview did, the rendered #reportContent is copied
   into the paper as a read-only snapshot: edit controls, buttons and notes are removed, inputs become text,
   and the page is as wide as its widest table. Zoom, Fit width / Fit page and 100% never change the
   booking; Print keeps the saved-PDF layout. Escape closes; Tab stays inside. */
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  BatchApi,
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
import { cn } from '@/lib/cn';
import { button, type ButtonVariant } from '../ui/styles';
import { trapTab } from './dialogKeys';

/** A zoom bar button (old .batch-plan-preview-controls .btn; the browser's control font, Arial, as before). */
const controlButton = (variant: ButtonVariant) => cn(button(variant), 'px-2.5! py-[7px]! font-[Arial] text-[12px]!');

/* The copied page on the paper (old .batch-plan-preview-page.report): white paper scaled from its top left
   corner, which stays light paper in the dark theme. Every table wrap, section and heading row of the report
   is expanded, so only the outer viewport scrolls. */
const PREVIEW_PAGE =
  'absolute left-0 top-0 m-0 block h-auto max-h-none max-w-none origin-top-left overflow-visible rounded-none border-0 bg-white p-6 ' +
  'shadow-[0_2px_12px_#0f172a26] [color-scheme:light] dark:shadow-[0_2px_10px_rgba(0,0,0,0.45)] ' +
  '[&_[data-report-section]]:overflow-visible [&_[data-report-table-wrap]]:max-h-none [&_[data-report-table-wrap]]:overflow-visible [&_thead]:static';

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
  // The paper's look replaces the article's (old .batch-plan-preview-page.report); [data-preview-page] marks the copy.
  page.className = PREVIEW_PAGE;
  page.setAttribute('data-preview-page', '');
  page.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  // Editable tables lose their 'Action' heading; their row action cells carry [data-preview-strip].
  page.querySelectorAll('[data-report-edit-table]').forEach((table) => {
    const heading = table.querySelector('thead tr');
    if (heading?.lastElementChild?.textContent?.trim() === 'Action') heading.lastElementChild.remove();
  });
  // Buttons, floor links, edit notes and labels, the print note and the CC mode control are not copied.
  page.querySelectorAll('button,[data-preview-strip]').forEach((element) => element.remove());
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
    <div id="batchPlanPreviewDialog" className="fixed inset-0 z-[150] flex bg-[#dce4ed] p-3 dark:bg-[#0f1117] max-[700px]:p-0 print:hidden!" aria-hidden="false" ref={overlayRef}>
      <div
        className="flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg border border-solid border-[#bccbdb] bg-[#f1f5f9] shadow-[0_12px_45px_#0f172a33] dark:border-[#2a3346] dark:bg-[#151921] max-[700px]:rounded-none"
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
        <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-solid border-[#cbd5e1] bg-white px-4 py-3 dark:border-b-[#2a3346] dark:bg-[#181c25]">
          <div>
            <h3 id="batchPlanPreviewTitle" className="m-0 text-[16px] font-bold text-[#15395c] dark:text-[#f8fafc]">Batch Plan · Full View</h3>
            <p id="batchPlanPreviewContext" className="mx-0 mb-0 mt-1 text-[12px] text-[#64748b]">
              {'Order ' + state.number + (state.floor ? ' · ' + floorLabel(state.floor) : '') + ' · Read-only view'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-[7px]" role="group" aria-label="Batch plan zoom controls">
            <button type="button" className={controlButton('secondary')} id="btnPreviewZoomOut" aria-label="Zoom out" disabled={scale <= 0.05} onClick={() => zoomBatchPlanPreview(-0.1)}>
              −
            </button>
            <output id="batchPlanPreviewZoom" className="min-w-[45px] text-center text-[12px] font-bold text-[#23496b] dark:text-[#cbd5e1]" aria-live="polite">
              {Math.round(scale * 100) + '%'}
            </output>
            <button type="button" className={controlButton('secondary')} id="btnPreviewZoomIn" aria-label="Zoom in" disabled={scale >= 2} onClick={() => zoomBatchPlanPreview(0.1)}>
              ＋
            </button>
            <button type="button" className={controlButton('secondary')} id="btnPreviewFitWidth" onClick={() => fit('width')}>
              Fit width
            </button>
            <button type="button" className={controlButton('secondary')} id="btnPreviewFitPage" onClick={() => fit('page')}>
              Fit page
            </button>
            <button type="button" className={controlButton('secondary')} id="btnPreviewActualSize" onClick={actualSizeBatchPlanPreview}>
              100%
            </button>
            {BatchApi.has('downloads.batchPlanPrint') && (
              <button type="button" className={controlButton('primary')} id="btnPreviewPrint" onClick={printBatchPlan}>
                Print / Save PDF
              </button>
            )}
            <button type="button" className={controlButton('secondary')} id="btnCloseBatchPlanPreview" ref={closeRef} onClick={() => closeBatchPlanPreview()}>
              Close ✕
            </button>
          </div>
        </div>
        <div
          id="batchPlanPreviewViewport"
          className="min-h-0 flex-1 overflow-auto overscroll-contain p-6"
          tabIndex={0}
          aria-label="Full batch plan; scroll to view all rows and columns"
          ref={viewportRef}
        >
          <div id="batchPlanPreviewPaper" className="relative mx-auto my-0 overflow-hidden shadow-[0_2px_12px_#0f172a26]" ref={paperRef} />
        </div>
      </div>
    </div>
  );
}
