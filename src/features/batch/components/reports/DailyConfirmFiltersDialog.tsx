'use client';

/* Daily Confirm Batch Plan report filters (old #dailyConfirmFilters), shown while S.ui.reportsDailyFilters is
   set (openDailyConfirmFilters). The inputs write into that form; Preview Report runs previewDailyConfirmReport.
   Escape closes, Tab stays inside, a click on the backdrop closes (old behaviour). Never printed. */
import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import {
  BATCH_FLOORS,
  S,
  closeDailyConfirmFilters,
  previewDailyConfirmReport,
  setDailyConfirmFilter,
  useBatchVersion,
} from '@/features/batch/lib';
import type { DailyConfirmForm } from '@/features/batch/lib';
import { button, controlFont, dialog } from '../ui/styles';

const ROUTES: [string, string][] = [
  ['Both', 'Both'],
  ['Pending', 'Pending to Confirm'],
  ['Tentative', 'Tentative to Confirm'],
];

/** A plain browser input / select of the old form, with the old dark look (`html.dark .batch-app input/select`, `:focus`). */
const FIELD =
  '[all:revert] dark:border-[#2a3346]! dark:bg-[#1e2330]! dark:text-[#e2e8f0]! ' +
  'dark:focus:border-[#10b981]! dark:focus:shadow-[0_0_0_2px_rgba(16,185,129,0.15)]! dark:focus:outline-[#10b981]!';
/** A form line (a browser-default paragraph). */
const LINE = 'my-4';

export default function DailyConfirmFiltersDialog() {
  useBatchVersion();
  const form = S.ui.reportsDailyFilters as DailyConfirmForm | null | undefined;
  if (!form) return null;
  return <DailyConfirmFiltersPanel form={form} />;
}

function DailyConfirmFiltersPanel({ form }: { form: DailyConfirmForm }) {
  useBatchVersion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);

  // Opening focuses From (old openDailyConfirmFilters).
  useEffect(() => {
    fromRef.current?.focus();
  }, [form]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDailyConfirmFilters();
    }
    if (event.key === 'Tab' && overlayRef.current) {
      const controls = Array.from(overlayRef.current.querySelectorAll<HTMLElement>('input,select,button')),
        first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      id="dailyConfirmFilters"
      className={dialog.overlay}
      aria-hidden="false"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDailyConfirmFilters();
      }}
      onKeyDown={onKeyDown}
    >
      <section className={dialog.panel} role="dialog" aria-modal="true" aria-labelledby="dailyConfirmFiltersTitle">
        <h3 id="dailyConfirmFiltersTitle" className={dialog.title}>Daily Confirm Batch Plan · Report Filters</h3>
        <form
          id="dailyConfirmForm"
          onSubmit={(event) => {
            event.preventDefault();
            previewDailyConfirmReport();
          }}
        >
          <p className={LINE}>
            <label>
              From{' '}
              <input
                id="dailyConfirmFrom"
                className={FIELD}
                type="date"
                required
                ref={fromRef}
                value={form.from}
                onChange={(event) => setDailyConfirmFilter('from', event.target.value)}
              />
            </label>{' '}
            <label>
              To{' '}
              <input id="dailyConfirmTo" className={FIELD} type="date" required value={form.to} onChange={(event) => setDailyConfirmFilter('to', event.target.value)} />
            </label>
          </p>
          <p className={LINE}>
            <label>
              Confirmation route{' '}
              <select id="dailyConfirmRoute" className={FIELD} value={form.route} onChange={(event) => setDailyConfirmFilter('route', event.target.value)}>
                {ROUTES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p className={LINE}>
            <label>
              Floor{' '}
              <select id="dailyConfirmFloor" className={FIELD} value={form.floor} onChange={(event) => setDailyConfirmFilter('floor', event.target.value)}>
                <option value="All">All</option>
                {BATCH_FLOORS.map((floor) => (
                  <option key={floor.key} value={floor.key}>
                    {floor.label}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p className={LINE}>
            <label>
              Buyer{' '}
              <select id="dailyConfirmBuyer" className={FIELD} value={form.buyer} onChange={(event) => setDailyConfirmFilter('buyer', event.target.value)}>
                <option value="All">All</option>
                {form.buyers.map((buyer) => (
                  <option key={buyer} value={buyer}>
                    {buyer}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p id="dailyConfirmError" className={dialog.error} role="alert">
            {form.error}
          </p>
          <div className={dialog.actions}>
            <button className={cn(button('success'), controlFont)} type="submit">
              Preview Report
            </button>
            <button id="btnDailyConfirmCancel" className={cn(button('secondary'), controlFont)} type="button" onClick={() => closeDailyConfirmFilters()}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
