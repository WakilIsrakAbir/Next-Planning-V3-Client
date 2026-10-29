'use client';

/* Helpers shared by the report body and its dialogs. */
import React, { useEffect, useRef } from 'react';
import { S } from '@/features/batch/engine';

/** Text of a value as the old esc(value) showed it. */
export function text(value: unknown): string {
  return String(value ?? '');
}

type Header = string | { label: string; className?: string };

/** The old table(headers, rows, cls) helper: <div class="table-wrap"><table class=cls>… */
export function ReportTable({ className = 'grid-table', headers, children }: { className?: string; headers: Header[]; children?: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table className={className}>
        <thead>
          <tr>
            {headers.map((header, index) =>
              typeof header === 'string' ? (
                <th key={index}>{header}</th>
              ) : (
                <th key={index} className={header.className}>
                  {header.label}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Old dialog Tab handling: Tab from the last enabled control goes to the first, Shift+Tab from the first to
    the last. `skipHidden` also leaves out controls with the .hidden class (Tall/Big dialog). */
export function trapDialogTab(event: React.KeyboardEvent, container: HTMLElement | null, selector: string, skipHidden = false): void {
  if (event.key !== 'Tab' || !container) return;
  const controls = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (element) => !(element as HTMLButtonElement).disabled && !(skipHidden && element.classList.contains('hidden'))
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
