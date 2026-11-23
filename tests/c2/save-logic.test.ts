import { describe, expect, it } from 'vitest';
import { buildMergedItems, formatPlanPayload } from '@/features/planning/lib/order-plan-logic';
import {
  buildSavePlansBody,
  confirmCompletions,
  findFailingEntry,
  planDataForValidation,
  type PlanSaveEntry,
} from '@/features/planning/order-page/lib/order-page-save';
import { initOrderPageModel, isGroupDirty, orderPageReducer, rowsForSave } from '@/features/planning/order-page/lib/order-page-model';
import { T } from '../golden/scenarios/texts';
import { twoRows } from './fixtures';
import type { Loose } from '../harness/types';

// The save planner of the universal order page, without the page: downstream-first checks, the SAVE-02 overlay,
// the Completed prompts and the request body.

function setup() {
  const f = twoRows();
  const order = f.orders[0];
  const planData = f.orderDates[0];
  const rows = (dept: string) => buildMergedItems(order, planData, dept);
  const toasts: string[] = [];
  const ctx = { orderNo: 'SYN-S1', order, planData, isAdmin: false, showToast: (m: string) => toasts.push(m) };
  return { order, planData, rows, toasts, ctx };
}

describe('the SAVE-02 overlay (plan D5)', () => {
  it("Dyeing's downstream-Confirm check reads the Delivery rows of the same Save Data; nothing else is overlaid", () => {
    const { planData, rows, toasts, ctx } = setup();
    // Non-admin: Dyeing row 0 changed. Saved Delivery row 0 is Tentative, so Dyeing alone passes SAVE-02.
    const dyeing: PlanSaveEntry = {
      dept: 'dyeing',
      groups: ['main'],
      rows: rows('dyeing').map((r, i) => (i === 0 ? { ...r, endDate: '2026-10-27' } : r)),
      status: 'Pending',
    };
    expect(findFailingEntry([dyeing], ctx)).toBeNull();
    expect(toasts).toEqual([]);

    // Saved together with a Delivery row 0 of type Confirm whose item id equals the Dyeing row's (the only way
    // SAVE-02 matches): Dyeing's check sees that Delivery row and refuses, exactly as a Delivery save followed by a
    // Dyeing save would.
    const deliveryRows = rows('delivery').map((r, i) => (i === 0 ? { ...r, itemId: dyeing.rows[0].itemId, planType: 'Confirm' } : r));
    const delivery: PlanSaveEntry = { dept: 'delivery', groups: ['floor', 'lock'], rows: deliveryRows, status: 'Tentative' };
    // Delivery's own checks pass (its Dyeing row 0 is Tentative: Confirm is refused only on change, not at save).
    const failing = findFailingEntry([dyeing, delivery], ctx);
    expect(failing?.dept).toBe('dyeing');
    expect(toasts).toEqual([T.nextConfirmed('dyeing')]);

    // The overlay: downstream departments of the save only, as save-plans stores them; the department's own rows and
    // its upstream rows stay the saved ones.
    const forDyeing = planDataForValidation(planData, 'dyeing', [dyeing, delivery]);
    expect(forDyeing.delivery).toEqual(formatPlanPayload('delivery', deliveryRows));
    expect(forDyeing.dyeing).toBe(planData.dyeing);
    expect(forDyeing.knitting).toBe(planData.knitting);
    expect(planDataForValidation(planData, 'delivery', [dyeing, delivery])).toBe(planData);
    // The saved plan itself is never changed.
    expect(planData.delivery[0].planType).toBe('Tentative');
  });

  it("Knitting's check reads the Dyeing rows of the same save", () => {
    const { rows, toasts, ctx } = setup();
    const knitting: PlanSaveEntry = {
      dept: 'knitting',
      groups: ['main'],
      rows: rows('knitting').map((r, i) => (i === 1 ? { ...r, endDate: '2026-10-17' } : r)),
      status: 'Tentative',
    };
    const dyeingRows = rows('dyeing').map((r, i) => (i === 1 ? { ...r, itemId: knitting.rows[1].itemId, planType: 'Confirm' } : r));
    expect(findFailingEntry([knitting], ctx)).toBeNull();
    const failing = findFailingEntry([knitting, { dept: 'dyeing', groups: ['main'], rows: dyeingRows, status: 'Pending' }], ctx);
    expect(failing?.dept).toBe('knitting');
    expect(toasts).toEqual([T.nextConfirmed('knitting')]);
  });
});

