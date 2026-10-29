'use client';

/* Inputs of the row being edited and the row buttons (old rowInputHtml, reportRowActions and the General Info /
   Instruction inputs). The inputs are controlled by S.reportRowEditor.values (they write every change there,
   as the old input listeners did) and re-render on their own, so the big tables do not re-render per key.
   Disabled as the old setMutationBusy loop: while a save runs, the data is not ready, or the plan is locked. */
import React from 'react';
import {
  S,
  handleReportRowAction,
  setGeneralInfoValue,
  setReportRowValue,
  useBatchVersion,
  type Row,
} from '@/features/batch/lib';

const TALL_BIG_TYPES = ['No', 'Tall', 'Big'];

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
        className="tall-big-select"
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
      className="report-row-input"
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
        className="report-row-input"
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
      className="report-row-input"
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
      className="report-row-input"
      data-general-field={field}
      aria-label={label}
      value={String(value ?? '')}
      disabled={inputsDisabled(locked)}
      onChange={(event) => setGeneralInfoValue(field, event.target.value)}
    />
  );
}

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
  if (locked)
    return (
      <td className="report-row-actions">
        <span className="manual-row-label">Read-only</span>
      </td>
    );
  if (editing)
    return (
      <td className="report-row-actions">
        <span className="row-edit-label">{editor?.isNew ? 'New row' : 'Editing row'}</span>
        <button
          type="button"
          className="btn success"
          data-report-row-action="save"
          data-row-kind={kind}
          disabled={disabled}
          onClick={() => handleReportRowAction('save', kind)}
        >
          Save Row
        </button>
        <button
          type="button"
          className="btn secondary"
          data-report-row-action="cancel"
          data-row-kind={kind}
          disabled={disabled}
          onClick={() => handleReportRowAction('cancel', kind)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn danger"
          data-report-row-action="delete"
          data-row-kind={kind}
          data-row-index={index}
          disabled={disabled}
          onClick={() => handleReportRowAction('delete', kind, index)}
        >
          Delete
        </button>
        {editor?.error ? <div className="row-edit-error">{String(editor.error)}</div> : null}
      </td>
    );
  return (
    <td className="report-row-actions">
      {manual ? <span className="manual-row-label">Manual</span> : null}
      <button
        type="button"
        className="btn secondary"
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
        className="btn danger"
        data-report-row-action="delete"
        data-row-kind={kind}
        data-row-index={index}
        disabled={disabled}
        onClick={() => handleReportRowAction('delete', kind, index)}
      >
        Delete
      </button>
    </td>
  );
}

/** ＋ Add Row button of a section heading. */
export function AddRowButton({ kind, disabled }: { kind: string; disabled: boolean }) {
  return (
    <button
      type="button"
      className="btn success report-add-row"
      data-report-row-action="add"
      data-row-kind={kind}
      disabled={disabled}
      onClick={() => handleReportRowAction('add', kind)}
    >
      ＋ Add Row
    </button>
  );
}
