'use client';

/* Dyeing MC panel (old #dyeingMCSetupPanel, renderMachineSetup): the editable machine table. Edits change
   S.setupDraft until Save Changes; the Not Possible Fabric cell opens the fabric picker dialog. */
import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import {
  BatchApi,
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
import { input } from '../ui/styles';
import { actions, field, panel, setupButton, statusBar, table, tablePane, td, th, thead, toolbar, toolbarTitle, tr } from './setup-styles';

/* Column widths at the table's narrowest width (their sum, the table's min width): sized for the longest values
   (EFL-EXT, Atmospheric, Thies-I-Master), so the table fits the page without a horizontal scrollbar from a
   1280 px wide window. On a wider page every column grows in proportion. */
const COLUMN_WIDTHS = [95, 75, 105, 120, 60, 70, 80, 225, 70];
const TABLE_MIN_WIDTH = COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);

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
  // Insert and Save need the Dyeing MC permission (the old page hid them with body.perm-no-dyeingmc).
  const canEdit = BatchApi.has('menus.dataManagement.dyeingMc');

  const insertRow = () => {
    focusNewRow.current = true;
    if (!insertMachineSetupRow()) focusNewRow.current = false;
  };

  return (
    <div className={panel} id="dyeingMCSetupPanel">
      <div className={toolbar}>
        <div>
          <h2 className={toolbarTitle}>Dyeing Machine Setup</h2>
          <p className="mx-0 mb-0 mt-1.5 text-[12.5px] text-[#64748b] dark:text-[#94a3b8]">
            Edit any cell or insert a new row, then click Save Changes.
          </p>
        </div>
        <div className={actions}>
          {canEdit && (
            <button type="button" className={setupButton('success')} id="btnInsertMachine" disabled={locked} onClick={insertRow}>
              ＋ Insert New Row
            </button>
          )}
          {canEdit && (
            <button type="button" className={setupButton()} id="btnSaveSetup" disabled={locked} onClick={() => void saveMachineSetup()}>
              Save Changes
            </button>
          )}
        </div>
      </div>
      <div className={statusBar}>
        <span id="setupRowCount">{rows.length + ' machines'}</span>
        <strong id="setupSaveStatus" className={S.setupDirty ? 'text-[#b45309]' : 'text-[#047857]'}>
          {statusText}
        </strong>
      </div>
      <div className={tablePane} tabIndex={0} aria-label="Dyeing machine setup">
        <table className={table} style={{ minWidth: TABLE_MIN_WIDTH }}>
          <colgroup>
            {COLUMN_WIDTHS.map((width, index) => (
              <col key={index} style={{ width: (width / TABLE_MIN_WIDTH) * 100 + '%' }} />
            ))}
          </colgroup>
          <thead className={thead}>
            <tr>
              <th className={th}>Dyeing Floor</th>
              <th className={th}>MC Type</th>
              <th className={th}>M/C Group</th>
              <th className={th}>MC Brand</th>
              <th className={th}>MC No.</th>
              <th className={th}>Capacity</th>
              <th className={th}>Collar Cuff</th>
              <th className={th}>Not Possible Fabric</th>
              <th className={th}>Loading</th>
            </tr>
          </thead>
          <tbody id="machineSetupRows" ref={rowsRef}>
            {rows.map((row, index) => (
              <tr key={index} className={tr}>
                {MACHINE_SETUP_FIELDS.map(([fieldName, label]) =>
                  fieldName === 'notPossibleFabric' ? (
                    <td key={fieldName} className={td}>
                      <FabricPickerCell row={row} index={index} />
                    </td>
                  ) : (
                    <td key={fieldName} className={td}>
                      <input
                        type="text"
                        className={field}
                        data-setup-row={index}
                        data-setup-field={fieldName}
                        value={String(row[fieldName] ?? '')}
                        aria-label={label + ' for row ' + (index + 1)}
                        disabled={locked}
                        onChange={(event) => changeMachineSetupField(index, fieldName, event.target.value)}
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

/** The Not Possible Fabric cell (old fabricPickerButton; old `.setup-input.fabric-picker-button`). */
function FabricPickerCell({ row, index }: { row: Row; index: number }) {
  const button = fabricPickerButton(row, index);
  return (
    <button
      type="button"
      className={cn(input, 'flex min-h-8 cursor-pointer items-center justify-between gap-2 whitespace-normal text-left')}
      data-fabric-picker={index}
      aria-label={button.ariaLabel}
      title={button.title}
      disabled={button.disabled}
      onClick={() => openFabricPicker(index)}
    >
      {button.label} <span className="flex-none">▾</span>
    </button>
  );
}
