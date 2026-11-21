import type { Dept, Scenario } from '../../harness/types';
import { forRoles } from './helpers';
import { T } from './texts';

const DEPTS: Dept[] = ['yd', 'knitting', 'dyeing', 'finishing', 'delivery'];
const NAMES: Record<Dept, string> = {
  yd: 'YD Plan',
  knitting: 'Knitting Plan',
  dyeing: 'Dyeing Plan',
  finishing: 'Finishing Plan',
  delivery: 'Delivery Plan',
};

/** Order number of each department's generic fixture (tests/fixtures/synthetic/gen-<dept>.json). */
const GEN_ORDER: Record<Dept, string> = { yd: 'SYN-GY', knitting: 'SYN-GK', dyeing: 'SYN-GD', finishing: 'SYN-GF', delivery: 'SYN-GL' };

/**
 * The same script on a small 3-row fixture of every department (tests/fixtures/synthetic/gen-<dept>.json):
 * the department-independent rules, recorded once per department and role.
 */
function generic(dept: Dept): Scenario[] {
  const orderNo = GEN_ORDER[dept];
  return forRoles(() => ({
    name: 'generic-rules',
    dept,
    fixture: `gen-${dept}`,
    // No CHG-06 here: every row has both dates when row 0's plan type is copied down (each department has its own CHG-06 scenario).
    rules: ['SAVE-05', 'AUTO-03', 'CHG-01', 'CHG-02', 'CAS-01', 'SAVE-03', 'AUTO-06', 'SAVE-15', 'SAVE-16', 'SAVE-17', 'STAT-01', 'GATE-06', 'GATE-07', 'GATE-08', 'MATCH-01'],
    note: "Row 2 was saved Tentative without an end date; the Row-1 copy-down moves every row; Completed is cancelled once (back to the saved 'On Process'), then confirmed; a Completed order is saved again.",
    steps: [
      { do: 'load' },
      { do: 'save' },
      { do: 'set', row: 2, field: 'endDate', value: '2026-10-28' },
      { do: 'set', row: 0, field: 'startDate', value: '2026-10-20' },
      { do: 'set', row: 2, field: 'startDate', value: '2026-10-25' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-10-29' },
      { do: 'set', row: 1, field: 'startDate', value: '2026-10-20' },
      { do: 'set', row: 0, field: 'endDate', value: '2026-10-22' },
      { do: 'save' },
      { do: 'set', row: 2, field: 'endDate', value: '2026-10-26' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-10-19' },
      { do: 'set', row: 1, field: 'endDate', value: '2026-10-21' },
      { do: 'set', row: 0, field: 'planType', value: '' },
      { do: 'set', row: 0, field: 'planType', value: 'Tentative' },
      { do: 'status', value: 'Completed' },
      { do: 'save', confirm: [false] },
      { do: 'status', value: 'Completed' },
      { do: 'save', via: 'footer', confirm: [true] },
      { do: 'save' },
    ],
    expect: [
      { step: 2, toast: T.typeWithoutDates },
      { step: 2, saved: false },
      { step: 4, field: [1, 'startDate'], value: '2026-10-20' },
      { step: 4, field: [1, 'endDate'], value: '2026-10-20' },
      { step: 6, toast: T.startAfterEnd },
      { step: 6, field: [1, 'startDate'], value: '' },
      { step: 8, field: [2, 'endDate'], value: '2026-10-22' },
      { step: 9, toast: T.endBeforeStart },
      { step: 9, saved: false },
      { step: 11, toast: T.startAfterEnd },
      { step: 11, field: [1, 'endDate'], value: '' },
      { step: 13, field: [2, 'planType'], value: '' },
      { step: 14, field: [2, 'planType'], value: 'Tentative' },
      { step: 16, confirm: T.completedConfirm(orderNo) },
      { step: 16, saved: false },
      { step: 16, status: 'On Process' },
      { step: 18, saved: true },
      { step: 18, toast: T.saved(orderNo) },
      { step: 18, body: { key: 'orderStatus', equals: 'Completed' } },
      { step: 18, status: 'Completed' },
      { step: 19, saved: true },
    ],
  }));
}

/** Saved Order Status of each department in tests/fixtures/synthetic/status-saved.json (none is 'On Process'). */
const SAVED_STATUS: Record<Dept, string> = {
  yd: 'Confirm',
  knitting: 'Tentative',
  dyeing: 'Pending',
  finishing: 'Confirm',
  delivery: 'Tentative',
};

/**
 * SAVE-15 on a department saved with a status other than 'On Process': Cancel returns the select to the SAVED
 * status, which is neither V2's 'On Process' nor the value picked just before Completed.
 */
function cancelRestoresSavedStatus(dept: Dept): Scenario[] {
  const saved = SAVED_STATUS[dept];
  const picked = saved === 'Pending' ? 'Tentative' : 'Pending';
  return forRoles(() => ({
    name: 'save15-cancel-restores-saved-status',
    dept,
    fixture: 'status-saved',
    rules: ['SAVE-15', 'STAT-01', 'SAVE-16', 'SAVE-17'],
    note: `${NAMES[dept]} saved as '${saved}': the user picks '${picked}', then Completed, and cancels the prompt; the select returns to the saved '${saved}'. Confirming the prompt then saves Completed.`,
    steps: [
      { do: 'load' },
      { do: 'status', value: picked },
      { do: 'status', value: 'Completed' },
      { do: 'save', confirm: [false] },
      { do: 'status', value: 'Completed' },
      { do: 'save', confirm: [true] },
    ],
    expect: [
      { step: 1, status: saved },
      { step: 2, status: picked },
      { step: 3, status: 'Completed' },
      { step: 4, confirm: T.completedConfirm('SYN-S1') },
      { step: 4, saved: false },
      { step: 4, status: saved },
      { step: 6, confirm: T.completedConfirm('SYN-S1') },
      { step: 6, saved: true },
      { step: 6, toast: T.saved('SYN-S1') },
      { step: 6, body: { key: 'orderStatus', equals: 'Completed' } },
      { step: 6, status: 'Completed' },
    ],
  }));
}

/**
 * The save checks run BEFORE the Completed prompt (the order C2's Save Data must keep): with Completed picked, a save
 * that fails a check shows the check's toast, asks nothing (an unscripted window.confirm is a harness error) and
 * sends nothing, and the select keeps Completed. Once the row is fixed, the next save asks and saves Completed.
 */
function checksBeforeCompletedPrompt(dept: Dept): Scenario[] {
  const orderNo = GEN_ORDER[dept];
  return forRoles(() => ({
    name: 'save15-checks-before-completed-prompt',
    dept,
    fixture: `gen-${dept}`,
    rules: ['SAVE-05', 'SAVE-15', 'STAT-01', 'SAVE-16', 'SAVE-17'],
    note: 'Row 2 was saved Tentative without an end date. With Completed picked, the save stops at that check: its toast, no prompt, no request, and the select keeps Completed. With the end date filled in, the save asks, then saves Completed.',
    steps: [
      { do: 'load' },
      { do: 'status', value: 'Completed' },
      { do: 'save' },
      { do: 'set', row: 2, field: 'endDate', value: '2026-10-28' },
      { do: 'save', confirm: [true] },
    ],
    expect: [
      { step: 3, toast: T.typeWithoutDates },
      { step: 3, saved: false },
      { step: 3, status: 'Completed' },
      { step: 5, confirm: T.completedConfirm(orderNo) },
      { step: 5, saved: true },
      { step: 5, toast: T.saved(orderNo) },
      { step: 5, body: { key: 'orderStatus', equals: 'Completed' } },
      { step: 5, status: 'Completed' },
    ],
  }));
}

/**
 * SAVE-15 on an order never planned (no OrderDate document, so no saved status): the select starts at 'On Process',
 * and Cancel on the Completed prompt returns it there. The next save sends 'On Process'.
 */
function cancelOnNeverSaved(dept: Dept): Scenario[] {
  return forRoles(() => ({
    name: 'save15-cancel-never-saved',
    dept,
    fixture: 'no-saved-plan',
    rules: ['SAVE-15', 'STAT-01', 'SAVE-16', 'SAVE-17'],
    note: `${NAMES[dept]} never saved (no OrderDate): Completed is picked and the prompt cancelled; the select returns to 'On Process', and the next save sends it.`,
    steps: [{ do: 'load' }, { do: 'status', value: 'Completed' }, { do: 'save', confirm: [false] }, { do: 'save' }],
    expect: [
      { step: 1, status: 'On Process' },
      { step: 2, status: 'Completed' },
      { step: 3, confirm: T.completedConfirm('SYN-N1') },
      { step: 3, saved: false },
      { step: 3, status: 'On Process' },
      { step: 4, saved: true },
      { step: 4, toast: T.saved('SYN-N1') },
      { step: 4, body: { key: 'orderStatus', equals: 'On Process' } },
      { step: 4, status: 'On Process' },
    ],
  }));
}

/** An order without rows for the department: the empty table, and the save refused (SAVE-00). */
function noItems(dept: Dept): Scenario[] {
  return forRoles(() => ({
    name: 'save00-no-items',
    dept,
    fixture: 'empty-order',
    rules: ['SAVE-00'],
    steps: [{ do: 'load' }, { do: 'save' }],
    expect: [
      { step: 2, toast: T.noItems },
      { step: 2, saved: false },
    ],
  }));
}

/** An order number the server does not know: the "Order Not Found" view (404). */
function notFound(dept: Dept): Scenario[] {
  return forRoles(
    () => ({
      name: 'order-not-found',
      dept,
      fixture: 'empty-order',
      orderNo: 'SYN-NOPE',
      rules: [],
      note: `GET /api/orders/SYN-NOPE answers 404: the page shows "Order Not Found" with the ${NAMES[dept]} name and a link back to /planning/${dept}.`,
      steps: [{ do: 'load' }],
    }),
    ['planner']
  );
}

export const commonScenarios: Scenario[] = DEPTS.flatMap((dept) => [
  ...generic(dept),
  ...cancelRestoresSavedStatus(dept),
  ...noItems(dept),
  ...notFound(dept),
  ...checksBeforeCompletedPrompt(dept),
  ...cancelOnNeverSaved(dept),
]);
