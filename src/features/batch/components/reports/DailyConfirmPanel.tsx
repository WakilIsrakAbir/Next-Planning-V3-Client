'use client';

/* Daily Confirm Batch Plan panel (old #dailyConfirmPanel, renderDailyConfirmReport), drawn from
   S.dailyConfirmResult. Print styles: body.printing-daily-confirm. */
import React from 'react';
import {
  DAILY_CONFIRM_HEADERS,
  S,
  dailyConfirmCells,
  downloadDailyConfirmReport,
  dyeablePrintedAt,
  floorLabel,
  openDailyConfirmFilters,
  printDailyConfirmReport,
  useBatchVersion,
} from '@/features/batch/engine';
import type { Row } from '@/features/batch/engine';

/** Old esc(value) without the HTML escaping (React escapes text). */
const text = (value: unknown): string => String(value ?? '');

export default function DailyConfirmPanel({ hidden }: { hidden: boolean }) {
  useBatchVersion();
  const result = S.dailyConfirmResult;
  const rows = (result?.rows || []) as Row[];
  const f = result?.filters as Row | undefined;
  const legacy = rows.filter((row) => row.legacy).length;
  return (
    <div id="dailyConfirmPanel" className={'card' + (hidden ? ' hidden' : '')}>
      <div className="dyeable-report-toolbar">
        <div>
          <h2>Daily Confirm Batch Plan</h2>
          <p id="dailyConfirmCount">{result ? rows.length + ' confirmed batch plan(s)' : ''}</p>
        </div>
        <div className="btn-group-actions">
          <button id="btnDailyConfirmFilters" className="btn secondary" onClick={() => openDailyConfirmFilters()}>
            Change Filters / Refresh
          </button>
          <button id="dailyConfirmExport" className="btn success" disabled={!!result && !rows.length} onClick={() => void downloadDailyConfirmReport()}>
            Download Excel
          </button>
          <button id="dailyConfirmPrint" className="btn" onClick={() => printDailyConfirmReport()}>
            Print / Save PDF
          </button>
        </div>
      </div>
      <p id="dailyConfirmCriteria" className="dyeable-filter-summary">
        {f
          ? 'From ' +
            f.from +
            ' to ' +
            f.to +
            ' · ' +
            (f.route === 'Both' ? 'Both' : f.route + ' to Confirm') +
            ' · ' +
            (f.floor === 'All' ? 'All floors' : floorLabel(f.floor)) +
            ' · ' +
            (f.buyer === 'All' ? 'All buyers' : f.buyer)
          : ''}
      </p>
      <div id="dailyConfirmTable" className="freeze-pane">
        {result && (
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  {DAILY_CONFIRM_HEADERS.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row, index) => (
                    <tr key={index}>
                      {dailyConfirmCells(row).map((value, cell) => (
                        <td key={cell}>{text(value || '—')}</td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>No confirmed batch plans match these filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p id="dailyConfirmNotes" className="component-note">
        {legacy
          ? legacy +
            ' older record(s): original confirmation route was not recorded. These appear only under Both; the last saved date is used where the original confirmation date is unavailable.'
          : ''}
      </p>
      <p id="dailyConfirmAsOf" className="component-note">
        {result ? 'Preview: ' + dyeablePrintedAt(result.generatedAt) : ''}
      </p>
    </div>
  );
}
