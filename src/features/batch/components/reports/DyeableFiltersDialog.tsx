'use client';

/* Dyeable Batch / Dyeable Batch Summary report filters (old #dyeableFiltersDialog), shown while
   S.dyeableFilterContext is set. Report criteria only; previewing never modifies bookings.
   Each field is a checkbox dropdown (<details>); only one is open at a time. Escape closes the open dropdown,
   else the dialog; Tab stays inside; a click on the backdrop closes; the focus returns on close. Never printed. */
import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
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
} from '@/features/batch/lib';
import type { DyeableFilterKey, DyeableSelection, Row } from '@/features/batch/lib';
import { button, controlFont, dialog } from '../ui/styles';

const FIELDS: { key: DyeableFilterKey; label: string }[] = [
  { key: 'knit', label: 'Knit Status' },
  { key: 'labdip', label: 'Labdip' },
  { key: 'buyer', label: 'Buyer' },
  { key: 'floor', label: 'Floor' },
  { key: 'machine', label: 'MC Number' },
];

/** One option of a checkbox dropdown; the first one ("All") is bold and underlined (old `.dyeable-multi-options label`). */
const OPTION =
  'flex cursor-pointer flex-row items-start gap-2 px-0.5 py-[7px] text-[12px] font-normal leading-[1.4] text-[#17263b] [overflow-wrap:anywhere] ' +
  'first:border-b first:border-solid first:border-[#d6e3ef] first:font-bold dark:text-[#cbd5e1] dark:first:border-[#1e2536]';

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
      className={dialog.overlay}
      aria-hidden="false"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDyeableFilters();
      }}
      onKeyDown={onKeyDown}
    >
      <form
        id="dyeableFiltersForm"
        className={cn(dialog.panel, 'w-[600px]!')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dyeableFiltersTitle"
        onSubmit={(event) => {
          event.preventDefault();
          previewDyeableReport();
        }}
      >
        <h3 id="dyeableFiltersTitle" className={dialog.title}>
          {(context.mode === 'summary' ? 'Dyeable Batch Summary' : 'Dyeable Batch') + ' · Report Filters'}
        </h3>
        <p className={dialog.context}>
          Confirmed batch plans with current Knit Status. Check multiple options; filters combine across fields.
        </p>
        <div className="mt-[18px] grid grid-cols-[1fr_1fr] gap-4 max-[600px]:grid-cols-[1fr]">
          {FIELDS.map(({ key, label }) => {
            const id = DYEABLE_FILTER_IDS[key];
            const state = context.selections?.[key] as DyeableSelection | undefined;
            const choices: [string, string][] = state ? [[DYEABLE_ALL, 'All'], ...state.choices] : [];
            return (
              <div
                key={key}
                className={cn(
                  'flex min-w-0 flex-col gap-[7px] text-[12px] font-bold text-[#315571] dark:text-[#cbd5e1]',
                  key === 'machine' && 'col-span-full'
                )}
              >
                <span id={id + 'Label'}>{label}</span>
                <details
                  id={id}
                  className={cn(
                    'group min-w-0 rounded-[5px] border border-solid border-[#c8d7e5] bg-white',
                    'dark:border-[#2a3346] dark:bg-[#181c25] dark:text-[#e2e8f0] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]'
                  )}
                  ref={(element) => {
                    detailsRefs.current[key] = element;
                  }}
                  onToggle={() => closeOthers(key)}
                >
                  <summary
                    aria-labelledby={id + 'Label'}
                    className={cn(
                      'flex cursor-pointer list-none items-center justify-between gap-2 p-2.5 font-normal text-[#17263b] [&::-webkit-details-marker]:hidden',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6] dark:text-[#cbd5e1]',
                      'group-open:border-b group-open:border-solid group-open:border-[#d6e3ef] group-open:bg-[#f0f7fd]',
                      'dark:group-open:border-[#2a3346] dark:group-open:bg-[#252b3b]'
                    )}
                  >
                    <span data-multi-caption="" className="[overflow-wrap:anywhere]">{dyeableMultiCaption(key)}</span>
                    <span aria-hidden="true">▾</span>
                  </summary>
                  <div className="max-h-[170px] overflow-auto px-[9px] py-[5px]" role="group" aria-label={label + ' options'}>
                    {choices.map(([value, choiceLabel]) => {
                      const { checked, indeterminate } = dyeableChoiceChecked(key, value);
                      return (
                        <label key={value} className={OPTION}>
                          <input
                            type="checkbox"
                            className="mx-0 mb-0 mt-0.5 flex-none accent-[#2563a6] dark:accent-[#10b981]"
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
        <p className="mx-0 mb-0 mt-4 text-[11.5px] leading-[1.6] text-[#64748b]">
          Labdip is Yes when the saved batch has a Lapdip Number. “Knit ok but need check CC Prod.” is included in Knit ok.
        </p>
        <p id="dyeableFilterError" className={dialog.error} role="alert">
          {String(context.error || '')}
        </p>
        <div className={dialog.actions}>
          <button type="button" className={cn(button('secondary'), controlFont)} id="btnCancelDyeableFilters" onClick={() => closeDyeableFilters()}>
            Cancel
          </button>
          <button type="submit" className={cn(button('primary'), controlFont)} id="btnPreviewDyeable">
            Preview Report
          </button>
        </div>
      </form>
    </div>
  );
}
