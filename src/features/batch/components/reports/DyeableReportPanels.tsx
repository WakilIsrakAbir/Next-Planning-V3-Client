'use client';

/* Dyeable Batch panels of the old #reportsView: the intro (#dyeableReportEmpty), the Dyeable Batch preview
   (#dyeableReportPanel, old renderDyeableReport) and the Dyeable Batch Summary (#dyeableSummaryPanel, old
   renderDyeableSummary). They are drawn from S.dyeableReportResult / S.dyeableSummaryResult.
   Printing the Summary (body.printing-dyeable-summary) shows only its paper. */
import React, { memo, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { cn } from '@/lib/cn';
import {
  BatchApi,
  DYEABLE_FLOOR_LABELS,
  DYEABLE_SUMMARY_CRITERIA,
  S,
  buildDyeableSummary,
  downloadDyeableReport,
  dyeableFilterSummary,
  dyeableFloorTotalLabel,
  dyeablePrintedAt,
  dyeableReportHeaders,
  dyeableSummaryQuantity,
  emptyDyeableSummaryCells,
  floorLabel,
  kgText,
  lastSaveDisplay,
  openDailyConfirmFilters,
  openDyeableFilters,
  printDyeableSummary,
  productionSum,
  useBatchVersion,
} from '@/features/batch/lib';
import type { DyeableSummaryCell, Row } from '@/features/batch/lib';
import KnittingBadge from '@/features/batch/components/plan/report/KnittingBadge';
import { button, card, controlFont } from '../ui/styles';

/** Old esc(value) without the HTML escaping (React escapes text). */
const text = (value: unknown): string => String(value ?? '');

/* Report toolbar, title, count line and button group (old `.dyeable-report-toolbar`, its h2 / p, `.btn-group-actions`). */
const TOOLBAR = 'flex flex-wrap items-center justify-between gap-3.5 px-5 py-[18px]';
const TOOLBAR_TITLE = 'm-0 text-[18px] font-bold text-[#173756] dark:text-[#f8fafc]';
const TOOLBAR_TEXT = 'mx-0 mb-0 mt-[7px] text-[12px] text-[#475569] dark:text-[#94a3b8]';
const BUTTON_GROUP = 'flex flex-wrap gap-2';
/** Grey report note (old `.dyeable-report-note`). */
const NOTE = 'mx-[18px] mb-3.5 mt-2 text-[11.5px] leading-[1.6] text-[#64748b]';
/** Hidden while the Summary prints. */
const NOT_IN_SUMMARY_PRINT = 'print:[body.printing-dyeable-summary_&]:hidden!';

/* Dyeable Batch table (old `.dyeable-table`, in a `.freeze-pane` with a frozen heading). Even rows keep their
   stripe on hover (old `.dyeable-table tbody tr:nth-child(even)` outranked `tbody tr:hover`). */
const DYEABLE_CELL =
  'border-r border-b border-solid border-[#d6e3ef] px-2 py-[9px] text-left align-middle [overflow-wrap:anywhere] dark:border-[#1e2536]';
const DYEABLE_TH =
  DYEABLE_CELL +
  ' bg-[#e4eef8] font-bold leading-[1.4] text-[#173756] shadow-[0_1px_0_#c9d8e8] dark:bg-[#151921] dark:text-[#cbd5e1] dark:shadow-[0_1px_0_#2a3346]';
const DYEABLE_NUMERIC = DYEABLE_CELL + ' text-right tabular-nums';
const DYEABLE_ROW = 'even:bg-batch-row-alt odd:hover:bg-[#edf4fc] dark:odd:hover:bg-[rgba(16,185,129,0.08)]';

/* Summary paper table (old `.dyeable-summary-table`); smaller when printed. */
const SUMMARY_CELL =
  'border border-solid border-[#d0d0d0] px-[7px] py-1.5 text-left leading-[1.3] [overflow-wrap:anywhere] ' +
  'print:[body.printing-dyeable-summary_&]:px-[5px] print:[body.printing-dyeable-summary_&]:py-1';
const SUMMARY_HEAD = SUMMARY_CELL + ' text-center! font-bold';
const SUMMARY_NUMBER = SUMMARY_CELL + ' text-right! tabular-nums';
/** Body rows are striped like every Batch table (old `tbody tr:nth-child(even)`, `:hover`); print keeps the light stripe. */
const SUMMARY_ROW = 'even:bg-batch-row-alt hover:bg-[#edf4fc] dark:hover:bg-[rgba(16,185,129,0.08)] print:even:bg-[#f8fbfe]';
const CATEGORY_BG = ['bg-[#92d050]', 'bg-[#ffc000]', 'bg-[#ed7d31]'];

export function DyeableReportEmpty({ hidden }: { hidden: boolean }) {
  return (
    <div id="dyeableReportEmpty" className={cn(card, 'p-[26px]', hidden && 'hidden', NOT_IN_SUMMARY_PRINT)}>
      <h2 className={TOOLBAR_TITLE}>Dyeable Batch</h2>
      <p className="mx-0 mb-[18px] mt-2.5 text-[13px] text-[#64748b]">Preview confirmed Colour &amp; Batch Info with the latest knitting production status.</p>
      <button className={cn(button('primary'), controlFont)} id="btnDyeableOpen" onClick={() => openDyeableFilters('detail')}>
        Dyeable Batch · Filters &amp; Preview
      </button>{' '}
      <button className={cn(button('secondary'), controlFont)} id="btnDyeableSummaryOpen" onClick={() => openDyeableFilters('summary')}>
        Dyeable Batch Summary
      </button>{' '}
      <button className={cn(button('secondary'), controlFont)} id="btnDailyConfirmOpen" onClick={() => openDailyConfirmFilters()}>
        Daily Confirm Batch Plan
      </button>
    </div>
  );
}

/** The preview table (drawn again only when the result changes; it can hold many rows). */
const DyeableTable = memo(function DyeableTable({ result }: { result: Row }) {
  const count: number = result.fabricCount,
    headers = dyeableReportHeaders(count);
  const widths = [130, 145, 120, 145, 150, ...Array.from({ length: count }, () => 90), 125, 240, 205, 85, 90, 150];
  const rows = result.rows as Row[];
  return (
    <table
      className="w-full table-fixed border-separate border-spacing-0 bg-white text-[12px] dark:bg-[#181c25]"
      style={{ minWidth: widths.reduce((a, b) => a + b, 0) + 'px' }}
    >
      <colgroup>
        {widths.map((width, index) => (
          <col key={index} style={{ width: width + 'px' }} />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-[3] bg-[#f1f6fb] dark:bg-[#151921] dark:text-[#cbd5e1] print:static">
        <tr>
          {headers.map((header, index) => (
            <th key={index} className={DYEABLE_TH}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={DYEABLE_ROW}>
              <td
                className={DYEABLE_CELL}
                title={'Order ' + row.number + ' · ' + (row.floor ? DYEABLE_FLOOR_LABELS[row.floor] || floorLabel(row.floor) : 'All floors') + ' · ' + row.revision}
              >
                <strong className="font-bold">{text(row.id)}</strong>
              </td>
              <td className={DYEABLE_CELL}>{text(row.shade)}</td>
              <td className={DYEABLE_CELL}>{text(row.ld)}</td>
              <td className={DYEABLE_CELL}>{text(row.reference)}</td>
              <td className={DYEABLE_CELL}>{text(row.buyer)}</td>
              {Array.from({ length: count }, (_, index) => {
                const fabric = row.fabrics[index],
                  quantity = fabric?.quantity;
                return (
                  <td key={index} className={DYEABLE_NUMERIC} title={fabric ? fabric.type + (fabric.gsm ? ' · GSM ' + fabric.gsm : '') : ''}>
                    {quantity === null ? 'Weight missing' : quantity ? kgText(quantity) : ''}
                  </td>
                );
              })}
              <td className={DYEABLE_NUMERIC}>{row.totalKg === null ? 'Weight missing' : kgText(row.totalKg)}</td>
              <td className={DYEABLE_CELL}>{text(row.fabrication)}</td>
              <td className={DYEABLE_CELL}>
                <KnittingBadge state={row.knit} summary />
              </td>
              <td className={DYEABLE_NUMERIC}>{text(row.loading || 'Not available')}</td>
              <td className={DYEABLE_NUMERIC}>{text(row.nozzle || 'Not available')}</td>
              <td
                className={DYEABLE_CELL}
                title={text(
                  row.machineNote ||
                    (row.machineRecovered ? 'Recovered from saved machine details.' : row.machine ? 'Saved machine assignment.' : 'No saved machine assignment.')
                )}
              >
                {text(row.machine || 'Not assigned')}
              </td>
            </tr>
          ))
        ) : (
          <tr className={DYEABLE_ROW}>
            <td colSpan={headers.length} className={cn(DYEABLE_CELL, 'p-8! text-center! text-[#64748b]')}>
              No confirmed batches match these filters.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
});

export function DyeableReportPanel({ hidden }: { hidden: boolean }) {
  useBatchVersion();
  const result = S.dyeableReportResult;
  const rows = (result?.rows || []) as Row[];
  let countText = '',
    warnings: string[] = [];
  if (result) {
    const total = productionSum(rows.map((row) => row.totalKg || 0)),
      missing = rows.filter((row) => row.totalKg === null).length;
    countText =
      rows.length +
      ' batches · ' +
      new Set(rows.map((row) => row.number)).size +
      ' orders · ' +
      kgText(total) +
      ' kg' +
      (missing ? ' + ' + missing + ' batch weight(s) missing' : '');
    warnings = (result.warnings as string[]).slice();
    const unassigned = rows.filter((row) => !row.machine).length;
    if (unassigned)
      warnings.push(
        unassigned +
          ' batch(es) have no saved machine assignment. MC Number is shown as Not assigned; unavailable loading/nozzle values are labelled Not available.'
      );
  }
  return (
    <div id="dyeableReportPanel" className={cn(card, 'min-h-0 flex-1 flex-col', hidden ? 'hidden' : 'flex', NOT_IN_SUMMARY_PRINT)}>
      <div className={TOOLBAR}>
        <div>
          <h2 className={TOOLBAR_TITLE}>Dyeable Batch</h2>
          <p id="dyeableReportCount" className={TOOLBAR_TEXT}>
            {countText}
          </p>
        </div>
        <div className={BUTTON_GROUP}>
          <button className={cn(button('secondary'), controlFont)} id="btnDyeableFilters" onClick={() => openDyeableFilters('detail')}>
            Change Filters / Refresh
          </button>
          {BatchApi.has('downloads.dyeableExcel') && (
            <button
              className={cn(button('success'), controlFont)}
              id="btnDownloadDyeable"
              disabled={!rows.length || S.dyeableExportBusy}
              onClick={() => void downloadDyeableReport('detail')}
            >
              Download Excel
            </button>
          )}
        </div>
      </div>
      <p
        id="dyeableReportFilterSummary"
        className="m-0 flex-none border-y border-solid border-[#d6e3ef] bg-[#edf5fc] px-5 py-2.5 text-[12px] leading-[1.6] text-[#315571] dark:border-[#1e2536] dark:bg-[#151921] dark:text-[#94a3b8]"
      >
        {result ? dyeableFilterSummary(result.filters) : ''}
      </p>
      <p
        id="dyeableReportWarnings"
        className={cn(
          'mb-3 mt-2 rounded-[5px] border border-solid border-[#fed7aa] bg-[#fff7ed] px-3 py-[9px] text-[12px] text-[#9a3412]',
          'dark:border-[rgba(245,158,11,0.35)] dark:bg-[rgba(245,158,11,0.1)] dark:text-[#fdba74]',
          !warnings.length && 'hidden'
        )}
      >
        {warnings.join(' ')}
      </p>
      {/* Frozen heading while the table scrolls (old `.freeze-pane`); it fills the panel. */}
      <div
        id="dyeableReportTable"
        className="relative min-h-[90px] flex-1 overflow-auto overscroll-contain border-b border-solid border-[#d6e3ef] dark:border-[#1e2536] print:overflow-visible"
        tabIndex={0}
        aria-label="Dyeable Batch report"
      >
        {result && <DyeableTable result={result} />}
      </div>
      <div className="flex flex-wrap justify-between gap-2.5 px-[18px] py-2.5 text-[11px] text-[#64748b]">
        <span id="dyeableReportAsOf">{result ? 'Preview: ' + lastSaveDisplay(result.generatedAt) : ''}</span>
        <span id="dyeableExportStatus" role="status">
          {text(S.ui.reportsExportStatus)}
        </span>
      </div>
      <p className={NOTE}>
        Knit Status is allocated in saved batch order before filtering. “Not Knit ok” includes missing production or fabric quantities. Fabric
        numbers follow each order’s Fabric Info; hover over a quantity for its fabric and GSM.
      </p>
    </div>
  );
}

function SummaryCells({ cells }: { cells: DyeableSummaryCell[] }) {
  return (
    <>
      {cells.map((cell, index) => (
        <React.Fragment key={index}>
          <td className={SUMMARY_NUMBER}>{cell.count}</td>
          <td className={SUMMARY_NUMBER}>{text(dyeableSummaryQuantity(cell))}</td>
        </React.Fragment>
      ))}
    </>
  );
}

export function DyeableSummaryPanel({ hidden }: { hidden: boolean }) {
  useBatchVersion();
  const result = S.dyeableSummaryResult;
  const summary = useMemo(() => (result ? buildDyeableSummary(result) : null), [result]);
  const notes: string[] = result ? (result.warnings as string[]).slice() : [];
  if (summary?.excluded) notes.push(summary.excluded + ' batch(es) have both knitting and labdip pending and fall outside the three displayed criteria.');
  const printedAt = (S.ui.reportsSummaryPrintedAt as string | null | undefined) || result?.generatedAt;
  const canExport = BatchApi.has('downloads.dyeableSummaryExcel');
  return (
    <div
      id="dyeableSummaryPanel"
      className={cn(
        card,
        'min-h-0 flex-1 flex-col',
        hidden ? 'hidden' : 'flex',
        'print:bg-white print:[body.printing-dyeable-summary_&]:block! print:[body.printing-dyeable-summary_&]:m-0 print:[body.printing-dyeable-summary_&]:h-auto',
        'print:[body.printing-dyeable-summary_&]:min-h-0 print:[body.printing-dyeable-summary_&]:overflow-visible',
        'print:[body.printing-dyeable-summary_&]:border-0 print:[body.printing-dyeable-summary_&]:shadow-none'
      )}
    >
      <div className={cn(TOOLBAR, 'print:[body.printing-dyeable-summary_&]:hidden!')}>
        <h2 className={TOOLBAR_TITLE}>Dyeable Batch Summary</h2>
        <div className={BUTTON_GROUP}>
          <button className={cn(button('secondary'), controlFont)} id="btnDyeableSummaryFilters" onClick={() => openDyeableFilters('summary')}>
            Change Filters / Refresh
          </button>
          {canExport && (
            <button
              className={cn(button('success'), controlFont)}
              id="btnDownloadDyeableSummary"
              disabled={S.dyeableExportBusy}
              onClick={() => void downloadDyeableReport('summary')}
            >
              Download Excel
            </button>
          )}
          {canExport && (
            <button className={cn(button('primary'), controlFont)} id="btnPrintDyeableSummary" onClick={() => printDyeableSummary(flushSync)}>
              Print / Save PDF
            </button>
          )}
        </div>
      </div>
      <div
        className={cn(
          'min-h-0 flex-1 overflow-auto bg-[#edf2f7] p-4 dark:bg-[#0f1117]',
          'print:[body.printing-dyeable-summary_&]:block print:[body.printing-dyeable-summary_&]:overflow-visible',
          'print:[body.printing-dyeable-summary_&]:bg-white print:[body.printing-dyeable-summary_&]:p-0'
        )}
      >
        {/* White paper, also in the dark theme. */}
        <article
          id="dyeableSummaryPaper"
          className={cn(
            'min-w-[820px] border border-solid border-[#bdcbd8] bg-white px-0 pb-3.5 pt-0 shadow-[0_2px_9px_#0f172a12] dark:[color-scheme:light]',
            'print:[body.printing-dyeable-summary_&]:w-full print:[body.printing-dyeable-summary_&]:min-w-0',
            'print:[body.printing-dyeable-summary_&]:border-0 print:[body.printing-dyeable-summary_&]:p-0 print:[body.printing-dyeable-summary_&]:shadow-none'
          )}
        >
          <h2
            className={cn(
              'm-0 border border-solid border-[#1f2937] bg-[#bfe6f1] px-3 py-2.5 text-center text-[25px] font-bold leading-[1.25] text-black',
              'print:[body.printing-dyeable-summary_&]:p-[7px] print:[body.printing-dyeable-summary_&]:text-[20px]'
            )}
          >
            Dyeable Live Batch Status
          </h2>
          <p id="dyeableSummaryCriteria" className="m-0 border-b border-solid border-[#d7dfe7] px-3 py-2 text-[11px] leading-[1.6] text-[#475569]">
            {result ? dyeableFilterSummary(result.filters) : ''}
          </p>
          <div id="dyeableSummaryTable">
            {summary && (
              <table className="w-full table-fixed border-collapse bg-white text-[12px] text-black print:[body.printing-dyeable-summary_&]:text-[10px]">
                <colgroup>
                  <col className="w-[13%]" />
                  <col className="w-[21%]" />
                  {Array.from({ length: 6 }, (_, index) => (
                    <col key={index} className="w-[11%]" />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th colSpan={2} className={cn(SUMMARY_CELL, 'bg-white font-bold')}>
                      Criteria
                    </th>
                    {DYEABLE_SUMMARY_CRITERIA.map((label, index) => (
                      <th key={index} colSpan={2} className={cn(SUMMARY_HEAD, CATEGORY_BG[index])}>
                        {label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className={cn(SUMMARY_HEAD, 'bg-[#dcefd2]')}>Floor</th>
                    <th className={cn(SUMMARY_HEAD, 'bg-[#dcefd2]')}>Buyer</th>
                    {Array.from({ length: 3 }, (_, index) => (
                      <React.Fragment key={index}>
                        <th className={cn(SUMMARY_HEAD, 'bg-[#dcefd2]')}>No of Batch</th>
                        <th className={cn(SUMMARY_HEAD, 'bg-[#dcefd2]')}>Dyeable qty (kg)</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.floors.length ? (
                    summary.floors.map((floor, floorIndex) => {
                      const buyers: Row[] = floor.buyers.length ? floor.buyers : [{ buyer: '—', cells: emptyDyeableSummaryCells() }];
                      return (
                        <React.Fragment key={floorIndex}>
                          {buyers.map((buyer, index) => (
                            <tr key={index} className={SUMMARY_ROW}>
                              {index === 0 && (
                                <td className={cn(SUMMARY_CELL, 'text-center! align-middle text-[14px]')} rowSpan={buyers.length}>
                                  {text(floor.label)}
                                </td>
                              )}
                              <td className={SUMMARY_CELL}>{text(buyer.buyer)}</td>
                              <SummaryCells cells={buyer.cells} />
                            </tr>
                          ))}
                          {/* Floor total row (old `.summary-floor-total th, td`). */}
                          <tr className={cn(SUMMARY_ROW, '[&>*]:bg-[#fbe3d6] [&>*]:font-bold')}>
                            <th colSpan={2} className={SUMMARY_CELL}>
                              {dyeableFloorTotalLabel(floor)}
                            </th>
                            <SummaryCells cells={floor.totals} />
                          </tr>
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr className={SUMMARY_ROW}>
                      <td colSpan={8} className={SUMMARY_CELL}>
                        No floors selected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <p id="dyeableSummaryNotes" className={cn('mx-2.5 mb-0 mt-3 text-[11px] leading-[1.6] text-[#64748b]', !notes.length && 'hidden')}>
            {notes.join(' ')}
          </p>
          <footer
            className={cn(
              'flex items-end justify-between gap-4 px-2 pb-0 pt-6 text-[11px] text-black',
              'print:[body.printing-dyeable-summary_&]:break-inside-avoid print:[body.printing-dyeable-summary_&]:text-[10px]'
            )}
          >
            <span id="dyeableSummaryTimestamp">{printedAt ? 'Printed Date & Time: ' + dyeablePrintedAt(printedAt) : ''}</span>
            <span>This is the PMC internal ERP System Generated Report</span>
          </footer>
        </article>
      </div>
      <p id="dyeableSummaryExportStatus" className={cn(NOTE, 'print:[body.printing-dyeable-summary_&]:hidden!')} role="status">
        {text(S.ui.reportsSummaryExportStatus)}
      </p>
    </div>
  );
}
