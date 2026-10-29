'use client';

/* Dyeable Batch / Dyeable Batch Summary report filters (old #dyeableFiltersDialog), shown while
   S.dyeableFilterContext is set. Report criteria only; previewing never modifies bookings.
   Each field is a checkbox dropdown (<details>); only one is open at a time. Escape closes the open dropdown,
   else the dialog; Tab stays inside; a click on the backdrop closes; the focus returns on close. */
import React, { useEffect, useRef } from 'react';
import {
  DYEABLE_ALL,
  DYEABLE_FILTER_IDS,
  S,
  closeDyeableFilters,
  dyeableChoiceChecked,
  dyeableMultiCaption,
  previewDyeableReport,
  toggleDyeableChoice,
  useBatchVersion,
} from '@/features/batch/engine';
import type { DyeableFilterKey, DyeableSelection, Row } from '@/features/batch/engine';

const FIELDS: { key: DyeableFilterKey; label: string }[] = [
  { key: 'knit', label: 'Knit Status' },
  { key: 'labdip', label: 'Labdip' },
  { key: 'buyer', label: 'Buyer' },
  { key: 'floor', label: 'Floor' },
  { key: 'machine', label: 'MC Number' },
];

export default function DyeableFiltersDialog() {
  useBatchVersion();
  const context = S.dyeableFilterContext;
  if (!context) return null;
  return <DyeableFiltersPanel context={context} />;
}

function DyeableFiltersPanel({ context }: { context: Row }) {
  useBatchVersion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const detailsRefs = useRef<Partial<Record<DyeableFilterKey, HTMLDetailsElement | null>>>({});

  // The element that had the focus gets it back when the dialog closes (old context.returnFocus).
  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null;
    return () => {
      if (S.ui.reportsDyeableRestoreFocus) returnFocus?.focus();
    };
  }, []);

  // Opening: every dropdown closed and the focus on Knit Status (old openDyeableFilters).
  useEffect(() => {
    for (const details of Object.values(detailsRefs.current)) if (details) details.open = false;
    detailsRefs.current.knit?.querySelector('summary')?.focus();
  }, [context]);

  const closeOthers = (key: DyeableFilterKey) => {
    if (!detailsRefs.current[key]?.open) return;
    for (const field of FIELDS) {
      const other = detailsRefs.current[field.key];
      if (field.key !== key && other) other.open = false;
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      const open = FIELDS.map((field) => detailsRefs.current[field.key]).find((root) => root?.open);
      if (open) {
        open.open = false;
        open.querySelector('summary')?.focus();
      } else closeDyeableFilters();
    }
    if (event.key === 'Tab' && overlayRef.current) {
      const controls = Array.from(overlayRef.current.querySelectorAll<HTMLElement>('summary,input,button')).filter(
        (element) =>
          !(element as HTMLInputElement).disabled &&
          (element.tagName === 'SUMMARY' || !element.closest('details') || (element.closest('details') as HTMLDetailsElement).open)
      );
      const first = controls[0],
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
      id="dyeableFiltersDialog"
      className="tentative-overlay"
      aria-hidden="false"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDyeableFilters();
      }}
      onKeyDown={onKeyDown}
    >
      <form
        id="dyeableFiltersForm"
        className="tentative-panel dyeable-filter-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dyeableFiltersTitle"
        onSubmit={(event) => {
          event.preventDefault();
          previewDyeableReport();
        }}
      >
        <h3 id="dyeableFiltersTitle">{(context.mode === 'summary' ? 'Dyeable Batch Summary' : 'Dyeable Batch') + ' · Report Filters'}</h3>
        <p className="tentative-context">Confirmed batch plans with current Knit Status. Check multiple options; filters combine across fields.</p>
        <div className="dyeable-filter-grid">
          {FIELDS.map(({ key, label }) => {
            const id = DYEABLE_FILTER_IDS[key];
            const state = context.selections?.[key] as DyeableSelection | undefined;
            const choices: [string, string][] = state ? [[DYEABLE_ALL, 'All'], ...state.choices] : [];
            return (
              <div key={key} className={'dyeable-filter-field' + (key === 'machine' ? ' dyeable-machine-field' : '')}>
                <span id={id + 'Label'}>{label}</span>
                <details
                  id={id}
                  className="dyeable-multi"
                  ref={(element) => {
                    detailsRefs.current[key] = element;
                  }}
                  onToggle={() => closeOthers(key)}
                >
                  <summary aria-labelledby={id + 'Label'}>
                    <span data-multi-caption="">{dyeableMultiCaption(key)}</span>
                    <span aria-hidden="true">▾</span>
                  </summary>
                  <div className="dyeable-multi-options" role="group" aria-label={label + ' options'}>
                    {choices.map(([value, choiceLabel]) => {
                      const { checked, indeterminate } = dyeableChoiceChecked(key, value);
                      return (
                        <label key={value}>
                          <input
                            type="checkbox"
                            data-dyeable-key={key}
                            data-dyeable-choice={value}
                            checked={checked}
                            ref={(input) => {
                              if (input && value === DYEABLE_ALL) input.indeterminate = indeterminate;
                            }}
                            onChange={(event) => toggleDyeableChoice(key, value, event.target.checked)}
                          />
                          {choiceLabel}
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
        <p className="dyeable-report-note">
          Labdip is Yes when the saved batch has a Lapdip Number. “Knit ok but need check CC Prod.” is included in Knit ok.
        </p>
        <p id="dyeableFilterError" className="tentative-error" role="alert">
          {String(context.error || '')}
        </p>
        <div className="tentative-actions">
          <button type="button" className="btn secondary" id="btnCancelDyeableFilters" onClick={() => closeDyeableFilters()}>
            Cancel
          </button>
          <button type="submit" className="btn" id="btnPreviewDyeable">
            Preview Report
          </button>
        </div>
      </form>
    </div>
  );
}
