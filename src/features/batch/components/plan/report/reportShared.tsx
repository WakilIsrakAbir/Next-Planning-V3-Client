'use client';

/* Helpers and Tailwind classes shared by the report body and its dialogs.
   Dark-mode rules that the old page scoped to #reportContent use the `dark:[#reportContent_&]:` variant, so the
   read-only copy in the full-view preview (which has no #reportContent) keeps the old look there too. */
import React, { useContext, useEffect, useRef } from 'react';
import { S } from '@/features/batch/lib';
import { cn } from '@/lib/cn';
import { button, type ButtonVariant, controlFont, tableWrap } from '../../ui/styles';

/** Text of a value as the old esc(value) showed it. */
export function text(value: unknown): string {
  return String(value ?? '');
}

/* ---------- classes ---------- */
/** Small report button: Add Row, Edit (General Info), Reset from BP Data, Machine Selection Evaluation
    (old `.report-add-row`, `.machine-evaluation-button`); hidden in print. */
export const headingButton = (variant: ButtonVariant) => cn(button(variant), controlFont, 'px-2.5! py-1.5! text-[11.5px]! print:hidden');

/** A body row of any table (old `tbody tr:nth-child(even)` / `tbody tr:hover`; print keeps a row on one page). */
export const bodyRow = 'even:bg-batch-row-alt hover:bg-[#edf4fc] dark:hover:bg-[rgba(16,185,129,0.08)] print:break-inside-avoid';

/** Placeholder colour (the browser's #757575; Tailwind's base styles use half the text colour) and the dark look
    of text inputs and selects (old `html.dark .batch-app input, select, textarea`). */
export const FIELD_STATES =
  'placeholder:text-[#757575] dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#e2e8f0] dark:placeholder:text-[#475569] ' +
  'dark:focus:border-[#10b981] dark:focus:shadow-[0_0_0_2px_rgba(16,185,129,0.15)] dark:focus:outline-[#10b981]';

/** A select or input that used the browser's control font (Arial 13.33px, black). */
export const CONTROL_FONT = 'font-[Arial] text-[13.333px] font-normal leading-[normal] text-black';

/** Tall/Big select of a batch row and of the section headings (old `.tall-big-select`, `.tall-big-control select`). */
export const tallBigSelect =
  'rounded border border-solid border-[#b6c3d0] bg-white p-1.5 font-[Arial] text-[13.333px] font-normal leading-[normal] text-[#23374d] ' +
  FIELD_STATES;

/** Report cell (old `.report th, .report td`); the dark border was scoped to #reportContent. */
const CELL = 'border border-solid border-batch-border px-2 py-[7px] [overflow-wrap:anywhere] print:px-0.5 print:py-[3px]';
const DARK_TH = 'dark:[#reportContent_&]:bg-[#151921] dark:[#reportContent_&]:text-[#cbd5e1]';
const DARK_TD = 'dark:[#reportContent_&]:border-[#1e2536]';

/** Cells of the report's grid tables (old `.report .grid-table th/td`). */
export const grid = {
  th: cn(CELL, 'bg-[#d3e5f5] text-center font-bold text-[#143452]', DARK_TH),
  td: cn(CELL, 'text-center', DARK_TD),
};

/** Cells of General Info (old `.info-table th/td`). */
export const info = {
  th: cn(CELL, 'w-[9%] bg-[#e4eef8] text-left text-[10.5px] font-bold text-[#173756]', DARK_TH),
  td: cn(CELL, 'w-[7.66%] text-left font-semibold text-[#1e354e]', DARK_TD, 'dark:[#reportContent_&]:text-[#e2e8f0]'),
};

/** Table layouts of the report (old `.report table`, `.info-table`, `.fabric-info-table`, `.instruction-table`). */
const REPORT_TABLE = 'w-full border-collapse text-[11.5px] print:text-[8px]';
export const reportLayout = {
  grid: cn(REPORT_TABLE, 'min-w-[960px] table-fixed print:min-w-0'),
  info: cn(REPORT_TABLE, 'min-w-[1080px] table-fixed print:min-w-0'),
  fabric: cn(REPORT_TABLE, 'min-w-[1400px] table-fixed print:min-w-0'),
  instruction: cn(
    REPORT_TABLE,
    'min-w-0 table-auto [&_td:first-child]:w-[1%] [&_td:first-child]:whitespace-nowrap [&_th:first-child]:w-[1%] [&_th:first-child]:whitespace-nowrap'
  ),
};

