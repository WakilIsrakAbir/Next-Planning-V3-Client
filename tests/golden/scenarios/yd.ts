import type { Scenario } from '../../harness/types';
import { forRoles } from './helpers';
import { T } from './texts';

// yd-basic (SYN-Y1):
//   0 Solid YDB-001   saved Tentative 10-10..10-20, no Floor dates (shown as -4 days: 10-06..10-16)
//   1 Stripe YDB-002  saved Confirm 10-12..10-22, Floor 10-01..10-05 Confirm (typed by hand), Barrier/Workable '40'/'35'
//   2 Solid YDB-003   not saved, Excel Barrier Qty. 50
//   3 Solid YDB-004   saved under 'legacy-ydb-004' (matched by YDB) Tentative 10-14..10-24
// Cells: 0 type, 1 YDB, 2 YD booking date, 3..12 inputs, 13 T&A start, 14 T&A end, 15 knit start, 16 knit end.
const dept = 'yd';

export const ydScenarios: Scenario[] = [
  ...forRoles(() => ({
    name: 'load',
    dept,
    fixture: 'yd-basic',
    rules: ['GATE-05', 'GATE-06', 'GATE-08', 'AUTO-08', 'MATCH-02', 'AUTO-10'],
    note: 'No YD input is ever disabled, not even a Confirm row for a non-admin.',
    steps: [{ do: 'load' }],
    expect: [
      { step: 1, field: [0, 'floorStartDate'], value: '2026-10-06' },
      { step: 1, field: [0, 'floorEndDate'], value: '2026-10-16', min: '2026-10-06' },
      { step: 1, field: [0, 'endDate'], min: '2026-10-10' },
      { step: 1, field: [1, 'floorStartDate'], value: '2026-10-01' },
      { step: 1, field: [1, 'planType'], value: 'Confirm', disabled: false, title: null },
      { step: 1, field: [1, 'startDate'], disabled: false },
      { step: 1, field: [3, 'startDate'], value: '2026-10-14' },
      { step: 1, field: [1, 'barrierQty'], value: '40' },
      { step: 1, field: [2, 'barrierQty'], value: '50' },
      { step: 1, field: [0, 'yarnOkDate'], value: '2026-10-08' },
      { step: 1, cell: [0, 13], text: '03-Oct-2026' },
      { step: 1, cell: [0, 15], text: '05-Oct-2026' },
      { step: 1, cell: [0, 16], text: '15-Oct-2026' },
    ],
  })),

  ...forRoles(() => ({
    name: 'auto04-floor-follows-dates',
    dept,
    fixture: 'yd-basic',
    rules: ['AUTO-04', 'AUTO-05', 'CHG-06', 'CAS-01', 'CHG-02'],
    note: 'Start/End changes rewrite the Floor dates (-4 days), also over Floor dates typed by hand; a failed row-0 End is cleared without touching the Floor End.',
    steps: [
      { do: 'load' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-10-14' },
      { do: 'set', row: 1, field: 'endDate', value: '' },
      { do: 'set', row: 0, field: 'startDate', value: '2026-10-11' },
      { do: 'set', row: 0, field: 'endDate', value: '2026-10-09' },
      { do: 'set', row: 0, field: 'endDate', value: '2026-10-25' },
    ],
    expect: [
      { step: 2, field: [1, 'floorStartDate'], value: '2026-10-10' },
      { step: 3, toast: T.datesRequired },
      { step: 3, field: [1, 'floorEndDate'], value: '' },
      { step: 3, field: [1, 'planType'], value: '' },
      { step: 4, field: [2, 'floorStartDate'], value: '2026-10-07' },
      { step: 4, field: [3, 'startDate'], value: '2026-10-11' },
      { step: 5, toast: T.startAfterEnd },
      { step: 5, field: [0, 'endDate'], value: '' },
      { step: 5, field: [0, 'floorEndDate'], value: '2026-10-16' },
      { step: 6, field: [2, 'floorEndDate'], value: '2026-10-21' },
      { step: 6, field: [1, 'endDate'], value: '2026-10-25' },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'auto06-plan-type-and-save01',
    dept,
    fixture: 'yd-basic',
    rules: ['AUTO-06', 'CHG-06', 'SAVE-01', 'GATE-05', 'SAVE-16'],
    note: 'YD has no Yarn or upstream rule for Confirm; a non-admin can change a Confirm row on screen but the save refuses it.',
    steps: [
      { do: 'load' },
      { do: 'set', row: 0, field: 'planType', value: 'Confirm' },
      { do: 'set', row: 1, field: 'planType', value: 'Tentative' },
      { do: 'save' },
    ],
    expect: [
      { step: 2, field: [1, 'planType'], value: 'Confirm' },
      { step: 2, field: [2, 'planType'], value: '' },
      { step: 2, field: [3, 'planType'], value: 'Confirm' },
      { step: 2, toast: T.datesRequired },
      { step: 3, field: [1, 'planType'], value: 'Tentative' },
      ...(isAdmin
        ? [
            { step: 4, saved: true },
            { step: 4, body: { item: 3, key: 'itemId', equals: 'syn-y1_solid_ydb-004' } },
            { step: 4, body: { item: 1, itemData: true, key: 'Barrier Qty.', equals: '40' } },
          ]
        : [{ step: 4, saved: false }, { step: 4, toast: T.adminOnlyConfirm }]),
    ],
  })),

  ...forRoles(() => ({
    name: 'auto10-quantities-floor-save04',
    dept,
    fixture: 'yd-basic',
    rules: ['AUTO-10', 'CAS-01', 'SAVE-04', 'SAVE-16', 'SAVE-17'],
    note: 'Yarn Ok Date copies down from row 0, Matching Option Date only on its row; Barrier/Workable Qty. never copy down and are sent as typed (strings).',
    steps: [
      { do: 'load' },
      { do: 'set', row: 0, field: 'yarnOkDate', value: '2026-10-07' },
      { do: 'set', row: 1, field: 'matchingOptionDate', value: '2026-10-11' },
      { do: 'set', row: 0, field: 'barrierQty', value: '120' },
      { do: 'set', row: 2, field: 'workableQty', value: '45.5' },
      { do: 'set', row: 2, field: 'floorStartDate', value: '2026-10-15' },
      { do: 'set', row: 2, field: 'floorEndDate', value: '2026-10-12' },
      { do: 'save' },
      { do: 'set', row: 2, field: 'floorEndDate', value: '2026-10-18' },
      { do: 'save' },
    ],
    expect: [
      { step: 2, field: [3, 'yarnOkDate'], value: '2026-10-07' },
      { step: 3, field: [1, 'matchingOptionDate'], value: '2026-10-11' },
      { step: 3, field: [2, 'matchingOptionDate'], value: '' },
      { step: 4, field: [0, 'barrierQty'], value: '120' },
      { step: 4, field: [1, 'barrierQty'], value: '40' },
      { step: 8, toast: T.endBeforeStart },
      { step: 8, saved: false },
      { step: 10, saved: true },
      { step: 10, body: { item: 0, key: 'barrierQty', equals: '120' } },
      { step: 10, body: { item: 0, itemData: true, key: 'Barrier Qty.', equals: '120' } },
      { step: 10, body: { item: 2, key: 'workableQty', equals: '45.5' } },
      { step: 10, body: { item: 2, key: 'barrierQty', equals: 50 } },
    ],
  })),

  ...forRoles(() => ({
    name: 'knit-plan-from-tna',
    dept,
    fixture: 'yd-noknit',
    rules: ['GATE-06'],
    note: "Without a saved Knitting plan the 'Knit Plan' columns show the General Knit T&A; an 'N/A' end shows as blank.",
    steps: [{ do: 'load' }],
    expect: [
      { step: 1, cell: [0, 15], text: '02-Oct-2026' },
      { step: 1, cell: [0, 16], text: '—' },
    ],
  })),
];
