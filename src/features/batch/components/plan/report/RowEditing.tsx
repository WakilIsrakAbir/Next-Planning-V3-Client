'use client';

/* Inputs of the row being edited and the row buttons (old rowInputHtml, reportRowActions and the General Info /
   Instruction inputs). The inputs are controlled by S.reportRowEditor.values (they write every change there,
   as the old input listeners did) and re-render on their own, so the big tables do not re-render per key.
   Disabled as the old setMutationBusy loop: while a save runs, the data is not ready, or the plan is locked.
   The row and Add Row buttons are only rendered with the edit permission (old `.perm-no-edit` hid them). */
import React from 'react';
import {
  S,
  handleReportRowAction,
  setGeneralInfoValue,
  setReportRowValue,
  useBatchVersion,
  type Row,
} from '@/features/batch/lib';
import { cn } from '@/lib/cn';
import { button, type ButtonVariant, controlFont } from '../../ui/styles';
import { FIELD_STATES, grid, headingButton, tallBigSelect, useReportCanEdit } from './reportShared';

const TALL_BIG_TYPES = ['No', 'Tall', 'Big'];

/** Text input of an edited row (old `.report-row-input`): black text like a browser input; no frame in print. */
export const rowInput = (minWidth = 'min-w-[75px]') =>
  cn('w-full rounded border border-solid border-[#9bb8d5] bg-white p-1.5 text-black print:border-0 print:p-0', minWidth, FIELD_STATES);

/** Old `.tall-big-select:invalid` (no type chosen yet). */
const TALL_BIG_INVALID = 'invalid:border-[#c28a20] invalid:bg-[#fffbed] dark:invalid:border-[#d97706] dark:invalid:bg-[rgba(245,158,11,0.12)]';

/** Button of the row actions cell (old `.report-row-actions .btn`). */
const rowButton = (variant: ButtonVariant) => cn(button(variant), controlFont, 'm-[3px] px-2! py-[5px]! text-[11px]!');

/** Small labels of the actions cell (old `.manual-row-label`, `.row-edit-label`); the preview drops them. */
const ROW_LABEL = 'block text-[10px] font-bold';
const MANUAL_LABEL = cn(ROW_LABEL, 'text-[#1d5ab2] dark:text-[#34d399]');
const EDIT_LABEL = cn(ROW_LABEL, 'text-[#925417] dark:text-[#fdba74]');

/** Message under the row (old `.row-edit-error`). */
export const rowError = 'mt-[5px] whitespace-normal text-[10px] text-[#b91c1c] dark:text-[#f87171]';

function inputsDisabled(locked: boolean): boolean {
  return S.mutationBusy || !S.storageReady || locked;
}

/** Old rowInputHtml(field, label, value): the Tall/Big select or a text input ([data-row-field]).
    `fallback` is shown while the editor has no value (old `values[field] ?? fallback`). */
