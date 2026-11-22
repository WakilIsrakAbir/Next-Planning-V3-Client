import type { Scenario, Step } from '../../harness/types';
import { forRoles } from './helpers';
import { T } from './texts';

// deli-basic (SYN-L1), rows and their saved Dyeing row (matched by colour, or an itemId containing _<colour>_):
//   0 Red S/J     delivery: Floor 10-23..11-01 Tentative, main Tentative 10-26..11-05   dye Red Confirm 10-16..10-25
//   1 Blue S/J    no delivery (Floor defaults 10-24..11-02 Tentative)                    dye Blue Tentative 10-17..10-26
//   2 Green Rib   no delivery                                                            dye Green '' (start 10-18)
//   3 White Rib   no delivery                                                            no dye row
//   4 Grey Pique  no delivery (Floor type default Tentative, no dates)                   dye Grey Tentative, no dates
//   5 Navy S/J    delivery main Confirm 10-27..11-06, Floor empty (defaults)             dye 'Navy Blue' via itemId _navy_
//   6 Red Rib     no delivery (Floor defaults)                                           knit Red Rib (colour + construction)
//   7 Red Pique   no delivery (Floor defaults)                                           knit: no Red Pique -> first Red row
// Cells: 0 Color, 1 Construction, 2 GSM, 3..10 inputs, 11 dye start, 12 dye end, 13 dye type, 14 knit start, 15 knit end.
const dept = 'delivery';

// deli-saved-plan (SYN-L4; its rows are listed above gate03-saved-plan-exemption): with rows 1-3 cleared, a save goes
// through (gate03-saved-plan-exemption, step 6), so one value typed afterwards decides the save on its own.
const CLEAR_SAVED_ROWS: Step[] = [
  { do: 'load' },
  { do: 'set', row: 1, field: 'floorStartDate', value: '' },
  { do: 'set', row: 2, field: 'planType', value: '' },
  { do: 'set', row: 3, field: 'startDate', value: '' },
];

/**
 * SAVE-11: one Delivery value alone, on a row whose Dyeing plan type is blank, refuses the save; cleared again, the
 * save goes through. Admin types it into row 4 (no saved Delivery row, editable for Admin only); a non-admin into
 * row 1, which its saved Delivery plan keeps editable (GATE-03).
 */
function saveRefusedByOneValue(name: string, field: 'floorEndDate' | 'endDate' | 'startDate', value: string, label: string): Scenario[] {
  return forRoles((role, isAdmin) => {
    const row = isAdmin ? 4 : 1;
    return {
      name,
      dept,
      fixture: 'deli-saved-plan',
      rules: ['SAVE-11', 'SAVE-16', 'SAVE-17'],
      note: `A ${label} alone counts as Delivery input: rows 1-3 are cleared, then row ${row} gets only a ${label}, and the save is refused while the Dyeing plan type is blank. Cleared again, the save goes through.`,
      steps: [
        ...CLEAR_SAVED_ROWS,
        { do: 'set', row, field, value },
        { do: 'save' },
        { do: 'set', row, field, value: '' },
        { do: 'save' },
      ],
      expect: [
        { step: 5, field: [row, field], value, disabled: false },
        { step: 6, toast: T.saveDyeTypeMandatory },
        { step: 6, saved: false },
        { step: 8, saved: true },
        { step: 8, toast: T.saved('SYN-L4') },
        { step: 8, body: { item: row, key: field, equals: '' } },
      ],
    };
  });
}