/** Wrapper of a report table (old `.table-wrap` inside #reportContent). */
export const reportTableWrap = tableWrap;

/** Background of the row being edited (old `.report-row-editing td`; the preview copy dropped it in light mode)
    and of a manual row (old `.report-row-manual td`). */
export function editRowClass(editing: boolean, manual: unknown): string | undefined {
  if (editing) return '[#reportContent_&>td]:bg-[#fff7ed] dark:[&>td]:bg-[rgba(245,158,11,0.12)]!';
  if (manual) return '[&>td]:bg-[#f5faff] dark:[&>td]:bg-[rgba(59,130,246,0.08)]';
  return undefined;
}

type Header = string | { label: string; className?: string };

/** The old table(headers, rows, cls) helper inside the report: <div class="table-wrap"><table class=cls>…
    `layout` is one of reportLayout; `edit` marks an editable table (old `.report-edit-table`), whose last
    heading ('Action') is not printed. */
export function ReportTable({
  layout = reportLayout.grid,
  edit = false,
  headers,
  children,
}: {
  layout?: string;
  edit?: boolean;
  headers: Header[];
  children?: React.ReactNode;
}) {
  return (
    <div className={reportTableWrap} data-report-table-wrap="">
      <table className={layout} data-report-edit-table={edit ? '' : undefined}>
        <thead>
          <tr className="print:break-inside-avoid">
            {headers.map((header, index) => (
              <th key={index} className={cn(grid.th, typeof header === 'string' ? undefined : header.className, edit && index === headers.length - 1 && 'print:hidden')}>
                {typeof header === 'string' ? header : header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Cell of a dialog table (the old dialogs had no table rules: the browser's 1px cell padding). */
export const dialogCell = 'p-px';

/** The old table() helper in a dialog: the browser's table look (separate borders, 2px spacing, bold centred
    headings). `wide` is the Machine / Tall/Big popup table (old `.machine-popup-table table` and its sticky thead). */
export function DialogTable({ wide = false, headers, children }: { wide?: boolean; headers: string[]; children?: React.ReactNode }) {
  return (
    <div className={wide ? 'w-full overflow-visible' : tableWrap}>
      <table className={cn('border-separate border-spacing-[2px]', wide && 'min-w-[1100px]')}>
        <thead className={wide ? 'sticky top-0 z-[1] bg-[#e4eef8] dark:bg-[#151921] dark:text-[#cbd5e1]' : undefined}>
          <tr>
            {headers.map((header, index) => (
              <th key={index} className={dialogCell}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ---------- permission ---------- */
/** Whether the user may edit the report (old `.perm-no-edit` hid Add Row, the row buttons, the General Info
    buttons and Load MC). ReportBody provides it, so the memoised tables update when it changes. */
export const ReportEditPermission = React.createContext(false);

export function useReportCanEdit(): boolean {
  return useContext(ReportEditPermission);
}

/* ---------- keyboard and focus ---------- */
/** Old dialog Tab handling: Tab from the last enabled control goes to the first, Shift+Tab from the first to
    the last. `skipHidden` also leaves out controls with the `hidden` attribute (Tall/Big dialog steps). */
export function trapDialogTab(event: React.KeyboardEvent, container: HTMLElement | null, selector: string, skipHidden = false): void {
  if (event.key !== 'Tab' || !container) return;
  const controls = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (element) => !(element as HTMLButtonElement).disabled && !(skipHidden && element.hidden)
    ),
    first = controls[0],
    last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

type FocusRequest = { selector: string; seq: number };
let handledFocus = 0;

/** Focuses the element the engine asked for (S.ui.reportuiFocus, set by requestReportFocus) after the render
    that shows it. Requests made before this component mounted are ignored. */
export function useReportFocus(): void {
  const request = S.ui.reportuiFocus as FocusRequest | undefined;
  const seq = request?.seq ?? 0;
  const mountedAt = useRef(seq);
  useEffect(() => {
    const current = S.ui.reportuiFocus as FocusRequest | undefined;
    if (!current || current.seq <= Math.max(handledFocus, mountedAt.current)) return;
    handledFocus = current.seq;
    document.querySelector<HTMLElement>(current.selector)?.focus();
  }, [seq]);
}
