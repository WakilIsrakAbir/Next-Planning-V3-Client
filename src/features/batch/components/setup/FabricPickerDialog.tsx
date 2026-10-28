'use client';

/* Not Possible Fabric dialog (old #fabricPickerDialog), shown while S.fabricPickerState is set.
   OK changes the Dyeing MC draft (applyFabricPicker); Save Changes on the panel saves it. Escape closes,
   Tab stays inside, a click on the backdrop closes, and the focus returns to the row's button (old behaviour). */
import React, { useEffect, useRef } from 'react';
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
} from '@/features/batch/engine';
import type { FabricPickerState } from '@/features/batch/engine';

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
      className="fabric-picker-overlay"
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeFabricPicker();
      }}
      onKeyDown={onKeyDown}
    >
      <div className="fabric-picker-panel" role="dialog" aria-modal="true" aria-labelledby="fabricPickerTitle">
        <h3 id="fabricPickerTitle">{state.title}</h3>
        <p className="fabric-rule-help">
          Check a fabric to block it at every GSM. When unchecked, only that fabric’s GSM limit applies. Blank GSM adds no restriction;
          equal GSM is allowed.
        </p>
        <p id="fabricPickerMigration" className={'fabric-rule-help' + (state.migration ? '' : ' hidden')}>
          {state.migration}
        </p>
        <input
          type="search"
          id="fabricPickerSearch"
          className="setup-input"
          placeholder="Search fabrics…"
          aria-label="Search fabrics"
          ref={searchRef}
          value={state.search}
          onChange={(event) => changeFabricPickerSearch(event.target.value)}
        />
        <label className="fabric-choice fabric-select-all">
          <input
            type="checkbox"
            id="fabricPickerSelectAll"
            ref={selectAllRef}
            checked={state.selectAllChecked}
            disabled={state.selectAllDisabled}
            onChange={(event) => changeFabricPickerSelectAll(event.target.checked)}
          />
          (Select All Fabrics)
        </label>
        <div className="fabric-rule-heading">
          <span>
            Not Possible Fabric
            <br />
            <small>Checked = blocked at every GSM</small>
          </span>
          <span>
            Not Possible GSM
            <br />
            (Greater than)
          </span>
        </div>
        <div id="fabricPickerChoices" className="fabric-picker-choices">
          {state.visible.length ? (
            state.visible.map((value) => {
              const key: string = constructionKey(value);
              return (
                <div className="fabric-rule-choice" key={value}>
                  <label className="fabric-choice">
                    <input
                      type="checkbox"
                      data-fabric-choice={value}
                      checked={state.selected.has(key)}
                      onChange={(event) => changeFabricPickerChoice(value, event.target.checked)}
                    />
                    {value}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="setup-input fabric-gsm-limit"
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
            <div className="fabric-picker-empty">No matching fabrics. Upload the Knitting Plan to load column C.</div>
          )}
        </div>
        <p id="fabricPickerError" className="fabric-rule-error" role="alert">
          {state.error}
        </p>
        <div className="fabric-picker-footer">
          <span id="fabricPickerCount">{state.countText}</span>
          <button type="button" className="btn" id="btnFabricPickerOK" onClick={() => applyFabricPicker()}>
            OK
          </button>
          <button type="button" className="btn secondary" id="btnFabricPickerCancel" onClick={() => closeFabricPicker()}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
