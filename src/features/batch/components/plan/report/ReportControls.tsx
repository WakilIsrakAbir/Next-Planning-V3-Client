'use client';

/* Section heading controls of the report: OD BP (old odControl), Tall/Big size (tallBigControl,
   tallBigDeclarationControl) and the Dyeing Mode popup (ccDyeingModeControl).
   Like the old HTML, the selects and checkboxes are uncontrolled and re-created with every report rebuild
   (`seq`): a choice shows at once and the rebuilt report shows the saved state. */
import React, { useState } from 'react';
import {
  changeBatchTallBig,
  changeFabricDyeingMode,
  changeODMode,
  changeTallBigEnabled,
  disableTallBigDeclaration,
  openBodyTallBigDeclaration,
  openTallBigDeclaration,
  type ReportBodyCheckState,
  type ReportBodyDyeingMode,
  type ReportBodyOdControl,
  type ReportBodyTallBigControl,
  type Row,
} from '@/features/batch/engine';
import { text } from './reportShared';

const OD_MODES = ['Regular', 'As Suggested', 'Need Declaration'];
const TALL_BIG_TYPES = ['No', 'Tall', 'Big'];

/** OD BP select of Colour & Batch Info or a component section. */
export function OdControl({ od, seq, disabled }: { od: ReportBodyOdControl; seq: number; disabled: boolean }) {
  return (
    <label className="component-dyeing-control od-bp-control">
      {'OD BP '}
      <select
        key={seq}
        data-od-mode={od.kind}
        aria-label={'OD BP for ' + (od.kind === 'body' ? 'Colour & Batch Info' : od.kind)}
        disabled={disabled}
        defaultValue={od.mode}
        onChange={(event) => void changeODMode(od.kind, event.target.value)}
      >
        {OD_MODES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Tall/Big size select of Colour & Batch Info, with Declare Tall/Big Qty while it is Yes. */
export function TallBigControl({ control, seq, disabled }: { control: ReportBodyTallBigControl; seq: number; disabled: boolean }) {
  return (
    <>
      <label className="btn secondary tall-big-control">
        {'Tall/Big size '}
        <select
          key={seq}
          id="tallBigEnabled"
          aria-label="Tall/Big size"
          disabled={disabled}
          defaultValue={control.enabled ? 'Yes' : 'No'}
          onChange={(event) => void changeTallBigEnabled(event.target.value)}
        >
          <option value="No">No</option>
          <option value="Yes">Yes</option>
        </select>
      </label>
      {control.enabled ? (
        <button type="button" className="btn secondary" data-edit-main-tall-big="" disabled={disabled} onClick={() => openBodyTallBigDeclaration()}>
          Declare Tall/Big Qty
        </button>
      ) : null}
    </>
  );
}

/** "Do you declare Tall/Big sizes?" of a component section, with Edit Tall/Big Quantities while it is Yes. */
export function TallBigDeclarationControl({
  section,
  control,
  seq,
  disabled,
}: {
  section: Row;
  control: ReportBodyTallBigControl;
  seq: number;
  disabled: boolean;
}) {
  return (
    <>
      <label className="tall-big-control">
        {'Do you declare Tall/Big sizes? '}
        <select
          key={seq}
          data-component-tall-big={section.kind}
          aria-label={'Do you declare Tall/Big sizes for ' + text(section.title) + '?'}
          disabled={disabled}
          defaultValue={control.enabled ? 'Yes' : 'No'}
          onChange={(event) => {
            if (event.target.value === 'Yes') openTallBigDeclaration(section.kind);
            else void disableTallBigDeclaration(section.kind);
          }}
        >
          <option value="No">No</option>
          <option value="Yes">Yes</option>
        </select>
      </label>
      {control.enabled ? (
        <button
          type="button"
          className="btn secondary"
          data-edit-tall-big={section.kind}
          disabled={disabled}
          onClick={() => openTallBigDeclaration(section.kind)}
        >
          Edit Tall/Big Quantities
        </button>
      ) : null}
    </>
  );
}

/** Tall/Big select of a batch row in Colour & Batch Info ([data-batch-tall-big]). */
export function BatchTallBigSelect({
  row,
  index,
  seq,
  disabled,
  automatic,
}: {
  row: Row;
  index: number;
  seq: number;
  disabled: boolean;
  automatic: boolean;
}) {
  return (
    <select
      key={seq}
      className="tall-big-select"
      data-batch-tall-big={index}
      aria-label={'Tall/Big size for batch ' + text(row.id)}
      required
      disabled={disabled || automatic}
      title={automatic ? 'Automatically selected from declared quantities' : ''}
      defaultValue={TALL_BIG_TYPES.includes(row.tallBig) ? row.tallBig : ''}
      onChange={(event) => void changeBatchTallBig(index, event.target.value)}
    >
      <option value="">Select…</option>
      {TALL_BIG_TYPES.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </select>
  );
}

/** A Dyeing Mode checkbox: checked, mixed (aria-checked="mixed", data-mode-partial, indeterminate) or not. */
function ModeCheckbox({
  state,
  disabled,
  onChange,
  attributes,
}: {
  state: ReportBodyCheckState;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  attributes: Record<string, string>;
}) {
  const mixed = state === 'mixed';
  return (
    <input
      type="checkbox"
      {...attributes}
      defaultChecked={state === 'checked'}
      aria-checked={mixed ? 'mixed' : undefined}
      data-mode-partial={mixed ? '' : undefined}
      disabled={disabled}
      // The old setMutationBusy set indeterminate again on every [data-mode-partial] each time it ran.
      ref={(element) => {
        if (element && mixed) element.indeterminate = true;
      }}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

/** Dyeing Mode popup ("All Together, Except…"). Its open state, opened fabrics and search text stay while the
    report is rebuilt (the old code reopened them after a Dyeing Mode save). */
export function CcDyeingModeControl({ mode, seq, disabled }: { mode: ReportBodyDyeingMode; seq: number; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  // Old filterDyeingModeOptions(value): a fabric stays visible when its text contains the search term.
  const term = String(search).trim().toLowerCase();
  const filterDyeingModeOptions = (optionText: string) => optionText.toLowerCase().includes(term);
  return (
    <details className="cc-mode-control" id="ccDyeingMode" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary role="button" className="btn secondary" id="btnCCMode">
        Dyeing Mode ▾
      </summary>
      <div className="cc-mode-popover">
        <strong>All Together, Except…</strong>
        <label className="sr-only" htmlFor="ccModeSearch">
          Search fabrics or colours
        </label>
        <input id="ccModeSearch" type="search" placeholder="Search" autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} />
        <label className="cc-mode-option">
          <ModeCheckbox
            key={seq}
            state={mode.all}
            disabled={disabled}
            attributes={{ 'data-cc-all': '' }}
            onChange={(checked) => void changeFabricDyeingMode('all', '*', checked)}
          />
          {' Select All'}
        </label>
        <div className="cc-mode-fabrics">
          {mode.options.map((option, index) => (
            <details
              key={index + '|' + option.key}
              className="cc-mode-fabric"
              data-cc-option={option.key}
              hidden={!filterDyeingModeOptions(option.text)}
              open={expanded.includes(option.key)}
              onToggle={(event) => {
                const isOpen = event.currentTarget.open;
                setExpanded((list) =>
                  isOpen ? (list.includes(option.key) ? list : [...list, option.key]) : list.filter((key) => key !== option.key)
                );
              }}
            >
              <summary>
                <ModeCheckbox
                  key={seq}
                  state={option.state}
                  disabled={disabled}
                  attributes={{ 'data-mode-fabric-all': option.key, 'aria-label': 'All colours for ' + option.name }}
                  onChange={(checked) => void changeFabricDyeingMode(option.key, '*', checked)}
                />
                <span>{option.name}</span>
              </summary>
              <small>{option.type || 'Fabric details not entered'}</small>
              <div className="cc-mode-colours">
                <label className="cc-mode-option">
                  <ModeCheckbox
                    key={seq}
                    state={option.state}
                    disabled={disabled}
                    attributes={{ 'data-mode-fabric-all': option.key }}
                    onChange={(checked) => void changeFabricDyeingMode(option.key, '*', checked)}
                  />
                  {' All Colour'}
                </label>
                {option.colours.map((colour, colourIndex) => (
                  <label key={colourIndex + '|' + colour.key} className="cc-mode-option">
                    <input
                      key={seq}
                      type="checkbox"
                      data-mode-fabric={option.key}
                      data-mode-colour={colour.key}
                      defaultChecked={colour.checked}
                      disabled={disabled}
                      onChange={(event) => void changeFabricDyeingMode(option.key, colour.key, event.target.checked)}
                    />
                    {' ' + (colour.shade || 'Blank colour')}
                  </label>
                ))}
              </div>
            </details>
          ))}
        </div>
        {mode.options.length ? null : <small>No fabrics available yet.</small>}
        <small>
          Checked fabric colours use separate batches. Peach and non-peach fabrics are always grouped separately. Component Dyeing Type YD remains
          separate.
        </small>
        {mode.locked ? <small>This confirmed plan is read-only.</small> : null}
      </div>
    </details>
  );
}
