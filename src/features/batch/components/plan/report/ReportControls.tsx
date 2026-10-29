'use client';

/* Section heading controls of the report: OD BP (old odControl), Tall/Big size (tallBigControl,
   tallBigDeclarationControl) and the Dyeing Mode popup (ccDyeingModeControl).
   Like the old HTML, the selects and checkboxes are uncontrolled and re-created with every report rebuild
   (`seq`): a choice shows at once and the rebuilt report shows the saved state.
   In print only the component Dyeing Type stays in a heading (old `.report-heading-actions > :not(.component-dyeing-control)`). */
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
} from '@/features/batch/lib';
import { cn } from '@/lib/cn';
import { button, controlFont } from '../../ui/styles';
import { CONTROL_FONT, FIELD_STATES, tallBigSelect, text } from './reportShared';

const OD_MODES = ['Regular', 'As Suggested', 'Need Declaration'];
const TALL_BIG_TYPES = ['No', 'Tall', 'Big'];

/** Dyeing Type / OD BP label and select (old `.component-dyeing-control`); printed as plain text. */
export const dyeingControl = 'flex items-center gap-2 text-[12px] font-semibold';
export const dyeingSelect =
  'rounded border border-solid border-[#a8bfd4] bg-white py-[5px] pl-2 pr-6 text-[#173756] ' +
  FIELD_STATES +
  ' print:appearance-none print:border-0 print:bg-transparent print:px-[3px] print:py-0';

/** Old `.tall-big-control` (label of a Tall/Big select). */
const TALL_BIG_LABEL = 'inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold dark:text-[#cbd5e1] print:hidden';

/** A secondary heading button that is not printed. */
const headingSecondary = cn(button('secondary'), controlFont, 'print:hidden');

/** OD BP select of Colour & Batch Info or a component section. */
export function OdControl({ od, seq, disabled }: { od: ReportBodyOdControl; seq: number; disabled: boolean }) {
  return (
    <label className={cn(dyeingControl, 'print:hidden')}>
      {'OD BP '}
      <select
        key={seq}
        className={dyeingSelect}
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
      {/* Old `btn secondary tall-big-control`: a button frame around the label text and the select. */}
      <label className={cn(button('secondary'), 'whitespace-nowrap text-[12px]! font-semibold! print:hidden')}>
        {'Tall/Big size '}
        <select
          key={seq}
          className={tallBigSelect}
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
        <button type="button" className={headingSecondary} data-edit-main-tall-big="" disabled={disabled} onClick={() => openBodyTallBigDeclaration()}>
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
      <label className={TALL_BIG_LABEL}>
        {'Do you declare Tall/Big sizes? '}
        <select
          key={seq}
          className={tallBigSelect}
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
          className={headingSecondary}
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
      className={cn(
        tallBigSelect,
        'invalid:border-[#c28a20] invalid:bg-[#fffbed] dark:invalid:border-[#d97706] dark:invalid:bg-[rgba(245,158,11,0.12)]'
      )}
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

/** Browser checkbox margins (Tailwind's base styles remove them). */
const CHECKBOX = 'm-[3px_3px_3px_4px]';
/** A line with a checkbox in the popup (old `.cc-mode-option`). */
const OPTION = 'flex cursor-pointer items-center gap-[7px] py-[3px]';
/** Hint lines of the popup (old `.cc-mode-popover small`). */
const HINT = 'text-[10px] leading-[1.4] text-[#667487] dark:text-[#94a3b8]';

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
      className={CHECKBOX}
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
    report is rebuilt (the old code reopened them after a Dyeing Mode save). Not printed; the preview drops it. */
export function CcDyeingModeControl({ mode, seq, disabled }: { mode: ReportBodyDyeingMode; seq: number; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  // Old filterDyeingModeOptions(value): a fabric stays visible when its text contains the search term.
  const term = String(search).trim().toLowerCase();
  const filterDyeingModeOptions = (optionText: string) => optionText.toLowerCase().includes(term);
  return (
    <details
      className="relative z-[25] text-[12px] font-normal print:hidden"
      id="ccDyeingMode"
      data-preview-strip=""
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary role="button" className={cn(button('secondary'), 'list-none whitespace-nowrap [&::-webkit-details-marker]:hidden')} id="btnCCMode">
        Dyeing Mode ▾
      </summary>
      <div
        className={
          'absolute right-0 top-[calc(100%+6px)] grid w-[235px] gap-[7px] rounded-md border border-solid border-[#b9c5cf] bg-white p-2.5 text-[#23374d] ' +
          'shadow-[0_8px_24px_#142c492b] dark:border-[#2a3346] dark:bg-[#181c25] dark:text-[#e2e8f0] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]'
        }
      >
        <strong className="-mx-2.5 -mt-2.5 mb-0.5 rounded-t-[5px] bg-[#fff589] p-2 text-[13px] text-[#202020] dark:bg-[rgba(234,179,8,0.2)] dark:text-[#fde68a]">
          All Together, Except…
        </strong>
        <label className="sr-only" htmlFor="ccModeSearch">
          Search fabrics or colours
        </label>
        <input
          id="ccModeSearch"
          type="search"
          className={cn('w-full rounded-[3px] border border-solid border-[#b6c3d0] bg-white p-1.5', CONTROL_FONT, FIELD_STATES)}
          placeholder="Search"
          autoComplete="off"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className={OPTION}>
          <ModeCheckbox
            key={seq}
            state={mode.all}
            disabled={disabled}
            attributes={{ 'data-cc-all': '' }}
            onChange={(checked) => void changeFabricDyeingMode('all', '*', checked)}
          />
          {' Select All'}
        </label>
        <div className="grid max-h-[310px] gap-1 overflow-auto">
          {mode.options.map((option, index) => (
            <details
              key={index + '|' + option.key}
              className="group/fabric border-t border-solid border-[#e1e7ed] pt-1 dark:border-[#1e2536]"
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
              <summary
                className={
                  "flex cursor-pointer list-none items-center gap-2 whitespace-nowrap py-[5px] after:content-['▸'] " +
                  "group-open/fabric:after:content-['▾'] [&::-webkit-details-marker]:hidden"
                }
              >
                <ModeCheckbox
                  key={seq}
                  state={option.state}
                  disabled={disabled}
                  attributes={{ 'data-mode-fabric-all': option.key, 'aria-label': 'All colours for ' + option.name }}
                  onChange={(checked) => void changeFabricDyeingMode(option.key, '*', checked)}
                />
                <span className="flex-1">{option.name}</span>
              </summary>
              <small className="mb-1 ml-[22px] block text-[11px] leading-[1.4] text-[#667487] dark:text-[#94a3b8]">
                {option.type || 'Fabric details not entered'}
              </small>
              <div className="ml-[22px] border-l-2 border-solid border-[#dce4ed] pl-[9px] dark:border-[#2a3346]">
                <label className={OPTION}>
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
                  <label key={colourIndex + '|' + colour.key} className={OPTION}>
                    <input
                      key={seq}
                      type="checkbox"
                      className={CHECKBOX}
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
        {mode.options.length ? null : <small className={HINT}>No fabrics available yet.</small>}
        <small className={HINT}>
          Checked fabric colours use separate batches. Peach and non-peach fabrics are always grouped separately. Component Dyeing Type YD remains
          separate.
        </small>
        {mode.locked ? <small className={HINT}>This confirmed plan is read-only.</small> : null}
      </div>
    </details>
  );
}
