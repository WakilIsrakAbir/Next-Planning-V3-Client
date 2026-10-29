'use client';

/* Daily Confirm Batch Plan report filters (old #dailyConfirmFilters), shown while S.ui.reportsDailyFilters is
   set (openDailyConfirmFilters). The inputs write into that form; Preview Report runs previewDailyConfirmReport.
   Escape closes, Tab stays inside, a click on the backdrop closes (old behaviour). */
import React, { useEffect, useRef } from 'react';
import {
  BATCH_FLOORS,
  S,
  closeDailyConfirmFilters,
  previewDailyConfirmReport,
  setDailyConfirmFilter,
  useBatchVersion,
} from '@/features/batch/lib';
import type { DailyConfirmForm } from '@/features/batch/lib';

const ROUTES: [string, string][] = [
  ['Both', 'Both'],
  ['Pending', 'Pending to Confirm'],
  ['Tentative', 'Tentative to Confirm'],
];

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
      className="tentative-overlay"
      aria-hidden="false"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDailyConfirmFilters();
      }}
      onKeyDown={onKeyDown}
    >
      <section className="tentative-panel" role="dialog" aria-modal="true" aria-labelledby="dailyConfirmFiltersTitle">
        <h3 id="dailyConfirmFiltersTitle">Daily Confirm Batch Plan · Report Filters</h3>
        <form
          id="dailyConfirmForm"
          onSubmit={(event) => {
            event.preventDefault();
            previewDailyConfirmReport();
          }}
        >
          <p>
            <label>
              From{' '}
              <input
                id="dailyConfirmFrom"
                type="date"
                required
                ref={fromRef}
                value={form.from}
                onChange={(event) => setDailyConfirmFilter('from', event.target.value)}
              />
            </label>{' '}
            <label>
              To{' '}
              <input id="dailyConfirmTo" type="date" required value={form.to} onChange={(event) => setDailyConfirmFilter('to', event.target.value)} />
            </label>
          </p>
          <p>
            <label>
              Confirmation route{' '}
              <select id="dailyConfirmRoute" value={form.route} onChange={(event) => setDailyConfirmFilter('route', event.target.value)}>
                {ROUTES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              Floor{' '}
              <select id="dailyConfirmFloor" value={form.floor} onChange={(event) => setDailyConfirmFilter('floor', event.target.value)}>
                <option value="All">All</option>
                {BATCH_FLOORS.map((floor) => (
                  <option key={floor.key} value={floor.key}>
                    {floor.label}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              Buyer{' '}
              <select id="dailyConfirmBuyer" value={form.buyer} onChange={(event) => setDailyConfirmFilter('buyer', event.target.value)}>
                <option value="All">All</option>
                {form.buyers.map((buyer) => (
                  <option key={buyer} value={buyer}>
                    {buyer}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p id="dailyConfirmError" className="tentative-error" role="alert">
            {form.error}
          </p>
          <div className="tentative-actions">
            <button className="btn success" type="submit">
              Preview Report
            </button>
            <button id="btnDailyConfirmCancel" className="btn secondary" type="button" onClick={() => closeDailyConfirmFilters()}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