export const deliveryScenarios: Scenario[] = [
  ...forRoles((role, isAdmin) => ({
    name: 'load',
    dept,
    fixture: 'deli-basic',
    rules: ['GATE-03', 'GATE-04', 'GATE-05', 'GATE-06', 'GATE-08', 'AUTO-07', 'MATCH-03'],
    steps: [{ do: 'load' }],
    expect: [
      { step: 1, field: [1, 'floorStartDate'], value: '2026-10-24' },
      { step: 1, field: [1, 'floorEndDate'], value: '2026-11-02', min: '2026-10-24' },
      { step: 1, field: [1, 'floorPlanType'], value: 'Tentative' },
      { step: 1, field: [5, 'floorStartDate'], value: '2026-10-27', disabled: false },
      { step: 1, field: [4, 'floorPlanType'], value: 'Tentative' },
      { step: 1, field: [4, 'floorStartDate'], value: '', disabled: false },
      { step: 1, field: [4, 'startDate'], disabled: true, title: T.dyeMissing },
      { step: 1, field: [2, 'floorStartDate'], disabled: !isAdmin, title: isAdmin ? null : T.dyeTypeMandatory },
      { step: 1, field: [2, 'startDate'], disabled: !isAdmin, title: isAdmin ? null : T.dyeTypeMandatory },
      { step: 1, field: [3, 'startDate'], disabled: true, title: isAdmin ? T.dyeMissing : T.dyeTypeMandatory },
      { step: 1, field: [3, 'floorStartDate'], disabled: !isAdmin },
      { step: 1, field: [5, 'startDate'], disabled: !isAdmin, title: isAdmin ? null : T.adminOnly },
      { step: 1, field: [0, 'limitation'], value: 'DLV-red', disabled: false },
      { step: 1, cell: [5, 13], text: '20-Oct-2026' },
      { step: 1, cell: [5, 15], text: 'Confirm' },
      { step: 1, cell: [2, 15], text: '-' },
    ],
  })),

  ...forRoles(() => ({
    name: 'floor-copy-down-and-save04',
    dept,
    fixture: 'deli-basic',
    rules: ['CAS-01', 'SAVE-04', 'GATE-08'],
    note: 'Row-0 Floor values are copied into every row (locked rows too); a Floor Confirm has no rule; Floor End before Floor Start is refused only at save.',
    steps: [
      { do: 'load' },
      { do: 'set', row: 0, field: 'floorStartDate', value: '2026-10-22' },
      { do: 'set', row: 0, field: 'floorPlanType', value: 'Confirm' },
      { do: 'set', row: 1, field: 'floorEndDate', value: '2026-10-20' },
      { do: 'save' },
    ],
    expect: [
      { step: 2, field: [2, 'floorStartDate'], value: '2026-10-22' },
      { step: 2, field: [7, 'floorStartDate'], value: '2026-10-22' },
      { step: 3, field: [3, 'floorPlanType'], value: 'Confirm' },
      { step: 3, noToast: true },
      { step: 4, field: [1, 'floorEndDate'], value: '2026-10-20' },
      { step: 4, field: [2, 'floorEndDate'], value: '' },
      { step: 5, toast: T.endBeforeStart },
      { step: 5, saved: false },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'chg11-plan-type-and-dates',
    dept,
    fixture: 'deli-basic',
    rules: ['CHG-11', 'CHG-01', 'CHG-02', 'CHG-06', 'AUTO-05', 'AUTO-06', 'GATE-05'],
    steps: [
      { do: 'load' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-10-27' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-10-26' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-11-04' },
      { do: 'set', row: 1, field: 'planType', value: 'Confirm' },
      { do: 'set', row: 1, field: 'planType', value: 'Tentative' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-11-06' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-10-20' },
      { do: 'set', row: 0, field: 'planType', value: 'Confirm' },
    ],
    expect: [
      { step: 3, toast: T.startAfterEnd },
      { step: 3, field: [1, 'endDate'], value: '' },
      { step: 5, toast: T.dyeTentativeOrBlank },
      { step: 5, field: [1, 'planType'], value: '' },
      { step: 6, field: [1, 'planType'], value: 'Tentative' },
      { step: 7, toast: T.startAfterEnd },
      { step: 7, field: [1, 'startDate'], value: '' },
      { step: 8, toast: T.datesRequired },
      { step: 8, field: [1, 'planType'], value: '' },
      { step: 9, field: [0, 'planType'], value: 'Confirm', disabled: !isAdmin },
      { step: 9, field: [5, 'planType'], value: 'Confirm' },
      { step: 9, field: [6, 'planType'], value: '' },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'save11-12-then-saved',
    dept,
    fixture: 'deli-basic',
    rules: isAdmin ? ['SAVE-11', 'SAVE-12', 'AUTO-07', 'SAVE-16', 'SAVE-17'] : ['SAVE-11', 'SAVE-12', 'CAS-01', 'SAVE-16', 'SAVE-17'],
    note: isAdmin
      ? 'Admin types Floor dates where the Dyeing type is blank (SAVE-11) or the Dyeing dates are missing (SAVE-12); the final save stores the Floor defaults nobody touched.'
      : 'A non-admin reaches the locked rows through the Row-1 copy-down (SAVE-11); clearing it clears the Floor defaults of every row before the save.',
    steps: isAdmin
      ? [
          { do: 'load' },
          { do: 'set', row: 2, field: 'floorStartDate', value: '2026-10-25' },
          { do: 'save' },
          { do: 'set', row: 2, field: 'floorStartDate', value: '' },
          { do: 'set', row: 4, field: 'floorStartDate', value: '2026-10-25' },
          { do: 'save' },
          { do: 'set', row: 4, field: 'floorStartDate', value: '' },
          { do: 'save' },
        ]
      : [
          { do: 'load' },
          { do: 'set', row: 0, field: 'floorStartDate', value: '2026-10-24' },
          { do: 'save' },
          { do: 'set', row: 0, field: 'floorStartDate', value: '' },
          { do: 'set', row: 4, field: 'floorStartDate', value: '2026-10-25' },
          { do: 'save' },
          { do: 'set', row: 4, field: 'floorStartDate', value: '' },
          { do: 'save' },
        ],
    expect: [
      { step: 3, toast: T.saveDyeTypeMandatory },
      { step: 3, saved: false },
      { step: 6, toast: T.saveDyeMissing },
      { step: 6, saved: false },
      { step: 8, saved: true },
      { step: 8, toast: T.saved('SYN-L1') },
      { step: 8, body: { item: 4, key: 'floorPlanType', equals: 'Tentative' } },
      { step: 8, body: { item: 1, key: 'floorEndDate', equals: '2026-11-02' } },
      { step: 8, body: { item: 1, key: 'floorStartDate', equals: isAdmin ? '2026-10-24' : '' } },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'save01-confirm-changed',
    dept,
    fixture: 'deli-basic',
    rules: ['SAVE-01', 'AUTO-06', 'CAS-01'],
    note: "Clearing row 0's plan type is copied into the saved Confirm row 5 (locked on screen for non-admins).",
    steps: [{ do: 'load' }, { do: 'set', row: 0, field: 'planType', value: '' }, { do: 'save' }],
    expect: [
      { step: 2, field: [5, 'planType'], value: '' },
      ...(isAdmin ? [{ step: 3, saved: true }] : [{ step: 3, saved: false }, { step: 3, toast: T.adminOnlyConfirm }]),
    ],
  })),

  ...forRoles(() => ({
    name: 'save13-14-legacy-rows',
    dept,
    fixture: 'deli-legacy',
    rules: ['SAVE-13', 'SAVE-14'],
    steps: [
      { do: 'load' },
      { do: 'save' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-10-18' },
      { do: 'save' },
      { do: 'set', row: 2, field: 'endDate', value: '2026-10-30' },
      { do: 'save' },
    ],
    expect: [
      { step: 2, toast: T.saveDeliStartBeforeDye },
      { step: 4, toast: T.saveDeliEndBeforeDye },
      { step: 6, saved: true },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'match03-empty-colour',
    dept,
    fixture: 'deli-match',
    rules: ['MATCH-03', 'MATCH-01', 'AUTO-07'],
    note: 'A row without a colour matches the saved Knitting and Dyeing rows whose colour is empty.',
    steps: isAdmin ? [{ do: 'load' }, { do: 'save' }] : [{ do: 'load' }],
    expect: [
      { step: 1, cell: [1, 13], text: '18-Oct-2026' },
      { step: 1, field: [1, 'floorStartDate'], value: '2026-10-25' },
      ...(isAdmin ? [{ step: 2, body: { item: 1, key: 'itemId', equals: 'syn-l3__s/j_160' } }] : []),
    ],
  })),

  // deli-saved-plan (SYN-L4): five Green rows; the saved Dyeing row (Green) has a BLANK plan type (10-18..10-27).
  //   0 S/J        saved Delivery: Floor plan type 'Tentative' only
  //   1 Rib        saved Delivery: Floor start 10-25 only
  //   2 Pique      saved Delivery: plan type 'Tentative' only
  //   3 Interlock  saved Delivery: start 10-26 only
  //   4 Fleece     no saved Delivery row
  ...forRoles((role, isAdmin) => ({
    name: 'gate03-saved-plan-exemption',
    dept,
    fixture: 'deli-saved-plan',
    rules: ['GATE-03', 'SAVE-11', 'SAVE-16', 'SAVE-17'],
    note: isAdmin
      ? 'Admin edits every row, whatever the Dyeing plan type. The save is refused while a row has Delivery input other than a Floor plan type (SAVE-11); once rows 1-3 are cleared it goes through.'
      : 'With a blank Dyeing plan type only a saved Delivery plan keeps a row editable for a non-admin, and any ONE of Floor plan type, Floor start, plan type or start is enough (rows 0-3); row 4, without one, is locked. Rows 1-3 are cleared and saved: their saved plan is then empty, so they lock too.',
    steps: [
      { do: 'load' },
      { do: 'save' },
      { do: 'set', row: 1, field: 'floorStartDate', value: '' },
      { do: 'set', row: 2, field: 'planType', value: '' },
      { do: 'set', row: 3, field: 'startDate', value: '' },
      { do: 'save' },
    ],
    expect: [
      { step: 1, field: [0, 'floorPlanType'], value: 'Tentative', disabled: false, title: null },
      { step: 1, field: [0, 'startDate'], value: '', disabled: false, title: null },
      { step: 1, field: [1, 'floorStartDate'], value: '2026-10-25', disabled: false, title: null },
      { step: 1, field: [1, 'planType'], value: '', disabled: false, title: null },
      { step: 1, field: [2, 'planType'], value: 'Tentative', disabled: false, title: null },
      { step: 1, field: [2, 'floorStartDate'], value: '', disabled: false, title: null },
      { step: 1, field: [3, 'startDate'], value: '2026-10-26', disabled: false, title: null },
      { step: 1, field: [3, 'floorPlanType'], value: '', disabled: false, title: null },
      { step: 1, field: [4, 'floorStartDate'], disabled: !isAdmin, title: isAdmin ? null : T.dyeTypeMandatory },
      { step: 1, field: [4, 'startDate'], disabled: !isAdmin, title: isAdmin ? null : T.dyeTypeMandatory },
      { step: 1, cell: [0, 15], text: '-' },
      { step: 2, toast: T.saveDyeTypeMandatory },
      { step: 2, saved: false },
      { step: 6, saved: true },
      { step: 6, toast: T.saved('SYN-L4') },
      { step: 6, body: { item: 0, key: 'floorPlanType', equals: 'Tentative' } },
      { step: 6, body: { item: 1, key: 'floorStartDate', equals: '' } },
      { step: 6, body: { item: 2, key: 'planType', equals: '' } },
      { step: 6, body: { item: 3, key: 'startDate', equals: '' } },
      { step: 6, field: [0, 'floorPlanType'], value: 'Tentative', disabled: false },
      { step: 6, field: [1, 'floorStartDate'], disabled: !isAdmin },
      { step: 6, field: [3, 'startDate'], disabled: !isAdmin },
    ],
  })),

  // legacy-placeholders (SYN-X1), delivery rows and their saved Dyeing row:
  //   0 Red S/J    no saved Delivery (Floor defaults +7 days)                  dye Red Confirm 10-16..10-25
  //   1 Navy S/J   no saved Delivery                                           dye Navy: plan type '-', start '-', end '-'
  //   2 Black S/J  saved Delivery Tentative 10-26..11-05, Floor 10-25..11-03   dye Black: plan type '-', 10-18..10-27
  ...forRoles((role, isAdmin) => ({
    name: 'legacy-dash-dyeing-plan',
    dept,
    fixture: 'legacy-placeholders',
    rules: ['GATE-03', 'GATE-04', 'CHG-11', 'SAVE-11'],
    note: isAdmin
      ? "A Dyeing start of '-' counts as missing: row 1's Start/End/Plan Type stay locked for Admin too. A Dyeing plan type of '-' counts as blank: row 2's Confirm is refused, and so is its save."
      : "A Dyeing plan type of '-' counts as blank: row 1 (no saved Delivery plan) is locked for a non-admin. Row 2 stays editable through its saved Delivery plan, but its Confirm is refused, and so is its save.",
    steps: [{ do: 'load' }, { do: 'set', row: 2, field: 'planType', value: 'Confirm' }, { do: 'save' }],
    expect: [
      { step: 1, field: [1, 'floorStartDate'], value: '', disabled: !isAdmin, title: isAdmin ? null : T.dyeTypeMandatory },
      { step: 1, field: [1, 'startDate'], disabled: true, title: isAdmin ? T.dyeMissing : T.dyeTypeMandatory },
      { step: 1, field: [2, 'startDate'], value: '2026-10-26', disabled: false, title: null },
      { step: 1, field: [0, 'floorStartDate'], value: '2026-10-23' },
      { step: 1, cell: [1, 13], text: '—' },
      { step: 1, cell: [1, 15], text: '-' },
      { step: 1, cell: [2, 15], text: '-' },
      { step: 2, toast: T.dyeTentativeOrBlank },
      { step: 2, field: [2, 'planType'], value: '' },
      { step: 3, toast: T.saveDyeTypeMandatory },
      { step: 3, saved: false },
    ],
  })),

  ...saveRefusedByOneValue('save11-floor-end-alone', 'floorEndDate', '2026-11-05', 'Floor End date'),
  ...saveRefusedByOneValue('save11-end-date-alone', 'endDate', '2026-11-05', 'End date'),
  ...saveRefusedByOneValue('save11-start-date-alone', 'startDate', '2026-10-28', 'Start date'),

  // legacy-save-placeholders (SYN-X2): row 0 Navy saved with Floor dates only (10-25..11-03 Tentative), under a Navy
  // Dyeing row typed Tentative whose start and end are '-'.
  ...forRoles(() => ({
    name: 'save12-legacy-dash-dyeing-start',
    dept,
    fixture: 'legacy-save-placeholders',
    rules: ['SAVE-12', 'GATE-04'],
    note: "A Dyeing start of '-' counts as missing at save too: the saved Floor dates are refused (SAVE-12), for Admin as well. The Dyeing plan type is set, so SAVE-11 passes and the Floor inputs stay editable; the main inputs are locked for everyone (GATE-04).",
    steps: [{ do: 'load' }, { do: 'save' }],
    expect: [
      { step: 1, field: [0, 'floorStartDate'], value: '2026-10-25', disabled: false },
      { step: 1, field: [0, 'startDate'], value: '', disabled: true, title: T.dyeMissing },
      { step: 1, cell: [0, 15], text: 'Tentative' },
      { step: 2, toast: T.saveDyeMissing },
      { step: 2, saved: false },
    ],
  })),

  // deli-equal-dates (SYN-L5), both Dyeing rows Confirm, both Delivery rows Tentative:
  //   0 Red S/J   delivery 10-16..10-25   dye 10-16..10-25 (saved on the boundary)
  //   1 Blue S/J  delivery 10-27..11-06   dye 10-17..10-26
  ...forRoles(() => ({
    name: 'save13-14-equal-dates',
    dept,
    fixture: 'deli-equal-dates',
    rules: ['SAVE-13', 'SAVE-14', 'SAVE-16', 'SAVE-17'],
    note: 'Whole days are compared, and a Delivery date equal to its Dyeing date is allowed. Row 0, saved exactly on its Dyeing dates, passes every save. Row 1 gets dates one day before its Dyeing dates (no check on change): the save is refused, first for the Start, then, with the Start equal, for the End; with both equal it goes through.',
    steps: [
      { do: 'load' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-10-16' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-10-25' },
      { do: 'save' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-10-17' },
      { do: 'save' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-10-26' },
      { do: 'save' },
    ],
    expect: [
      { step: 1, field: [0, 'startDate'], value: '2026-10-16', disabled: false },
      { step: 1, field: [1, 'startDate'], value: '2026-10-27', disabled: false },
      { step: 1, field: [1, 'endDate'], value: '2026-11-06', disabled: false },
      { step: 1, cell: [1, 13], text: '17-Oct-2026' },
      { step: 1, cell: [1, 14], text: '26-Oct-2026' },
      { step: 2, noToast: true },
      { step: 2, field: [1, 'startDate'], value: '2026-10-16' },
      { step: 3, noToast: true },
      { step: 3, field: [1, 'endDate'], value: '2026-10-25' },
      { step: 4, toast: T.saveDeliStartBeforeDye },
      { step: 4, saved: false },
      { step: 5, noToast: true },
      { step: 5, field: [1, 'startDate'], value: '2026-10-17' },
      { step: 6, toast: T.saveDeliEndBeforeDye },
      { step: 6, saved: false },
      { step: 7, field: [1, 'endDate'], value: '2026-10-26' },
      { step: 8, saved: true },
      { step: 8, toast: T.saved('SYN-L5') },
      { step: 8, body: { item: 0, key: 'startDate', equals: '2026-10-16' } },
      { step: 8, body: { item: 0, key: 'endDate', equals: '2026-10-25' } },
      { step: 8, body: { item: 1, key: 'startDate', equals: '2026-10-17' } },
      { step: 8, body: { item: 1, key: 'endDate', equals: '2026-10-26' } },
    ],
  })),
];
