'use client';

/* Daily Confirm Batch Plan panel (old #dailyConfirmPanel, renderDailyConfirmReport), drawn from
   S.dailyConfirmResult. Printing it (body.printing-daily-confirm) shows only this panel, without its buttons,
   on light paper also in the dark theme. */
import React from 'react';
import { cn } from '@/lib/cn';
import {
  BatchApi,
  DAILY_CONFIRM_HEADERS,
  S,
  dailyConfirmCells,
  downloadDailyConfirmReport,
  dyeablePrintedAt,
  floorLabel,
  openDailyConfirmFilters,
  printDailyConfirmReport,
  useBatchVersion,
} from '@/features/batch/lib';
import type { Row } from '@/features/batch/lib';
import { button, card, controlFont, tableWrap } from '../ui/styles';

/** Old esc(value) without the HTML escaping (React escapes text). */
const text = (value: unknown): string => String(value ?? '');

/** Grey note (old `.component-note`). */
const NOTE = 'my-[7px] text-[11px] text-[#64748b]';
/* The table had no table rules of its own: browser-default cells in a frozen-heading pane (old `.freeze-pane`). */
const TH =
  'p-px text-center font-bold shadow-[0_1px_0_#c9d8e8] dark:bg-[#151921] dark:text-[#cbd5e1] dark:shadow-[0_1px_0_#2a3346] ' +
  'print:bg-transparent print:text-inherit print:shadow-[0_1px_0_#c9d8e8]';
const TD = 'p-px';
/** Striped rows like every Batch table (old `tbody tr:nth-child(even)`, `:hover`); print keeps the light stripe. */
const ROW = 'even:bg-batch-row-alt hover:bg-[#edf4fc] dark:hover:bg-[rgba(16,185,129,0.08)] print:even:bg-[#f8fbfe]';

export default function DailyConfirmPanel({ hidden }: { hidden: boolean }) {
  useBatchVersion();
  const result = S.dailyConfirmResult;
  const rows = (result?.rows || []) as Row[];
  const f = result?.filters as Row | undefined;
  const legacy = rows.filter((row) => row.legacy).length;
  return (
    <div
      id="dailyConfirmPanel"
      className={cn(
        card,
        hidden && 'hidden',
        // Printed on white paper with black text (old `.batch-app{background:white;color:black}` in print).
        'print:bg-white print:text-black print:[body.printing-daily-confirm_&]:block! print:[body.printing-daily-confirm_&]:border-0',
        'print:[body.printing-daily-confirm_&]:shadow-none'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3.5 px-5 py-[18px]">
        <div>
          <h2 className="m-0 text-[18px] font-bold text-[#173756] dark:text-[#f8fafc] print:text-[#173756]">Daily Confirm Batch Plan</h2>
          <p id="dailyConfirmCount" className="mx-0 mb-0 mt-[7px] text-[12px] text-[#475569] dark:text-[#94a3b8] print:text-[#475569]">
            {result ? rows.length + ' confirmed batch plan(s)' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:[body.printing-daily-confirm_&]:hidden!">
          <button id="btnDailyConfirmFilters" className={cn(button('secondary'), controlFont)} onClick={() => openDailyConfirmFilters()}>
            Change Filters / Refresh
          </button>
          {BatchApi.has('downloads.dailyConfirmExcel') && (
            <button
              id="dailyConfirmExport"
              className={cn(button('success'), controlFont)}
              disabled={!!result && !rows.length}
              onClick={() => void downloadDailyConfirmReport()}
            >
              Download Excel
            </button>
          )}
          {BatchApi.has('downloads.dailyConfirmExcel') && (
            <button id="dailyConfirmPrint" className={cn(button('primary'), controlFont)} onClick={() => printDailyConfirmReport()}>
              Print / Save PDF
            </button>
          )}
        </div>
      </div>
      <p
        id="dailyConfirmCriteria"
        className={cn(
          'm-0 flex-none border-y border-solid border-[#d6e3ef] bg-[#edf5fc] px-5 py-2.5 text-[12px] leading-[1.6] text-[#315571]',
          'dark:border-[#1e2536] dark:bg-[#151921] dark:text-[#94a3b8] print:border-[#d6e3ef] print:bg-[#edf5fc] print:text-[#315571]'
        )}
      >
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
      <div
        id="dailyConfirmTable"
        className="relative max-h-[calc(var(--batch-vh,1vh)*60)] overflow-auto overscroll-contain print:max-h-none print:overflow-visible"
      >
        {result && (
          <div className={tableWrap}>
            <table className={cn(
                'border-separate border-spacing-0',
                'print:[body.printing-daily-confirm_&]:w-full print:[body.printing-daily-confirm_&]:min-w-0 print:[body.printing-daily-confirm_&]:text-[10px]'
              )}>
              <thead className="sticky top-0 z-[3] bg-[#f1f6fb] dark:bg-[#151921] dark:text-[#cbd5e1] print:static print:bg-[#f1f6fb] print:text-inherit">
                <tr>
                  {DAILY_CONFIRM_HEADERS.map((header) => (
                    <th key={header} className={TH}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row, index) => (
                    <tr key={index} className={ROW}>
                      {dailyConfirmCells(row).map((value, cell) => (
                        <td key={cell} className={TD}>
                          {text(value || '—')}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr className={ROW}>
                    <td colSpan={6} className={TD}>
                      No confirmed batch plans match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p id="dailyConfirmNotes" className={NOTE}>
        {legacy
          ? legacy +
            ' older record(s): original confirmation route was not recorded. These appear only under Both; the last saved date is used where the original confirmation date is unavailable.'
          : ''}
      </p>
      <p id="dailyConfirmAsOf" className={NOTE}>
        {result ? 'Preview: ' + dyeablePrintedAt(result.generatedAt) : ''}
      </p>
    </div>
  );
}