describe('downstream first, stop at the first failure', () => {
  it('runs delivery, dyeing, knitting and shows only the first failing toast', () => {
    const { rows, toasts, ctx } = setup();
    const bad = (dept: string, patch: Loose): PlanSaveEntry => ({
      dept,
      groups: dept === 'delivery' ? ['floor', 'lock'] : ['main'],
      rows: rows(dept).map((r, i) => (i === 1 ? { ...r, ...patch } : r)),
      status: 'On Process',
    });
    const knitting = bad('knitting', { endDate: '' });
    const dyeing = bad('dyeing', { endDate: '' });
    const delivery = bad('delivery', { floorStartDate: '2026-12-01' });
    expect(findFailingEntry([knitting, dyeing, delivery], { ...ctx, isAdmin: true })?.dept).toBe('delivery');
    expect(toasts).toEqual([T.endBeforeStart]);
    expect(findFailingEntry([knitting, dyeing], { ...ctx, isAdmin: true })?.dept).toBe('dyeing');
    expect(findFailingEntry([knitting], { ...ctx, isAdmin: true })?.dept).toBe('knitting');
    expect(toasts).toEqual([T.endBeforeStart, T.typeWithoutDates, T.typeWithoutDates]);
  });
});

describe('Completed prompts', () => {
  it('in pipeline order; Cancel restores that department and stops', () => {
    const { rows, ctx } = setup();
    const asked: string[] = [];
    const restored: Array<[string, string]> = [];
    const entries: PlanSaveEntry[] = ['delivery', 'knitting', 'dyeing'].map((dept) => ({
      dept,
      groups: dept === 'delivery' ? ['floor', 'lock'] : ['main'],
      rows: rows(dept),
      status: 'Completed',
    }));
    const original = window.confirm;
    const answers = [true, false];
    window.confirm = (m?: string) => {
      asked.push(String(m));
      return answers.shift() ?? true;
    };
    try {
      const ok = confirmCompletions(entries, { ...ctx, restoreStatus: (d, s) => restored.push([d, s]) });
      expect(ok).toBe(false);
      expect(asked).toEqual([T.completedConfirm('SYN-S1'), T.completedConfirm('SYN-S1')]);
      // Knitting asked first (accepted), Dyeing second (cancelled: back to its saved 'Pending'); Delivery never asked.
      expect(restored).toEqual([['dyeing', 'Pending']]);
    } finally {
      window.confirm = original;
    }
  });
});

describe('request body', () => {
  it('departments in pipeline order, base only for known fingerprints, rows formatted as today', () => {
    const { rows } = setup();
    const body = buildSavePlansBody(
      'SYN-S1',
      [
        { dept: 'delivery', groups: ['lock'], rows: rows('delivery'), status: 'Tentative' },
        { dept: 'knitting', groups: ['main'], rows: rows('knitting'), status: 'Pending' },
      ],
      { knitting: 'fp-k' }
    );
    expect(body.plans.map((p) => p.department)).toEqual(['knitting', 'delivery']);
    expect(body.base).toEqual({ knitting: 'fp-k' });
    expect(body.plans[0].fabricItems).toEqual(formatPlanPayload('knitting', rows('knitting')));
    expect(buildSavePlansBody('SYN-S1', [{ dept: 'knitting', groups: ['main'], rows: rows('knitting'), status: 'X' }], {}).base).toBeUndefined();
  });
});

