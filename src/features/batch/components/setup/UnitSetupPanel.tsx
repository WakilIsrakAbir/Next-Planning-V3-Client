'use client';

/* Unit Setup panel (old #unitSetupPanel, renderUnitSetup): one row per buyer with its default unit, chosen from
   the ACTIVE units of Dropdown Master Setup. Changes stay in S.unitSetupDraft until Save Changes. */
import React from 'react';
import {
  S,
  changeUnitSetupDefault,
  changeUnitSetupSearch,
  saveUnitSetup,
  unitSetupOptions,
  unitSetupTableView,
  useBatchVersion,
} from '@/features/batch/engine';

export default function UnitSetupPanel() {
  useBatchVersion();
  const view = unitSetupTableView();

  return (
    <div id="unitSetupPanel" className="card">
      <div className="setup-toolbar">
        <div>
          <h2 style={{ margin: 0, fontSize: 17 }}>Unit Setup</h2>
          <p className="component-note">
            Every buyer in the uploaded orders. Choose a default unit from the active units in Dropdown Master Setup, then Save Changes.
          </p>
        </div>
        <button
          type="button"
          id="btnSaveUnitSetup"
          className="btn"
          disabled={S.mutationBusy || !S.storageReady}
          onClick={() => void saveUnitSetup()}
        >
          Save Changes
        </button>
      </div>
      <p>
        <input
          id="unitSetupSearch"
          type="search"
          placeholder="Search buyer or unit"
          aria-label="Search Unit Setup"
          value={String(S.ui.setupUnitSearch ?? '')}
          onChange={(event) => changeUnitSetupSearch(event.target.value)}
        />
      </p>
      <p id="unitSetupStatus" className="setup-status-bar">
        {view.status}
      </p>
      <div className="table-wrap freeze-pane">
        <table className="setup-table">
          <thead>
            <tr>
              <th>Buyer</th>
              <th>Default Unit</th>
            </tr>
          </thead>
          <tbody id="unitSetupRows">
            {view.rows.length ? (
              view.rows.map((row) => {
                const options = unitSetupOptions(row.value);
                // The browser showed the last <option selected>, or the first option when none had it.
                const selected = options.filter((option) => option.selected).pop()?.value ?? '';
                return (
                  <tr key={row.key}>
                    <td>{row.buyer}</td>
                    <td>
                      <select
                        className="setup-input"
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
              <tr>
                <td colSpan={2}>No matching buyer.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
