'use client';

/* Unit Setup panel (old #unitSetupPanel, renderUnitSetup): one row per buyer of the latest uploaded files with
   its default unit, chosen from the ACTIVE units of Dropdown Master Setup. Changes stay in S.unitSetupDraft
   until Save Changes. */
import React from 'react';
import { cn } from '@/lib/cn';
import {
  BatchApi,
  S,
  changeUnitSetupDefault,
  changeUnitSetupSearch,
  saveUnitSetup,
  unitSetupOptions,
  unitSetupTableView,
  useBatchVersion,
} from '@/features/batch/lib';
import { card } from '../ui/styles';
import {
  field,
  note,
  plainField,
  setupButton,
  statusBar,
  table,
  tablePane,
  td,
  th,
  thead,
  toolbar,
  toolbarTitle,
  tr,
} from './setup-styles';

export default function UnitSetupPanel() {
  useBatchVersion();
  const view = unitSetupTableView();

  return (
    <div id="unitSetupPanel" className={card}>
      <div className={toolbar}>
        <div>
          <h2 className={toolbarTitle}>Unit Setup</h2>
          <p className={note}>
            Every buyer in the latest uploaded files. Choose a default unit from the active units in Dropdown Master Setup, then Save Changes.
          </p>
        </div>
        {/* Save needs the Unit Setup permission (the old page hid it with body.perm-no-unit). */}
        {BatchApi.has('menus.dataManagement.unitSetup') && (
          <button
            type="button"
            id="btnSaveUnitSetup"
            className={setupButton()}
            disabled={S.mutationBusy || !S.storageReady}
            onClick={() => void saveUnitSetup()}
          >
            Save Changes
          </button>
        )}
      </div>
      {/* Paragraph margins of the browser default (1em). */}
      <p className="my-[1em]">
        <input
          id="unitSetupSearch"
          type="search"
          className={plainField}
          placeholder="Search buyer or unit"
          aria-label="Search Unit Setup"
          value={String(S.ui.setupUnitSearch ?? '')}
          onChange={(event) => changeUnitSetupSearch(event.target.value)}
        />
      </p>
      <p id="unitSetupStatus" className={cn(statusBar, 'my-[1em]')}>
        {view.status}
      </p>
      <div className={tablePane}>
        <table className={table}>
          <thead className={thead}>
            <tr>
              <th className={th}>Buyer</th>
              <th className={th}>Default Unit</th>
            </tr>
          </thead>
          <tbody id="unitSetupRows">
            {view.rows.length ? (
              view.rows.map((row) => {
                const options = unitSetupOptions(row.value);
                // The browser showed the last <option selected>, or the first option when none had it.
                const selected = options.filter((option) => option.selected).pop()?.value ?? '';
                return (
                  <tr key={row.key} className={tr}>
                    <td className={td}>{row.buyer}</td>
                    <td className={td}>
                      <select
                        className={field}
                        data-unit-buyer={row.key}
                        aria-label={'Default Unit for ' + row.buyer}
                        disabled={view.locked}
                        value={selected}
                        onChange={(event) => changeUnitSetupDefault(row.key, event.target.value)}
                      >
                        {options.map((option, index) => (
                          <option key={index} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className={tr}>
                <td colSpan={2} className={td}>
                  No matching buyer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