describe('page state', () => {
  it('per-group dirty state and what a delivery group save sends', () => {
    const f = twoRows();
    let m = initOrderPageModel(['knitting', 'dyeing', 'delivery'], { order: f.orders[0], planData: f.orderDates[0] }, {});
    m = orderPageReducer(m, { type: 'rows', dept: 'delivery', update: (rows) => rows.map((r) => ({ ...r, floorEndDate: '2026-11-09', remarks: 'x' })) });
    const d = m.drafts.delivery;
    expect(isGroupDirty(d, 'delivery', 'floor')).toBe(true);
    expect(isGroupDirty(d, 'delivery', 'lock')).toBe(true);
    expect(rowsForSave(d, 'delivery', ['floor']).rows.map((r) => [r.floorEndDate, r.remarks])).toEqual([
      ['2026-11-09', ''],
      ['2026-11-09', ''],
    ]);
    expect(rowsForSave(d, 'delivery', ['lock']).rows.map((r) => [r.floorEndDate, r.remarks])).toEqual([
      ['2026-11-01', 'x'],
      ['2026-11-02', 'x'],
    ]);
    // A value typed and removed again is not a change.
    m = orderPageReducer(m, { type: 'rows', dept: 'knitting', update: (rows) => rows.map((r) => ({ ...r, remarks: 'a' })) });
    m = orderPageReducer(m, { type: 'rows', dept: 'knitting', update: (rows) => rows.map((r) => ({ ...r, remarks: '' })) });
    expect(isGroupDirty(m.drafts.knitting, 'knitting', 'main')).toBe(false);
  });

  it('a detail read merges clean sections again and keeps drafts (and old bases) of dirty ones', () => {
    const f = twoRows();
    let m = initOrderPageModel(['knitting', 'dyeing'], { order: f.orders[0], planData: f.orderDates[0], fingerprints: { knitting: 'k1', dyeing: 'd1' } }, {});
    m = orderPageReducer(m, { type: 'rows', dept: 'dyeing', update: (rows) => rows.map((r) => ({ ...r, remarks: 'mine' })) });
    const newer = JSON.parse(JSON.stringify(f.orderDates[0]));
    newer.knitting[0].remarks = 'theirs';
    newer.dyeing[0].remarks = 'theirs';
    newer.updatedAt = '2026-11-20T00:00:00.000Z';
    m = orderPageReducer(m, { type: 'hydrate', data: { order: f.orders[0], planData: newer, fingerprints: { knitting: 'k2', dyeing: 'd2' } } });
    expect(m.drafts.knitting.rows[0].remarks).toBe('theirs');
    expect(m.drafts.dyeing.rows[0].remarks).toBe('mine');
    expect(m.fingerprints).toEqual({ knitting: 'k2', dyeing: 'd1' });
    expect(m.planData).toBe(newer);
    // An older read is ignored.
    const older = { ...newer, updatedAt: '2026-01-01T00:00:00.000Z', knitting: [] };
    expect(orderPageReducer(m, { type: 'hydrate', data: { order: f.orders[0], planData: older } })).toBe(m);
  });

  it('a read keeps the delivery base while either delivery group is dirty, and merges only the clean group again', () => {
    const f = twoRows();
    const read = (planData: Loose, fp: string) => ({
      type: 'hydrate' as const,
      data: { order: f.orders[0], planData, fingerprints: { knitting: `k-${fp}`, delivery: `d-${fp}` } },
    });
    // Someone else's save: a stored Floor value and a stored Lock value of delivery row 0.
    const theirs = JSON.parse(JSON.stringify(f.orderDates[0]));
    theirs.delivery[0].floorPlanType = 'Confirm';
    theirs.delivery[0].limitation = 'theirs';
    theirs.updatedAt = '2026-11-20T00:00:00.000Z';

    for (const [dirtyGroup, field, value] of [
      ['floor', 'floorEndDate', '2026-11-09'],
      ['lock', 'remarks', 'mine'],
    ] as const) {
      let m = initOrderPageModel(['knitting', 'delivery'], { order: f.orders[0], planData: f.orderDates[0], fingerprints: { knitting: 'k-0', delivery: 'd-0' } }, {});
      m = orderPageReducer(m, { type: 'rows', dept: 'delivery', update: (rows) => rows.map((r, i) => (i === 1 ? { ...r, [field]: value } : r)) });
      m = orderPageReducer(m, read(theirs, '1'));
      // Knitting is clean: it adopts the read's fingerprint. Delivery keeps the one its draft was made on.
      expect(m.fingerprints).toEqual({ knitting: 'k-1', delivery: 'd-0' });
      const rows = m.drafts.delivery.rows;
      expect(rows[1][field]).toBe(value);
      expect(isGroupDirty(m.drafts.delivery, 'delivery', dirtyGroup)).toBe(true);
      // The clean group shows their value; the dirty group keeps the draft's own (old) value.
      expect(rows[0].floorPlanType).toBe(dirtyGroup === 'floor' ? 'Tentative' : 'Confirm');
      expect(rows[0].limitation).toBe(dirtyGroup === 'lock' ? '' : 'theirs');
      // A later read (still dirty) keeps the old base too.
      const later = { ...theirs, updatedAt: '2026-11-20T00:01:00.000Z' };
      m = orderPageReducer(m, read(later, '2'));
      expect(m.fingerprints).toEqual({ knitting: 'k-2', delivery: 'd-0' });
      // Once both groups are clean (the edit discarded), the next read adopts the delivery fingerprint.
      m = orderPageReducer(m, { type: 'discard', dept: 'delivery', group: dirtyGroup });
      m = orderPageReducer(m, read({ ...theirs, updatedAt: '2026-11-20T00:02:00.000Z' }, '3'));
      expect(m.fingerprints).toEqual({ knitting: 'k-3', delivery: 'd-3' });
      expect(m.drafts.delivery.rows[0].floorPlanType).toBe('Confirm');
      expect(m.drafts.delivery.rows[0].limitation).toBe('theirs');
    }
  });
});
