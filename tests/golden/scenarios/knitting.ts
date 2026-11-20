import type { Scenario } from '../../harness/types';
import { forRoles } from './helpers';
import { T } from './texts';

// knit-basic (SYN-K1): row 0 Red Tentative 10-05..10-15 (yarn 10-01), row 1 Blue Confirm 10-06..10-16 (yarn 10-01),
// row 2 Green: end 10-09 only, no yarn date, no plan type.
const dept = 'knitting';

export const knittingScenarios: Scenario[] = [
  ...forRoles((role, isAdmin) => ({
    name: 'load',
    dept,
    fixture: 'knit-basic',
    rules: ['GATE-05', 'GATE-06', 'GATE-07', 'GATE-08', 'STAT-01'],
    steps: [{ do: 'load' }],
    expect: [
      { step: 1, field: [1, 'startDate'], disabled: !isAdmin, title: isAdmin ? null : T.adminOnly },
      { step: 1, field: [1, 'planType'], disabled: !isAdmin },
      { step: 1, field: [1, 'yarnDate'], disabled: false },
      { step: 1, field: [1, 'limitation'], disabled: false },
      { step: 1, field: [0, 'startDate'], min: '2026-10-01' },
      { step: 1, field: [0, 'endDate'], min: '2026-10-05' },
      { step: 1, field: [2, 'endDate'], min: null },
      { step: 1, field: [0, 'yarnDate'], title: T.rowOneHint },
      { step: 1, status: 'On Process' },
    ],
  })),

  ...forRoles(() => ({
    name: 'chg01-02-date-order',
    dept,
    fixture: 'knit-basic',
    rules: ['CHG-01', 'CHG-02'],
    steps: [
      { do: 'load' },
      { do: 'set', row: 2, field: 'startDate', value: '2026-10-12' },
      { do: 'set', row: 2, field: 'startDate', value: '2026-10-07' },
      { do: 'set', row: 2, field: 'endDate', value: '2026-10-06' },
      { do: 'set', row: 2, field: 'endDate', value: '2026-10-11' },
    ],
    expect: [
      { step: 2, toast: T.startAfterEnd },
      { step: 2, field: [2, 'startDate'], value: '' },
      { step: 3, field: [2, 'startDate'], value: '2026-10-07' },
      { step: 4, toast: T.startAfterEnd },
      { step: 4, field: [2, 'endDate'], value: '' },
      { step: 5, field: [2, 'endDate'], value: '2026-10-11' },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'cas01-row1-dates-copy-down',
    dept,
    fixture: 'knit-basic',
    rules: ['CAS-01', 'AUTO-03', 'CHG-01', 'CHG-02'],
    note: "Row 0's failed check clears only row 0; a passing change is copied into every row, the non-admin's locked Confirm row included.",
    steps: [
      { do: 'load' },
      { do: 'set', row: 0, field: 'startDate', value: '2026-10-20' },
      { do: 'set', row: 0, field: 'startDate', value: '2026-10-12' },
      { do: 'set', row: 0, field: 'endDate', value: '2026-10-11' },
      { do: 'set', row: 0, field: 'endDate', value: '2026-10-25' },
    ],
    expect: [
      { step: 2, toast: T.startAfterEnd },
      { step: 2, field: [0, 'startDate'], value: '' },
      { step: 2, field: [1, 'startDate'], value: '2026-10-06' },
      { step: 3, field: [1, 'startDate'], value: '2026-10-12', disabled: !isAdmin },
      { step: 3, field: [2, 'startDate'], value: '2026-10-12' },
      { step: 3, field: [2, 'endDate'], value: '2026-10-12' },
      { step: 4, toast: T.startAfterEnd },
      { step: 4, field: [0, 'endDate'], value: '' },
      { step: 4, field: [1, 'endDate'], value: '2026-10-16' },
      { step: 5, field: [1, 'endDate'], value: '2026-10-25' },
      { step: 5, field: [2, 'endDate'], value: '2026-10-25' },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'auto01-02-yarn-date',
    dept,
    fixture: 'knit-basic',
    rules: ['AUTO-01', 'AUTO-02', 'CAS-01', 'GATE-05'],
    steps: [
      { do: 'load' },
      { do: 'set', row: 1, field: 'yarnDate', value: '2026-10-08' },
      { do: 'set', row: 2, field: 'yarnDate', value: '2026-10-10' },
      { do: 'set', row: 1, field: 'yarnDate', value: '' },
      { do: 'set', row: 0, field: 'yarnDate', value: '2026-10-20' },
      { do: 'set', row: 0, field: 'yarnDate', value: '' },
    ],
    expect: [
      { step: 2, field: [1, 'startDate'], value: '2026-10-08' },
      { step: 2, field: [1, 'endDate'], value: '2026-10-16' },
      { step: 3, field: [2, 'startDate'], value: '' },
      { step: 3, field: [2, 'endDate'], value: '2026-10-10' },
      { step: 4, toast: T.yarnForConfirm },
      { step: 4, field: [1, 'planType'], value: '' },
      { step: 4, field: [1, 'startDate'], disabled: false },
      { step: 1, field: [1, 'startDate'], disabled: !isAdmin },
      { step: 5, field: [0, 'startDate'], value: '2026-10-20' },
      { step: 5, field: [0, 'endDate'], value: '2026-10-20' },
      { step: 5, field: [1, 'endDate'], value: '2026-10-20' },
      { step: 5, field: [2, 'endDate'], value: '2026-10-20' },
      { step: 5, field: [2, 'startDate'], value: '' },
      { step: 6, toast: T.yarnForConfirm },
      { step: 6, field: [2, 'yarnDate'], value: '' },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'chg06-07-plan-type',
    dept,
    fixture: 'knit-basic',
    rules: ['CHG-06', 'CHG-07', 'GATE-05'],
    steps: [
      { do: 'load' },
      { do: 'set', row: 2, field: 'planType', value: 'Tentative' },
      { do: 'set', row: 2, field: 'startDate', value: '2026-10-04' },
      { do: 'set', row: 2, field: 'planType', value: 'Confirm' },
      { do: 'set', row: 2, field: 'yarnDate', value: '2026-10-01' },
      { do: 'set', row: 2, field: 'planType', value: 'Confirm' },
    ],
    expect: [
      { step: 2, toast: T.datesRequired },
      { step: 2, field: [2, 'planType'], value: '' },
      { step: 4, toast: T.yarnForConfirm },
      { step: 4, field: [2, 'planType'], value: '' },
      { step: 6, field: [2, 'planType'], value: 'Confirm', disabled: !isAdmin },
      { step: 6, field: [2, 'startDate'], disabled: !isAdmin, title: isAdmin ? null : T.adminOnly },
    ],
  })),

  ...forRoles((role, isAdmin) =>
    isAdmin
      ? {
          name: 'auto05-06-plan-type-copy-down',
          dept,
          fixture: 'knit-basic',
          rules: ['AUTO-05', 'AUTO-06', 'CHG-06', 'CAS-01'],
          steps: [
            { do: 'load' },
            { do: 'set', row: 0, field: 'planType', value: 'Confirm' },
            { do: 'set', row: 1, field: 'startDate', value: '' },
            { do: 'set', row: 0, field: 'endDate', value: '' },
            { do: 'set', row: 0, field: 'planType', value: 'Tentative' },
          ],
          expect: [
            { step: 2, field: [0, 'planType'], value: 'Confirm' },
            { step: 2, field: [1, 'planType'], value: 'Confirm' },
            { step: 2, field: [2, 'planType'], value: '' },
            { step: 2, toast: T.datesRequired },
            { step: 3, field: [1, 'planType'], value: '' },
            { step: 3, toast: T.datesRequired },
            { step: 4, field: [0, 'planType'], value: '' },
            { step: 4, field: [2, 'endDate'], value: '' },
            { step: 4, toast: T.datesRequired },
            { step: 5, toast: T.datesRequired },
            { step: 5, field: [0, 'planType'], value: '' },
          ],
        }
      : {
          name: 'auto05-06-plan-type-copy-down',
          dept,
          fixture: 'knit-basic',
          rules: ['AUTO-05', 'AUTO-06', 'AUTO-02', 'CHG-06', 'GATE-05', 'CAS-01'],
          note: 'A non-admin who picks Confirm on row 0 locks it at once; clearing the row-0 Yarn Date is the way back.',
          steps: [
            { do: 'load' },
            { do: 'set', row: 0, field: 'planType', value: 'Confirm' },
            { do: 'set', row: 0, field: 'yarnDate', value: '' },
            { do: 'set', row: 2, field: 'startDate', value: '2026-10-04' },
            { do: 'set', row: 2, field: 'planType', value: 'Tentative' },
            { do: 'set', row: 2, field: 'endDate', value: '' },
          ],
          expect: [
            { step: 2, field: [0, 'planType'], value: 'Confirm', disabled: true },
            { step: 2, field: [0, 'startDate'], disabled: true, title: T.adminOnly },
            { step: 2, field: [2, 'planType'], value: '' },
            { step: 2, toast: T.datesRequired },
            { step: 3, toast: T.yarnForConfirm },
            { step: 3, field: [0, 'planType'], value: '' },
            { step: 3, field: [1, 'planType'], value: '' },
            { step: 3, field: [0, 'startDate'], disabled: false },
            { step: 5, field: [2, 'planType'], value: 'Tentative' },
            { step: 6, toast: T.datesRequired },
            { step: 6, field: [2, 'planType'], value: '' },
          ],
        }
  ),

  ...forRoles(() => ({
    name: 'save03-copied-end-before-start',
    dept,
    fixture: 'knit-basic',
    rules: ['SAVE-03', 'CAS-01'],
    steps: [{ do: 'load' }, { do: 'set', row: 0, field: 'endDate', value: '2026-10-05' }, { do: 'save' }],
    expect: [
      { step: 2, field: [1, 'endDate'], value: '2026-10-05' },
      { step: 3, toast: T.endBeforeStart },
      { step: 3, saved: false },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'save01-confirm-changed',
    dept,
    fixture: 'knit-basic',
    // SAVE-17 only for Admin: the non-admin's save is refused before any request is sent.
    rules: isAdmin ? ['SAVE-01', 'AUTO-02', 'SAVE-17'] : ['SAVE-01', 'AUTO-02'],
    note: "Clearing row 1's Yarn Date drops its saved Confirm; only Admin may save that.",
    steps: [{ do: 'load' }, { do: 'set', row: 1, field: 'yarnDate', value: '' }, { do: 'save' }],
    expect: [
      { step: 2, field: [1, 'planType'], value: '' },
      ...(isAdmin
        ? [{ step: 3, saved: true }, { step: 3, toast: T.saved('SYN-K1') }]
        : [{ step: 3, saved: false }, { step: 3, toast: T.adminOnlyConfirm }]),
    ],
  })),

  ...forRoles(() => ({
    name: 'save15-completed-and-resave',
    dept,
    fixture: 'knit-basic',
    rules: ['SAVE-15', 'SAVE-16', 'SAVE-17', 'STAT-01', 'CAS-01'],
    note: 'Limitation typed into row 0 is copied into every row on each keystroke.',
    steps: [
      { do: 'load' },
      { do: 'status', value: 'Completed' },
      { do: 'save', confirm: [false] },
      { do: 'status', value: 'Completed' },
      { do: 'save', confirm: [true] },
      { do: 'type', row: 0, field: 'limitation', text: ' x' },
      { do: 'save', via: 'footer' },
      { do: 'status', value: 'On Process' },
      { do: 'save' },
    ],
    expect: [
      { step: 3, confirm: T.completedConfirm('SYN-K1') },
      { step: 3, saved: false },
      { step: 3, status: 'On Process' },
      { step: 5, saved: true },
      { step: 5, toast: T.saved('SYN-K1') },
      { step: 5, body: { key: 'orderStatus', equals: 'Completed' } },
      { step: 5, body: { key: 'department', equals: 'knitting' } },
      { step: 5, status: 'Completed' },
      { step: 6, field: [1, 'limitation'], value: 'L-red x' },
      { step: 6, field: [2, 'limitation'], value: 'L-red x' },
      { step: 7, saved: true },
      { step: 9, body: { key: 'orderStatus', equals: 'On Process' } },
    ],
  })),

  ...forRoles(() => ({
    name: 'save17-server-errors',
    dept,
    fixture: 'knit-basic',
    rules: ['SAVE-17', 'GATE-07'],
    steps: [
      { do: 'load' },
      { do: 'save', reply: { status: 500, json: { message: 'Database write failed.' } } },
      { do: 'save', reply: { status: 500, json: {} } },
      { do: 'save', reply: { status: 502, text: '<!DOCTYPE html><html><body>Bad gateway</body></html>' } },
      { do: 'save', reply: { networkError: true } },
      { do: 'save', reply: { hold: true } },
      { do: 'release' },
    ],
    expect: [
      { step: 2, toast: 'Database write failed.' },
      { step: 3, toast: T.saveFailedDefault },
      { step: 5, toast: 'Failed to fetch' },
      { step: 6, saved: true },
      { step: 7, toast: T.saved('SYN-K1') },
    ],
  })),

  ...forRoles((role, isAdmin) => ({
    name: 'save02-match-item-ids',
    dept,
    fixture: 'knit-match',
    rules: isAdmin ? ['MATCH-01', 'MATCH-02', 'SAVE-02'] : ['SAVE-02', 'MATCH-01', 'MATCH-02', 'MATCH-04', 'SAVE-01', 'AUTO-02'],
    note: isAdmin
      ? 'Admin is exempt from the next-department lock.'
      : "Row 1 has the same itemId as a saved Confirm Dyeing row (the only way SAVE-02 fires). Row 3's saved Confirm was found through a fallback id, so SAVE-01 does not protect it; the save writes the rows under their new ids.",
    steps: isAdmin
      ? [{ do: 'load' }, { do: 'set', row: 1, field: 'startDate', value: '2026-10-06' }, { do: 'save' }]
      : [
          { do: 'load' },
          { do: 'set', row: 1, field: 'startDate', value: '2026-10-06' },
          { do: 'save' },
          { do: 'set', row: 1, field: 'startDate', value: '2026-10-05' },
          { do: 'set', row: 3, field: 'yarnDate', value: '' },
          { do: 'save' },
        ],
    expect: [
      { step: 1, field: [0, 'startDate'], value: '2026-10-09' },
      { step: 1, field: [2, 'startDate'], value: '2026-10-06' },
      { step: 1, field: [3, 'planType'], value: 'Confirm', disabled: !isAdmin },
      { step: 1, field: [4, 'startDate'], value: '2026-10-08' },
      ...(isAdmin
        ? [
            { step: 3, saved: true },
            { step: 3, body: { item: 1, key: 'startDate', equals: '2026-10-06' } },
          ]
        : [
            { step: 3, saved: false },
            { step: 3, toast: T.nextConfirmed('knitting') },
            { step: 5, toast: T.yarnForConfirm },
            { step: 6, saved: true },
            { step: 6, body: { item: 0, key: 'itemId', equals: 'syn-k2_navy_pique_' } },
            { step: 6, body: { item: 1, key: 'itemId', equals: 'k2-red-own' } },
            { step: 6, body: { item: 2, key: 'itemId', equals: 'k2-blue-own' } },
            { step: 6, body: { item: 3, key: 'itemId', equals: 'syn-k2_green_rib_200' } },
            { step: 6, body: { item: 3, key: 'planType', equals: '' } },
            { step: 6, body: { item: 4, key: 'itemId', equals: 'syn-k2_white_rib_200' } },
          ]),
    ],
  })),

  ...forRoles(() => ({
    name: 'save-ladder-legacy-rows',
    dept,
    fixture: 'knit-legacy',
    rules: ['SAVE-05', 'SAVE-06', 'SAVE-07', 'SAVE-03', 'AUTO-09', 'SAVE-16'],
    note: 'Each save stops at the first failing row; the row is fixed and the next save goes one rule further.',
    steps: [
      { do: 'load' },
      { do: 'save' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-10-16' },
      { do: 'save' },
      { do: 'set', row: 2, field: 'yarnDate', value: '2026-10-02' },
      { do: 'save' },
      { do: 'set', row: 3, field: 'startDate', value: '2026-10-02' },
      { do: 'save' },
      { do: 'set', row: 4, field: 'endDate', value: '2026-10-14' },
      { do: 'save' },
    ],
    expect: [
      { step: 2, toast: T.typeWithoutDates },
      { step: 4, toast: T.saveYarnForConfirm },
      { step: 6, toast: T.saveStartBeforeYarn },
      { step: 8, toast: T.endBeforeStart },
      { step: 10, saved: true },
      { step: 10, body: { item: 0, key: 'unit', equals: 'Floor-3' } },
      { step: 10, body: { item: 0, key: 'processName', equals: 'Prog-K' } },
      { step: 10, body: { item: 0, itemData: true, key: 'Unit', equals: 'Floor-3' } },
    ],
  })),

  ...forRoles(() => ({
    name: 'save04-saved-floor-dates',
    dept,
    fixture: 'knit-floor-legacy',
    rules: ['SAVE-04'],
    note: 'The knitting table has no floor inputs, yet the save checks (and sends) the floor dates saved on the row.',
    steps: [{ do: 'load' }, { do: 'save' }],
    expect: [
      { step: 2, toast: T.endBeforeStart },
      { step: 2, saved: false },
    ],
  })),

  ...forRoles(() => ({
    name: 'gate08-below-min-then-save07',
    dept,
    fixture: 'knit-basic',
    rules: ['GATE-08', 'SAVE-07', 'CAS-01'],
    note: 'min only limits the date picker: a typed Start before the Yarn Date is accepted, and the save refuses it.',
    steps: [{ do: 'load' }, { do: 'set', row: 0, field: 'startDate', value: '2026-09-28' }, { do: 'save' }],
    expect: [
      { step: 2, field: [0, 'startDate'], value: '2026-09-28', min: '2026-10-01' },
      { step: 3, toast: T.saveStartBeforeYarn },
      { step: 3, saved: false },
    ],
  })),

  ...forRoles(() => ({
    name: 'gate07-back-discards-edits',
    dept,
    fixture: 'knit-basic',
    rules: ['GATE-07'],
    note: 'Back, the arrow and Cancel leave without asking, although row 2 has an unsaved edit (history length 1: push to the list).',
    steps: [
      { do: 'load' },
      { do: 'set', row: 2, field: 'remarks', value: 'unsaved' },
      { do: 'back', via: 'icon' },
      { do: 'back', via: 'header' },
      { do: 'back', via: 'footer' },
    ],
    expect: [
      { step: 3, router: 'push:/planning/knitting' },
      { step: 4, router: 'push:/planning/knitting' },
      { step: 5, router: 'push:/planning/knitting' },
    ],
  })),

  {
    id: 'knitting/gate07-back-with-history/planner',
    dept,
    fixture: 'knit-basic',
    role: 'planner',
    historyLength: 3,
    rules: ['GATE-07'],
    note: 'With browser history, Back calls router.back().',
    steps: [{ do: 'load' }, { do: 'back', via: 'header' }],
    expect: [{ step: 2, router: 'back' }],
  },

  // Roles beyond Admin / Planner: what today's isAdmin (Admin or Approver, read from localStorage) does.
  {
    id: 'knitting/roles-approver-is-admin/approver',
    dept,
    fixture: 'knit-basic',
    role: 'approver',
    rules: ['GATE-05'],
    note: "Approver counts as admin for every in-row lock today (the C2 'Admin only' rule for added sections does not).",
    steps: [{ do: 'load' }],
    expect: [{ step: 1, field: [1, 'startDate'], disabled: false }],
  },
  {
    id: 'knitting/roles-lowercase-userrole/lowerApprover',
    dept,
    fixture: 'knit-basic',
    role: 'lowerApprover',
    rules: ['GATE-05'],
    note: "No stored user: the old 'userRole' key ('approver', lower case) still makes the page treat the user as admin.",
    steps: [{ do: 'load' }],
    expect: [{ step: 1, field: [1, 'startDate'], disabled: false }],
  },
  {
    id: 'knitting/roles-no-stored-user/none',
    dept,
    fixture: 'knit-basic',
    role: 'none',
    rules: ['GATE-05'],
    note: 'A token without any stored user: treated as non-admin.',
    steps: [{ do: 'load' }],
    expect: [{ step: 1, field: [1, 'startDate'], disabled: true }],
  },
  {
    id: 'knitting/roles-viewer-can-save/viewer',
    dept,
    fixture: 'knit-basic',
    role: 'viewer',
    rules: ['GATE-07'],
    note: 'Nothing checks the role or the save permissions: a Viewer saves like anyone else.',
    steps: [{ do: 'load' }, { do: 'set', row: 2, field: 'remarks', value: 'from viewer' }, { do: 'save' }],
    expect: [
      { step: 3, saved: true },
      { step: 3, toast: T.saved('SYN-K1') },
    ],
  },

  // Loading paths (not rules of the inventory, but the page's first paint and its load error).
  {
    id: 'knitting/reopen-from-cache/planner',
    dept,
    fixture: 'knit-basic',
    role: 'planner',
    rules: [],
    note: 'Opening the page again within 3 minutes paints the cached order at once (no spinner), then fetches again.',
    steps: [{ do: 'load' }, { do: 'reopen' }],
  },
  {
    id: 'knitting/load-error-500/planner',
    dept,
    fixture: 'knit-basic',
    role: 'planner',
    rules: [],
    note: 'A failed detail request (not 404) with no rows on screen shows the load-error toast and the empty table.',
    steps: [{ do: 'load', replyDetail: { status: 500, json: { message: 'Server error' } } }],
    expect: [{ step: 1, toast: T.loadFailed('SYN-K1') }],
  },
];
