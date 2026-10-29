'use client';

/* Dyeable Batch panels of the old #reportsView: the intro (#dyeableReportEmpty), the Dyeable Batch preview
   (#dyeableReportPanel, old renderDyeableReport) and the Dyeable Batch Summary (#dyeableSummaryPanel, old
   renderDyeableSummary). They are drawn from S.dyeableReportResult / S.dyeableSummaryResult. */
import React, { memo, useMemo } from 'react';
import { flushSync } from 'react-dom';
import {
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
} from '@/features/batch/engine';
import type { DyeableSummaryCell, Row } from '@/features/batch/engine';
import KnittingBadge from '@/features/batch/components/plan/report/KnittingBadge';

/** Old esc(value) without the HTML escaping (React escapes text). */
const text = (value: unknown): string => String(value ?? '');

export function DyeableReportEmpty({ hidden }: { hidden: boolean }) {
  return (
    <div id="dyeableReportEmpty" className={'card dyeable-report-intro' + (hidden ? ' hidden' : '')}>
      <h2>Dyeable Batch</h2>
      <p>Preview confirmed Colour &amp; Batch Info with the latest knitting production status.</p>
      <button className="btn" id="btnDyeableOpen" onClick={() => openDyeableFilters('detail')}>
        Dyeable Batch · Filters &amp; Preview
      </button>{' '}
      <button className="btn secondary" id="btnDyeableSummaryOpen" onClick={() => openDyeableFilters('summary')}>
        Dyeable Batch Summary
      </button>{' '}
      <button className="btn secondary" id="btnDailyConfirmOpen" onClick={() => openDailyConfirmFilters()}>
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
    <table className="dyeable-table" style={{ minWidth: widths.reduce((a, b) => a + b, 0) + 'px' }}>
      <colgroup>
        {widths.map((width, index) => (
          <col key={index} style={{ width: width + 'px' }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={index}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td title={'Order ' + row.number + ' · ' + (row.floor ? DYEABLE_FLOOR_LABELS[row.floor] || floorLabel(row.floor) : 'All floors') + ' · ' + row.revision}>
                <strong>{text(row.id)}</strong>
              </td>
              <td>{text(row.shade)}</td>
              <td>{text(row.ld)}</td>
              <td>{text(row.reference)}</td>
              <td>{text(row.buyer)}</td>
              {Array.from({ length: count }, (_, index) => {
                const fabric = row.fabrics[index],
                  quantity = fabric?.quantity;
                return (
                  <td key={index} className="dyeable-numeric" title={fabric ? fabric.type + (fabric.gsm ? ' · GSM ' + fabric.gsm : '') : ''}>
                    {quantity === null ? 'Weight missing' : quantity ? kgText(quantity) : ''}
                  </td>
                );
              })}
              <td className="dyeable-numeric">{row.totalKg === null ? 'Weight missing' : kgText(row.totalKg)}</td>
              <td>{text(row.fabrication)}</td>
              <td>
                <KnittingBadge state={row.knit} summary />
              </td>
              <td className="dyeable-numeric">{text(row.loading || 'Not available')}</td>
              <td className="dyeable-numeric">{text(row.nozzle || 'Not available')}</td>
              <td
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
          <tr>
            <td colSpan={headers.length} className="dyeable-empty-cell">
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
    <div id="dyeableReportPanel" className={'card dyeable-report-panel' + (hidden ? ' hidden' : '')}>
      <div className="dyeable-report-toolbar">
        <div>
          <h2>Dyeable Batch</h2>
          <p id="dyeableReportCount">{countText}</p>
        </div>
        <div className="btn-group-actions">
          <button className="btn secondary" id="btnDyeableFilters" onClick={() => openDyeableFilters('detail')}>
            Change Filters / Refresh
          </button>
          <button
            className="btn success"
            id="btnDownloadDyeable"
            disabled={!rows.length || S.dyeableExportBusy}
            onClick={() => void downloadDyeableReport('detail')}
          >
            Download Excel
          </button>
        </div>
      </div>
      <p id="dyeableReportFilterSummary" className="dyeable-filter-summary">
        {result ? dyeableFilterSummary(result.filters) : ''}
      </p>
      <p id="dyeableReportWarnings" className={'batch-calculation-note' + (warnings.length ? '' : ' hidden')}>
        {warnings.join(' ')}
      </p>
      <div id="dyeableReportTable" className="freeze-pane" tabIndex={0} aria-label="Dyeable Batch report">
        {result && <DyeableTable result={result} />}
      </div>
      <div className="dyeable-report-footer">
        <span id="dyeableReportAsOf">{result ? 'Preview: ' + lastSaveDisplay(result.generatedAt) : ''}</span>
        <span id="dyeableExportStatus" role="status">
          {text(S.ui.reportsExportStatus)}
        </span>
      </div>
      <p className="dyeable-report-note">
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
          <td className="summary-number">{cell.count}</td>
          <td className="summary-number">{text(dyeableSummaryQuantity(cell))}</td>
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
  return (
    <div id="dyeableSummaryPanel" className={'card dyeable-summary-panel' + (hidden ? ' hidden' : '')}>
      <div className="dyeable-report-toolbar">
        <h2>Dyeable Batch Summary</h2>
        <div className="btn-group-actions">
          <button className="btn secondary" id="btnDyeableSummaryFilters" onClick={() => openDyeableFilters('summary')}>
            Change Filters / Refresh
          </button>
          <button className="btn success" id="btnDownloadDyeableSummary" disabled={S.dyeableExportBusy} onClick={() => void downloadDyeableReport('summary')}>
            Download Excel
          </button>
          <button className="btn" id="btnPrintDyeableSummary" onClick={() => printDyeableSummary(flushSync)}>
            Print / Save PDF
          </button>
        </div>
      </div>
      <div className="dyeable-summary-scroll">
        <article id="dyeableSummaryPaper">
          <h2>Dyeable Live Batch Status</h2>
          <p id="dyeableSummaryCriteria" className="summary-filter-line">
            {result ? dyeableFilterSummary(result.filters) : ''}
          </p>
          <div id="dyeableSummaryTable">
            {summary && (
              <table className="dyeable-summary-table">
                <colgroup>
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '21%' }} />
                  {Array.from({ length: 6 }, (_, index) => (
                    <col key={index} style={{ width: '11%' }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th colSpan={2} className="summary-criteria">
                      Criteria
                    </th>
                    {DYEABLE_SUMMARY_CRITERIA.map((label, index) => (
                      <th key={index} colSpan={2} className={'summary-category-' + index}>
                        {label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th>Floor</th>
                    <th>Buyer</th>
                    {Array.from({ length: 3 }, (_, index) => (
                      <React.Fragment key={index}>
                        <th>No of Batch</th>
                        <th>Dyeable qty (kg)</th>
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
                            <tr key={index}>
                              {index === 0 && (
                                <td className="summary-floor" rowSpan={buyers.length}>
                                  {text(floor.label)}
                                </td>
                              )}
                              <td>{text(buyer.buyer)}</td>
                              <SummaryCells cells={buyer.cells} />
                            </tr>
                          ))}
                          <tr className="summary-floor-total">
                            <th colSpan={2}>{dyeableFloorTotalLabel(floor)}</th>
                            <SummaryCells cells={floor.totals} />
                          </tr>
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8}>No floors selected.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <p id="dyeableSummaryNotes" className={'dyeable-report-note' + (notes.length ? '' : ' hidden')}>
            {notes.join(' ')}
          </p>
          <footer className="summary-footer">
            <span id="dyeableSummaryTimestamp">{printedAt ? 'Printed Date & Time: ' + dyeablePrintedAt(printedAt) : ''}</span>
            <span>This is the PMC internal ERP System Generated Report</span>
          </footer>
        </article>
      </div>
      <p id="dyeableSummaryExportStatus" className="dyeable-report-note" role="status">
        {text(S.ui.reportsSummaryExportStatus)}
      </p>
    </div>
  );
}
