'use client';

/* Dyeing MC panel (old #dyeingMCSetupPanel, renderMachineSetup): the editable machine table. Edits change
   S.setupDraft until Save Changes; the Not Possible Fabric cell opens the fabric picker dialog. */
import React, { useEffect, useRef } from 'react';
import {
  MACHINE_SETUP_FIELDS,
  S,
  changeMachineSetupField,
  fabricPickerButton,
  getMachineSetup,
  insertMachineSetupRow,
  openFabricPicker,
  saveMachineSetup,
  useBatchVersion,
} from '@/features/batch/lib';
import type { Row } from '@/features/batch/lib';

const COLUMN_WIDTHS = [100, 95, 130, 160, 75, 100, 105, 330, 100];

export default function MachineSetupPanel() {
  useBatchVersion();
  const rowsRef = useRef<HTMLTableSectionElement>(null);
  const focusNewRow = useRef(false);

  // After Insert New Row: the new row is scrolled into view and its first input focused (old listener).
  useEffect(() => {
    if (!focusNewRow.current) return;
    focusNewRow.current = false;
    const newRow = rowsRef.current?.lastElementChild as HTMLElement | null | undefined;
    if (!newRow) return;
    if (typeof newRow.scrollIntoView === 'function') newRow.scrollIntoView({ block: 'nearest' });
    const firstInput = newRow.querySelector('input');
    if (firstInput && typeof firstInput.focus === 'function') firstInput.focus();
  });

  // The draft is built by renderMachineSetup() right after the first render; until then the saved rows show.
  const rows: Row[] = S.setupDraft ?? getMachineSetup();
  const locked = S.mutationBusy || !S.storageReady;
  const statusText = String(S.ui.setupSaveStatus || (S.setupDirty ? 'Unsaved changes' : 'Saved'));

  const insertRow = () => {
    focusNewRow.current = true;
    if (!insertMachineSetupRow()) focusNewRow.current = false;
  };

  return (
    <div className="card" id="dyeingMCSetupPanel">
      <div className="setup-toolbar">
        <div>
          <h2 style={{ margin: 0, fontSize: 17 }}>Dyeing Machine Setup</h2>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#64748b' }}>Edit any cell or insert a new row, then click Save Changes.</p>
        </div>
        <div className="btn-group-actions">
          <button type="button" className="btn success" id="btnInsertMachine" disabled={locked} onClick={insertRow}>
            ＋ Insert New Row
          </button>
          <button type="button" className="btn" id="btnSaveSetup" disabled={locked} onClick={() => void saveMachineSetup()}>
            Save Changes
          </button>
        </div>
      </div>
      <div className="setup-status-bar">
        <span id="setupRowCount">{rows.length + ' machines'}</span>
        <strong id="setupSaveStatus" style={{ color: S.setupDirty ? '#b45309' : '#047857' }}>
          {statusText}
        </strong>
      </div>
      <div className="table-wrap freeze-pane" tabIndex={0} aria-label="Dyeing machine setup">
        <table className="setup-table">
          <colgroup>
            {COLUMN_WIDTHS.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>Dyeing Floor</th>
              <th>MC Type</th>
              <th>M/C Group</th>
              <th>MC Brand</th>
              <th>MC No.</th>
              <th>Capacity</th>
              <th>Collar Cuff</th>
              <th>Not Possible Fabric</th>
              <th>Loading</th>
            </tr>
          </thead>
          <tbody id="machineSetupRows" ref={rowsRef}>
            {rows.map((row, index) => (
              <tr key={index}>
                {MACHINE_SETUP_FIELDS.map(([field, label]) =>
                  field === 'notPossibleFabric' ? (
                    <td key={field}>
                      <FabricPickerCell row={row} index={index} />
                    </td>
                  ) : (
                    <td key={field}>
                      <input
                        type="text"
                        className="setup-input"
                        data-setup-row={index}
                        data-setup-field={field}
                        value={String(row[field] ?? '')}
                        aria-label={label + ' for row ' + (index + 1)}
                        disabled={locked}
                        onChange={(event) => changeMachineSetupField(index, field, event.target.value)}
                      />
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The Not Possible Fabric cell (old fabricPickerButton). */
function FabricPickerCell({ row, index }: { row: Row; index: number }) {
  const button = fabricPickerButton(row, index);
  return (
    <button
      type="button"
      className="setup-input fabric-picker-button"
      data-fabric-picker={index}
      aria-label={button.ariaLabel}
      title={button.title}
      disabled={button.disabled}
      onClick={() => openFabricPicker(index)}
    >
      {button.label} <span>▾</span>
    </button>
  );
}
