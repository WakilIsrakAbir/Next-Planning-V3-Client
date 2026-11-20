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

/**
 * The same script on a small 3-row fixture of every department (tests/fixtures/synthetic/gen-<dept>.json):
 * the department-independent rules, recorded once per department and role.
 */
function generic(dept: Dept): Scenario[] {
  const orderNo = { yd: 'SYN-GY', knitting: 'SYN-GK', dyeing: 'SYN-GD', finishing: 'SYN-GF', delivery: 'SYN-GL' }[dept];
  return forRoles(() => ({
    name: 'generic-rules',
    dept,
    fixture: `gen-${dept}`,
    rules: ['SAVE-05', 'AUTO-03', 'CHG-01', 'CHG-02', 'CAS-01', 'SAVE-03', 'AUTO-06', 'CHG-06', 'SAVE-15', 'SAVE-16', 'SAVE-17', 'STAT-01', 'GATE-06', 'GATE-07', 'GATE-08', 'MATCH-01'],
    note: 'Row 2 was saved Tentative without an end date; the Row-1 copy-down moves every row; Completed is cancelled once, then confirmed; a Completed order is saved again.',
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

export const commonScenarios: Scenario[] = DEPTS.flatMap((dept) => [...generic(dept), ...noItems(dept), ...notFound(dept)]);