export function RowInput({
  field,
  label,
  locked,
  automaticTallBig = false,
  fallback,
}: {
  field: string;
  label: string;
  locked: boolean;
  automaticTallBig?: boolean;
  fallback?: unknown;
}) {
  useBatchVersion();
  const value = S.reportRowEditor?.values?.[field] ?? fallback;
  const disabled = inputsDisabled(locked);
  if (field === 'tallBig')
    return (
      <select
        className={cn(tallBigSelect, TALL_BIG_INVALID)}
        data-row-field="tallBig"
        aria-label={label}
        required
        disabled={disabled || automaticTallBig}
        value={TALL_BIG_TYPES.includes(value) ? value : ''}
        onChange={(event) => setReportRowValue(field, event.target.value)}
      >
        <option value="">Select…</option>
        {TALL_BIG_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    );
  return (
    <input
      type="text"
      className={rowInput()}
      data-row-field={field}
      value={String(value ?? '')}
      aria-label={label}
      list={field === 'machineLabel' ? 'reportMachineOptions' : undefined}
      disabled={disabled}
      onChange={(event) => setReportRowValue(field, event.target.value)}
    />
  );
}

/** Instruction row inputs: SL No (as wide as its text) and the Details textarea. */
export function InstructionInput({ field, locked }: { field: string; locked: boolean }) {
  useBatchVersion();
  const values: Row = S.reportRowEditor?.values || {};
  const disabled = inputsDisabled(locked);
  if (field === 'serial')
    return (
      <input
        className={rowInput('min-w-0')}
        data-row-field="serial"
        aria-label="SL No"
        value={String(values.serial ?? '')}
        style={{ width: Math.max(2, String(values.serial).length) + 'ch' }}
        disabled={disabled}
        onChange={(event) => setReportRowValue('serial', event.target.value)}
      />
    );
  return (
    <textarea
      className={cn(rowInput(), 'resize')}
      data-row-field="details"
      aria-label="Details"
      rows={2}
      value={String(values.details ?? '')}
      disabled={disabled}
      onChange={(event) => setReportRowValue('details', event.target.value)}
    />
  );
}

/** A General Info input ([data-general-field]). */
export function GeneralInput({ field, label, locked }: { field: string; label: string; locked: boolean }) {
  useBatchVersion();
  const value = S.reportRowEditor?.kind === 'general' ? S.reportRowEditor.values?.[field] : undefined;
  return (
    <input
      className={rowInput()}
      data-general-field={field}
      aria-label={label}
      value={String(value ?? '')}
      disabled={inputsDisabled(locked)}
      onChange={(event) => setGeneralInfoValue(field, event.target.value)}
    />
  );
}

/** The actions cell of a report row (old `.report-row-actions`): not printed, dropped by the preview. */
export const actionsCell = cn(grid.td, 'min-w-[140px] whitespace-normal print:hidden');

/** Old reportRowActions(kind, index, editing, manual): the row's Edit/Delete or Save Row/Cancel/Delete cell. */
export function ReportRowActions({
  kind,
  index,
  editing,
  manual,
  editor,
  locked,
  disabled,
}: {
  kind: string;
  index: number;
  editing: boolean;
  manual: unknown;
  editor: Row | null;
  locked: boolean;
  disabled: boolean;
}) {
  const canEdit = useReportCanEdit();
  if (locked)
    return (
      <td className={actionsCell} data-preview-strip="">
        <span className={MANUAL_LABEL} data-preview-strip="">
          Read-only
        </span>
      </td>
    );
  if (editing)
    return (
      <td className={actionsCell} data-preview-strip="">
        <span className={EDIT_LABEL} data-preview-strip="">
          {editor?.isNew ? 'New row' : 'Editing row'}
        </span>
        {canEdit ? (
          <>
            <button
              type="button"
              className={rowButton('success')}
              data-report-row-action="save"
              data-row-kind={kind}
              disabled={disabled}
              onClick={() => handleReportRowAction('save', kind)}
            >
              Save Row
            </button>
            <button
              type="button"
              className={rowButton('secondary')}
              data-report-row-action="cancel"
              data-row-kind={kind}
              disabled={disabled}
              onClick={() => handleReportRowAction('cancel', kind)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={rowButton('danger')}
              data-report-row-action="delete"
              data-row-kind={kind}
              data-row-index={index}
              disabled={disabled}
              onClick={() => handleReportRowAction('delete', kind, index)}
            >
              Delete
            </button>
          </>
        ) : null}
        {editor?.error ? <div className={rowError}>{String(editor.error)}</div> : null}
      </td>
    );
  return (
    <td className={actionsCell} data-preview-strip="">
      {manual ? (
        <span className={MANUAL_LABEL} data-preview-strip="">
          Manual
        </span>
      ) : null}
      {canEdit ? (
        <>
          <button
            type="button"
            className={rowButton('secondary')}
            data-report-row-action="edit"
            data-row-kind={kind}
            data-row-index={index}
            disabled={disabled}
            onClick={() => handleReportRowAction('edit', kind, index)}
          >
            Edit
          </button>
          <button
            type="button"
            className={rowButton('danger')}
            data-report-row-action="delete"
            data-row-kind={kind}
            data-row-index={index}
            disabled={disabled}
            onClick={() => handleReportRowAction('delete', kind, index)}
          >
            Delete
          </button>
        </>
      ) : null}
    </td>
  );
}

/** ＋ Add Row button of a section heading (only with the edit permission). */
export function AddRowButton({ kind, disabled }: { kind: string; disabled: boolean }) {
  const canEdit = useReportCanEdit();
  if (!canEdit) return null;
  return (
    <button
      type="button"
      className={headingButton('success')}
      data-report-row-action="add"
      data-row-kind={kind}
      disabled={disabled}
      onClick={() => handleReportRowAction('add', kind)}
    >
      ＋ Add Row
    </button>
  );
}
