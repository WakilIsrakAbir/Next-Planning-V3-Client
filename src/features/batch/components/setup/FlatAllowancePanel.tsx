'use client';

/* Flat Allowance panel (old #flatAllowanceSetupPanel, renderFlatAllowance): the editable rule table.
   Edits change S.flatAllowanceDraft until Save Changes. */
import React from 'react';
import { cn } from '@/lib/cn';
import {
  BatchApi,
  S,
  changeFlatAllowanceField,
  getFlatAllowance,
  insertFlatAllowanceRow,
  saveFlatAllowance,
  useBatchVersion,
} from '@/features/batch/lib';
import type { Row } from '@/features/batch/lib';
import { actions, field, note, panel, setupButton, statusBar, table, tablePane, td, th, thead, toolbar, toolbarTitle, tr } from './setup-styles';

const FLAT_FIELDS: [string, string][] = [
  ['dyeingType', 'Dyeing Type'],
  ['flatType', 'Flat Knit Type'],
  ['range', 'Qty Range (Pcs)'],
  ['loss', 'Process Loss'],
];

export default function FlatAllowancePanel() {
  useBatchVersion();
  // The draft is built by renderFlatAllowance() right after the first render; until then the saved rules show.
  const rules: Row[] = S.flatAllowanceDraft ?? getFlatAllowance();
  const locked = S.mutationBusy || !S.storageReady;
  // Insert and Save need the Flat Allowance permission (the old page hid them with body.perm-no-flat).
  const canEdit = BatchApi.has('menus.dataManagement.flatAllowance');

  return (
    <div id="flatAllowanceSetupPanel" className={panel}>
      <div className={toolbar}>
        <div>
          <h2 className={toolbarTitle}>Flat Allowance</h2>
          <p className={note}>Edit any row, then Save Changes. A narrower range wins when rules overlap.</p>
        </div>
        <div className={actions}>
          {canEdit && (
            <button
              type="button"
              className={setupButton('success')}
              id="btnInsertAllowance"
              disabled={locked}
              onClick={() => insertFlatAllowanceRow()}
            >
              ＋ Insert New Row
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className={setupButton()}
              id="btnSaveAllowance"
              disabled={locked}
              onClick={() => void saveFlatAllowance()}
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
      <div className={statusBar} id="flatAllowanceStatus">
        {rules.length + ' rules · ' + (S.flatAllowanceDirty ? 'Unsaved changes' : 'Saved')}
      </div>
      <div className={tablePane}>
        <table className={cn(table, 'min-w-140')}>
          <thead className={thead}>
            <tr>
              <th className={th}>Dyeing Type</th>
              <th className={th}>Flat Knit Type</th>
              <th className={th}>Qty Range (Pcs)</th>
              <th className={th}>Process Loss</th>
            </tr>
          </thead>
          <tbody id="flatAllowanceRows">
            {rules.map((rule, index) => (
              <tr key={index} className={tr}>
                {FLAT_FIELDS.map(([key, label]) => (
                  <td key={key} className={td}>
                    <input
                      className={field}
                      data-flat-row={index}
                      data-flat-field={key}
                      aria-label={label + ' for rule ' + (index + 1)}
                      value={String(rule[key] ?? '')}
                      disabled={locked}
                      onChange={(event) => changeFlatAllowanceField(index, key, event.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
