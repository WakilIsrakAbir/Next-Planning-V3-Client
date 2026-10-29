'use client';

/* Not Possible Fabric dialog (old #fabricPickerDialog), shown while S.fabricPickerState is set.
   OK changes the Dyeing MC draft (applyFabricPicker); Save Changes on the panel saves it. Escape closes,
   Tab stays inside, a click on the backdrop closes, and the focus returns to the row's button (old behaviour). */
import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import {
  S,
  applyFabricPicker,
  changeFabricPickerChoice,
  changeFabricPickerLimit,
  changeFabricPickerSearch,
  changeFabricPickerSelectAll,
  closeFabricPicker,
  constructionKey,
  useBatchVersion,
} from '@/features/batch/lib';
import type { FabricPickerState } from '@/features/batch/lib';
import { field, setupButton } from './setup-styles';

/* Old .fabric-picker-* and .fabric-rule-* rules. */
const help = 'mx-0 mb-2.5 mt-0 text-[12px] leading-[1.5] text-[#475569] dark:text-[#94a3b8]';
const choice = 'flex cursor-pointer items-center gap-[7px] text-[12px] text-[#17263b] dark:text-[#cbd5e1]';
const checkbox = 'm-0 flex-none';
/** Fabric column and GSM column of the heading and of each fabric row. */
const ruleGrid = 'grid grid-cols-[minmax(0,1fr)_160px] items-center gap-3 max-[700px]:grid-cols-[minmax(0,1fr)_125px]';

export default function FabricPickerDialog() {
  useBatchVersion();
  const state = S.fabricPickerState as FabricPickerState | null;
  if (!state) return null;
  return <FabricPickerPanel key={state.rowIndex + ':' + String(state.machineId)} state={state} />;
}

function FabricPickerPanel({ state }: { state: FabricPickerState }) {
  useBatchVersion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const rowIndex = state.rowIndex;

  // Opening focuses the search box; closing gives the focus back to the row's Not Possible Fabric button.
  useEffect(() => {
    searchRef.current?.focus();
    return () => {
      const opener = document.querySelector<HTMLElement>('[data-fabric-picker="' + rowIndex + '"]');
      if (opener) opener.focus();
    };
  }, [rowIndex]);

  // (Select All Fabrics) shows a partial selection of the listed fabrics as indeterminate.
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = state.selectAllIndeterminate;
  });

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeFabricPicker();
    }
    if (event.key === 'Tab' && overlayRef.current) {
      const controls = Array.from(overlayRef.current.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input')).filter(
          (element) => !element.disabled
        ),
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
      id="fabricPickerDialog"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(17,42,70,.3)] p-4 dark:bg-[rgba(0,0,0,0.65)] print:!hidden"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeFabricPicker();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        className={
          'flex max-h-[85vh] w-[650px] max-w-full flex-col rounded-md border border-[#b9ccdf] bg-white p-3 ' +
          'shadow-[0_8px_30px_rgba(17,42,70,.25)] ' +
          'dark:border-[#2a3346] dark:bg-[#181c25] dark:text-[#e2e8f0] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]'
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="fabricPickerTitle"
      >
        <h3 id="fabricPickerTitle" className="mx-0 mb-3 mt-0 text-[14px] font-bold text-[#23496b] dark:text-[#f8fafc]">
          {state.title}
        </h3>
        <p className={help}>
          Check a fabric to block it at every GSM. When unchecked, only that fabric’s GSM limit applies. Blank GSM adds no restriction;
          equal GSM is allowed.
        </p>
        <p id="fabricPickerMigration" className={cn(help, !state.migration && 'hidden')}>
          {state.migration}
        </p>
        <input
          type="search"
          id="fabricPickerSearch"
          className={field}
          placeholder="Search fabrics…"
          aria-label="Search fabrics"
          ref={searchRef}
          value={state.search}
          onChange={(event) => changeFabricPickerSearch(event.target.value)}
        />
        <label className={cn(choice, 'px-2 pb-1.5 pt-2.5')}>
          <input
            type="checkbox"
            id="fabricPickerSelectAll"
            className={checkbox}
            ref={selectAllRef}
            checked={state.selectAllChecked}
            disabled={state.selectAllDisabled}
            onChange={(event) => changeFabricPickerSelectAll(event.target.checked)}
          />
          (Select All Fabrics)
        </label>
        <div
          className={cn(
            ruleGrid,
            'border border-b-0 border-batch-border bg-[#edf3f9] px-3 py-2 text-[11.5px] font-bold text-[#23496b] ' +
              'dark:bg-[#1e2330] dark:text-[#e2e8f0]'
          )}
        >
          <span>
            Not Possible Fabric
            <br />
            <small className="text-[10.5px] font-normal leading-[1.5]">Checked = blocked at every GSM</small>
          </span>
          <span>
            Not Possible GSM
            <br />
            (Greater than)
          </span>
        </div>
        <div id="fabricPickerChoices" className="max-h-[280px] min-h-[80px] overflow-auto border border-batch-border px-2 py-1">
          {state.visible.length ? (
            state.visible.map((value) => {
              const key: string = constructionKey(value);
              return (
                <div className={cn(ruleGrid, 'border-b border-[#e7edf4] py-[5px] last:border-b-0 dark:border-[#1e2536]')} key={value}>
                  <label className={cn(choice, 'py-1 wrap-anywhere')}>
                    <input
                      type="checkbox"
                      className={checkbox}
                      data-fabric-choice={value}
                      checked={state.selected.has(key)}
                      onChange={(event) => changeFabricPickerChoice(value, event.target.checked)}
                    />
                    {value}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={field}
                    data-fabric-gsm={value}
                    value={state.limits.get(key) || ''}
                    placeholder="No GSM limit"
                    aria-label={'Not Possible GSM (Greater than) for ' + value}
                    onChange={(event) => changeFabricPickerLimit(value, event.target.value)}
                  />
                </div>
              );
            })
          ) : (
            <div className="px-1 py-3 text-[12px] text-[#64748b]">No matching fabrics. Upload the Knitting Plan to load column C.</div>
          )}
        </div>
        <p id="fabricPickerError" className="mx-0 mb-0 mt-1.5 text-[12px] text-[#b91c1c] dark:text-[#f87171]" role="alert">
          {state.error}
        </p>
        <div className="flex items-center gap-[7px] pt-3">
          <span id="fabricPickerCount" className="mr-auto text-[12px] text-[#64748b]">
            {state.countText}
          </span>
          <button type="button" className={setupButton()} id="btnFabricPickerOK" onClick={() => applyFabricPicker()}>
            OK
          </button>
          <button type="button" className={setupButton('secondary')} id="btnFabricPickerCancel" onClick={() => closeFabricPicker()}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
