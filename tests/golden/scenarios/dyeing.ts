import type { Scenario } from '../../harness/types';
import { forRoles } from './helpers';
import { T } from './texts';

// dye-basic (SYN-D1), rows and their saved Knitting row (matched by colour):
//   0 Red   EFL/Solid        dyeing Tentative 10-16..10-25   knit Confirm 10-05..10-15
//   1 Blue  EKL/HTR          no dyeing                       knit Tentative 10-06..10-16
//   2 Green EFL/Dyeing Wash  dyeing '' 10-19..10-27          knit blank
//   3 White (no unit/process) no dyeing                      no knit row
//   4 Navy  Ext/Pluvia       dyeing '' start 10-18           knit '-' 10-07..10-17
//   5 Black EFL/Solid        dyeing Confirm 10-20..10-28     knit Confirm 10-08..10-18
//   6 Grey  EFL/Solid        no dyeing                       knit blank
const dept = 'dyeing';

export const dyeingScenarios: Scenario[] = [
  ...forRoles((role, isAdmin) => ({
    name: 'load',
    dept,
    fixture: 'dye-basic',
    rules: ['GATE-01', 'GATE-02', 'GATE-05', 'GATE-06', 'GATE-08', 'MATCH-03', 'AUTO-09', 'STAT-01'],
    steps: [{ do: 'load' }],
    expect: [
      { step: 1, field: [3, 'startDate'], disabled: true, title: isAdmin ? T.unitProcessFirst : T.knitTypeMandatory },
      { step: 1, field: [3, 'limitation'], disabled: true },
      { step: 1, field: [3, 'unit'], value: '', disabled: false },
      { step: 1, field: [6, 'startDate'], disabled: !isAdmin, title: isAdmin ? null : T.knitTypeMandatory },
      { step: 1, field: [6, 'limitation'], disabled: false },
      { step: 1, field: [5, 'startDate'], disabled: !isAdmin, title: isAdmin ? null : T.adminOnly },
      { step: 1, field: [2, 'startDate'], disabled: false },
      { step: 1, field: [4, 'startDate'], disabled: false },
      { step: 1, field: [1, 'startDate'], disabled: false },
      { step: 1, field: [0, 'endDate'], min: '2026-10-16' },
      { step: 1, field: [1, 'unit'], value: 'EKL' },
      { step: 1, cell: [0, 3], text: '05-Oct-2026' },
      { step: 1, cell: [0, 5], text: 'Confirm' },
      { step: 1, cell: [0, 6], text: 'KL-red' },
      { step: 1, cell: [3, 3], text: '—' },
      { step: 1, cell: [3, 5], text: '-' },
      { step: 1, status: 'Pending' },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'gate01-unit-process',
    dept,
    fixture: 'dye-basic',
    rules: ['GATE-01', 'GATE-02', 'CAS-01', 'AUTO-09'],
    note: 'Row 3 opens once Unit and Process Name are both set; row-0 Unit/Process changes are copied into every row.',
    steps: [
      { do: 'load' },
      { do: 'set', row: 3, field: 'unit', value: 'EFL' },
      { do: 'set', row: 3, field: 'processName', value: 'Solid' },
      { do: 'set', row: 0, field: 'processName', value: 'Process-X' },
      { do: 'set', row: 0, field: 'unit', value: '' },
    ],
    expect: [
      { step: 2, field: [3, 'limitation'], disabled: true },
      { step: 3, field: [3, 'limitation'], disabled: false },
      { step: 3, field: [3, 'startDate'], disabled: !isAdmin, title: isAdmin ? null : T.knitTypeMandatory },
      { step: 4, field: [6, 'processName'], value: 'Process-X' },
      { step: 4, field: [3, 'processName'], value: 'Process-X' },
      { step: 5, field: [1, 'unit'], value: '' },
      { step: 5, field: [1, 'startDate'], disabled: true, title: T.unitProcessFirst },
      { step: 5, field: [5, 'startDate'], disabled: true, title: T.unitProcessFirst },
      { step: 5, field: [5, 'remarks'], disabled: true },
    ],
  })),

  ...forRoles(() => ({
    name: 'chg01-05-date-checks',
    dept,
    fixture: 'dye-basic',
    rules: ['CHG-01', 'CHG-02', 'CHG-03', 'CHG-04', 'CHG-05'],
    note: 'Row 2 has a saved Dyeing plan but a blank Knitting plan: both an End change (step 9) and a Start change (step 10) are refused and cleared.',
    steps: [
      { do: 'load' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-10-05' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-10-17' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-10-12' },
      { do: 'set', row: 1, field: 'startDate', value: '' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-10-12' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-10-20' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-10-21' },
      { do: 'set', row: 2, field: 'endDate', value: '2026-10-28' },
      { do: 'set', row: 2, field: 'startDate', value: '2026-10-20' },
    ],
    expect: [
      { step: 2, toast: T.dyeStartBeforeKnit },
      { step: 2, field: [1, 'startDate'], value: '' },
      { step: 3, field: [1, 'startDate'], value: '2026-10-17' },
      { step: 4, toast: T.startAfterEnd },
      { step: 4, field: [1, 'endDate'], value: '' },
      { step: 6, toast: T.dyeEndBeforeKnit },
      { step: 6, field: [1, 'endDate'], value: '' },
      { step: 7, field: [1, 'endDate'], value: '2026-10-20' },
      { step: 8, toast: T.startAfterEnd },
      { step: 9, toast: T.knitBlank },
      { step: 9, field: [2, 'endDate'], value: '' },
      { step: 9, field: [2, 'startDate'], value: '2026-10-19' },
      { step: 10, toast: T.knitBlank },
      { step: 10, field: [2, 'startDate'], value: '', disabled: false },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'chg06-08-09-plan-type',
    dept,
    fixture: 'dye-basic',
    rules: ['CHG-06', 'CHG-08', 'CHG-09', 'AUTO-06', 'GATE-05'],
    steps: [
      { do: 'load' },
      { do: 'set', row: 1, field: 'planType', value: 'Tentative' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-10-17' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-10-24' },
      { do: 'set', row: 1, field: 'planType', value: 'Confirm' },
      { do: 'set', row: 1, field: 'planType', value: 'Tentative' },
      { do: 'set', row: 2, field: 'planType', value: 'Tentative' },
      { do: 'set', row: 0, field: 'planType', value: 'Confirm' },
    ],
    expect: [
      { step: 2, toast: T.datesRequired },
      { step: 2, field: [1, 'planType'], value: '' },
      { step: 5, toast: T.knitTentative },
      { step: 5, field: [1, 'planType'], value: '' },
      { step: 6, field: [1, 'planType'], value: 'Tentative' },
      { step: 7, toast: T.knitBlank },
      { step: 7, field: [2, 'planType'], value: '' },
      { step: 8, field: [0, 'planType'], value: 'Confirm', disabled: !isAdmin },
      { step: 8, field: [1, 'planType'], value: '' },
      { step: 8, field: [5, 'planType'], value: 'Confirm' },
      { step: 8, field: [6, 'planType'], value: '' },
    ],
  })),

  ...forRoles(() => ({
    name: 'chg10-final-confirmation-no',
    dept,
    fixture: 'dye-finalno',
    rules: ['CHG-10', 'AUTO-05', 'CAS-01', 'SAVE-08'],
    note: "Final Confirmation 'No': Confirm is refused, and a row-0 date copied into the saved Confirm row drops it. The copy also fills rows that are locked on screen.",
    steps: [
      { do: 'load' },
      { do: 'set', row: 0, field: 'planType', value: 'Confirm' },
      { do: 'set', row: 0, field: 'startDate', value: '2026-10-17' },
      { do: 'save' },
    ],
    expect: [
      { step: 2, toast: T.finalConfNo },
      { step: 2, field: [0, 'planType'], value: '' },
      { step: 3, toast: T.finalConfNo },
      { step: 3, field: [5, 'planType'], value: '' },
      { step: 3, field: [3, 'startDate'], value: '2026-10-17' },
      { step: 3, field: [6, 'startDate'], value: '2026-10-17' },
      { step: 4, toast: T.saveKnitTypeMandatory },
      { step: 4, saved: false },
    ],
  })),

  ...forRoles(() => ({
    name: 'save08-ladder-then-saved',
    dept,
    fixture: 'dye-basic',
    rules: ['SAVE-08', 'SAVE-16', 'SAVE-17', 'AUTO-09', 'MATCH-01', 'STAT-01'],
    note: "Rows with dyeing input but a blank (or '-') Knitting type block the whole save; once cleared, the save sends Unit/Process inside itemData.",
    steps: [
      { do: 'load' },
      { do: 'save' },
      { do: 'set', row: 2, field: 'startDate', value: '' },
      { do: 'set', row: 2, field: 'endDate', value: '' },
      { do: 'save' },
      { do: 'set', row: 4, field: 'startDate', value: '' },
      { do: 'save' },
    ],
    expect: [
      { step: 2, toast: T.saveKnitTypeMandatory },
      { step: 5, toast: T.saveKnitTypeMandatory },
      { step: 7, saved: true },
      { step: 7, toast: T.saved('SYN-D1') },
      { step: 7, body: { key: 'orderStatus', equals: 'Pending' } },
      { step: 7, body: { item: 0, itemData: true, key: 'ProcessName', equals: 'Solid' } },
      { step: 7, body: { item: 0, itemData: true, key: 'Process Name', equals: 'Solid' } },
      { step: 7, body: { item: 1, itemData: true, key: 'Unit', equals: 'EKL' } },
      { step: 7, body: { item: 3, key: 'itemId', equals: 'syn-d1_white_' } },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'save09-10-01-legacy-rows',
    dept,
    fixture: 'dye-legacy',
    rules: ['SAVE-09', 'SAVE-10', 'SAVE-01', 'AUTO-06', 'CAS-01'],
    note: "Rows saved before their Knitting dates are refused at save; clearing row 0's plan type is copied into the saved Confirm row 3, which only Admin may save.",
    steps: [
      { do: 'load' },
      { do: 'save' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-10-07' },
      { do: 'save' },
      { do: 'set', row: 2, field: 'endDate', value: '2026-10-19' },
      { do: 'set', row: 0, field: 'planType', value: '' },
      { do: 'save' },
    ],
    expect: [
      { step: 2, toast: T.saveDyeStartBeforeKnit },
      { step: 4, toast: T.saveDyeEndBeforeKnit },
      { step: 6, field: [3, 'planType'], value: '' },
      ...(isAdmin ? [{ step: 7, saved: true }] : [{ step: 7, saved: false }, { step: 7, toast: T.adminOnlyConfirm }]),
    ],
  })),

  // dye-match (SYN-D4): rows 1 and 2 carry their own itemId, equal to a saved Delivery row's id.
  //   0 Red   syn-d4_red_solid    dyeing Tentative 10-16..10-25   no Delivery row
  //   1 Blue  d4-blue-own         dyeing Tentative 10-17..10-26   Delivery Confirm (Floor Tentative)
  //   2 Green d4-green-own        dyeing Tentative 10-18..10-27   Delivery Tentative, Floor Confirm
  //   3 Navy  syn-d4_navy_pluvia  dyeing Tentative 10-19..10-28   Delivery Confirm saved as 'syn-d4_navy_pluvia_'
  ...forRoles((role, isAdmin) =>
    isAdmin
      ? {
          name: 'save02-next-confirmed',
          dept,
          fixture: 'dye-match',
          rules: ['SAVE-02', 'MATCH-01'],
          note: 'Admin is exempt from the next-department lock: the Start change of the row whose Delivery row is Confirm is saved.',
          steps: [{ do: 'load' }, { do: 'set', row: 1, field: 'startDate', value: '2026-10-18' }, { do: 'save' }],
          expect: [
            { step: 1, field: [1, 'startDate'], value: '2026-10-17', disabled: false },
            { step: 3, saved: true },
            { step: 3, toast: T.saved('SYN-D4') },
            { step: 3, body: { item: 1, key: 'itemId', equals: 'd4-blue-own' } },
            { step: 3, body: { item: 1, key: 'startDate', equals: '2026-10-18' } },
          ],
        }
      : {
          name: 'save02-next-confirmed',
          dept,
          fixture: 'dye-match',
          rules: ['SAVE-02', 'MATCH-01', 'MATCH-04'],
          note: "A non-admin may not change Start, End or Plan Type of a row whose saved Delivery row (same exact itemId) is Confirm. The lock reads the Delivery main plan type, not the Floor plan type (row 2), and the exact itemId only (row 3's Delivery row has a trailing '_'). Remarks are not checked.",
          steps: [
            { do: 'load' },
            { do: 'set', row: 2, field: 'startDate', value: '2026-10-19' },
            { do: 'set', row: 3, field: 'startDate', value: '2026-10-20' },
            { do: 'save' },
            { do: 'set', row: 1, field: 'startDate', value: '2026-10-18' },
            { do: 'save' },
            { do: 'set', row: 1, field: 'startDate', value: '2026-10-17' },
            { do: 'set', row: 1, field: 'remarks', value: 'remarks only' },
            { do: 'save' },
          ],
          expect: [
            { step: 1, field: [1, 'startDate'], value: '2026-10-17', disabled: false },
            { step: 4, saved: true },
            { step: 4, toast: T.saved('SYN-D4') },
            { step: 4, body: { item: 2, key: 'startDate', equals: '2026-10-19' } },
            { step: 4, body: { item: 3, key: 'startDate', equals: '2026-10-20' } },
            { step: 6, toast: T.nextConfirmed('dyeing') },
            { step: 6, saved: false },
            { step: 6, field: [1, 'startDate'], value: '2026-10-18' },
            { step: 9, saved: true },
            { step: 9, toast: T.saved('SYN-D4') },
            { step: 9, body: { item: 1, key: 'itemId', equals: 'd4-blue-own' } },
            { step: 9, body: { item: 1, key: 'remarks', equals: 'remarks only' } },
            { step: 9, body: { item: 1, key: 'startDate', equals: '2026-10-17' } },
          ],
        }
  ),

  ...forRoles(() => ({
    name: 'dropdowns-request-failed',
    dept,
    fixture: 'dye-basic',
    rules: ['AUTO-09'],
    note: 'GET /api/dropdowns fails: the Unit and Process lists keep the built-in defaults.',
    steps: [{ do: 'load', replyDropdowns: { status: 500, json: { message: 'Failed to fetch dropdown options.' } } }],
    expect: [{ step: 1, field: [1, 'unit'], value: 'EKL' }],
  })),

  {
    id: 'dyeing/roles-approver-is-admin/approver',
    dept,
    fixture: 'dye-basic',
    role: 'approver',
    rules: ['GATE-02', 'GATE-05'],
    note: 'Approver passes the Knitting-type lock and the Confirm lock like Admin.',
    steps: [{ do: 'load' }],
    expect: [
      { step: 1, field: [6, 'startDate'], disabled: false },
      { step: 1, field: [5, 'startDate'], disabled: false },
    ],
  },
];
