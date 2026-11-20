import type { Scenario } from '../../harness/types';
import { forRoles } from './helpers';
import { T } from './texts';

// fin-basic (SYN-F1, General floor 'Floor-2', program type 'Prog-A'):
//   0 Red EFL/Solid    saved Tentative 11-01..11-05
//   1 Blue (no Unit/Process in Excel: Floor-2 / Prog-A from the General file; Floor-2 is not in the master list)
//   2 Green EKL/HTR    saved Confirm 11-02..11-03 under 'old_green_xyz' (matched by colour)
//   3 Red EKL/HTR      no own plan: takes row 0's saved plan (same colour), with its saved Unit/Process
const dept = 'finishing';

export const finishingScenarios: Scenario[] = [
  ...forRoles(() => ({
    name: 'load',
    dept,
    fixture: 'fin-basic',
    rules: ['GATE-05', 'GATE-06', 'GATE-08', 'AUTO-09', 'MATCH-02'],
    note: 'No Finishing input is ever disabled, not even a Confirm row for a non-admin.',
    steps: [{ do: 'load' }],
    expect: [
      { step: 1, field: [1, 'unit'], value: 'Floor-2' },
      { step: 1, field: [1, 'processName'], value: 'Prog-A' },
      { step: 1, field: [2, 'planType'], value: 'Confirm', disabled: false },
      { step: 1, field: [2, 'startDate'], value: '2026-11-02', disabled: false },
      { step: 1, field: [3, 'startDate'], value: '2026-11-01' },
      { step: 1, field: [3, 'processName'], value: 'Solid' },
      { step: 1, field: [0, 'endDate'], min: '2026-11-01' },
    ],
  })),

  ...forRoles(() => ({
    name: 'edits-copy-down-and-save',
    dept,
    fixture: 'fin-basic',
    rules: ['CHG-02', 'CAS-01', 'AUTO-03', 'AUTO-05', 'CHG-06', 'MATCH-04', 'SAVE-16', 'AUTO-09'],
    note: "Row 2's saved Confirm was found by colour, so SAVE-01 does not protect it; the save sends Unit/Process inside itemData and writes the rows under their new ids.",
    steps: [
      { do: 'load' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-11-03' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-11-01' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-11-08' },
      { do: 'set', row: 1, field: 'planType', value: 'Confirm' },
      { do: 'set', row: 0, field: 'unit', value: 'Unit-X' },
      { do: 'set', row: 0, field: 'startDate', value: '2026-11-04' },
      { do: 'set', row: 0, field: 'endDate', value: '' },
      { do: 'save' },
    ],
    expect: [
      { step: 3, toast: T.startAfterEnd },
      { step: 3, field: [1, 'endDate'], value: '' },
      { step: 5, field: [1, 'planType'], value: 'Confirm', disabled: false },
      { step: 6, field: [3, 'unit'], value: 'Unit-X' },
      { step: 7, field: [2, 'endDate'], value: '2026-11-04' },
      { step: 7, field: [2, 'planType'], value: 'Confirm' },
      { step: 8, toast: T.datesRequired },
      { step: 8, field: [2, 'planType'], value: '' },
      { step: 9, saved: true },
      { step: 9, body: { item: 2, key: 'itemId', equals: 'syn-f1_green_htr' } },
      { step: 9, body: { item: 1, key: 'itemId', equals: 'syn-f1_blue_' } },
      { step: 9, body: { item: 1, itemData: true, key: 'Unit', equals: 'Unit-X' } },
      { step: 9, body: { item: 1, itemData: true, key: 'ProcessName', equals: 'Prog-A' } },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'save01-confirm-changed',
    dept,
    fixture: 'fin-confirm',
    rules: ['SAVE-01', 'GATE-05'],
    steps: [{ do: 'load' }, { do: 'set', row: 0, field: 'planType', value: 'Tentative' }, { do: 'save' }],
    expect: [
      { step: 1, field: [0, 'planType'], value: 'Confirm', disabled: false },
      ...(isAdmin ? [{ step: 3, saved: true }] : [{ step: 3, saved: false }, { step: 3, toast: T.adminOnlyConfirm }]),
    ],
  })),
];
