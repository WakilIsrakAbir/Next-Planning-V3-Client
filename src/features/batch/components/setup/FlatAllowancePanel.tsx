'use client';

/* Flat Allowance panel (old #flatAllowanceSetupPanel, renderFlatAllowance): the editable rule table.
   Edits change S.flatAllowanceDraft until Save Changes. */
import React from 'react';
import {
  S,
  changeFlatAllowanceField,
  getFlatAllowance,
  insertFlatAllowanceRow,
  saveFlatAllowance,
  useBatchVersion,
} from '@/features/batch/lib';
import type { Row } from '@/features/batch/lib';

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

  return (
    <div id="flatAllowanceSetupPanel" className="card">
      <div className="setup-toolbar">
        <div>
          <h2 style={{ margin: 0, fontSize: 17 }}>Flat Allowance</h2>
          <p className="component-note">Edit any row, then Save Changes. A narrower range wins when rules overlap.</p>
        </div>
        <div className="btn-group-actions">
          <button type="button" className="btn success" id="btnInsertAllowance" disabled={locked} onClick={() => insertFlatAllowanceRow()}>
            ＋ Insert New Row
          </button>
          <button type="button" className="btn" id="btnSaveAllowance" disabled={locked} onClick={() => void saveFlatAllowance()}>
            Save Changes
          </button>
        </div>
      </div>
      <div className="setup-status-bar" id="flatAllowanceStatus">
        {rules.length + ' rules · ' + (S.flatAllowanceDirty ? 'Unsaved changes' : 'Saved')}
      </div>
      <div className="table-wrap freeze-pane">
        <table className="setup-table">
          <thead>
            <tr>
              <th>Dyeing Type</th>
              <th>Flat Knit Type</th>
              <th>Qty Range (Pcs)</th>
              <th>Process Loss</th>
            </tr>
          </thead>
          <tbody id="flatAllowanceRows">
            {rules.map((rule, index) => (
              <tr key={index}>
                {FLAT_FIELDS.map(([key, label]) => (
                  <td key={key}>
                    <input
                      className="setup-input"
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
