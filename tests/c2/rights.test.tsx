import { afterEach, describe, expect, it } from 'vitest';
import { openPage, type PageDriver } from './driver';
import { twoRows } from './fixtures';
import { loadSyntheticFixture } from '../harness/fixtures';
import { T } from '../golden/scenarios/texts';
import type { Loose } from '../harness/types';

// Plan T6 (Dyeing waits for a SAVED Knitting plan, D1) and T7 (rights, D4) on the universal page. (Ported from the
// final verification's adversarial suite, round 1.)

let page: PageDriver | null = null;
afterEach(() => {
  page?.close();
  page = null;
});

const fresh = () => JSON.parse(JSON.stringify(loadSyntheticFixture('no-saved-plan')));

describe('T6: Dyeing waits for a SAVED Knitting plan (D1)', () => {
  it('Admin on the Knitting page: Save Data with unsaved Knitting type + Dyeing dates fails on Dyeing first, nothing sent; Knitting then Dyeing saves work', async () => {
    page = await openPage({ fixture: fresh(), dept: 'knitting', role: 'admin' });
    await page.set('knitting', 0, 'yarnDate', '2026-10-01');
    await page.set('knitting', 0, 'startDate', '2026-10-05');
    await page.set('knitting', 0, 'endDate', '2026-10-15');
    await page.set('knitting', 0, 'planType', 'Tentative');
    await page.set('dyeing', 0, 'startDate', '2026-10-16');
    // The on-change check reads the SAVED Knitting plan (blank): refused, as on today's Dyeing page.
    expect(page.toasts.at(-1)).toBe(`error: ${T.knitBlank}`);
    expect(page.pills('dyeing')).not.toContain('Unsaved');
    await page.wait(4000);
    await page.saveSection('knitting');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-N1')}`);
    await page.wait(4000);
    await page.set('dyeing', 0, 'startDate', '2026-10-16');
    await page.set('dyeing', 0, 'endDate', '2026-10-25');
    expect(page.pills('dyeing')).toContain('Unsaved');
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-N1')}`);
    expect(page.server.db.orderDates[0].dyeing[0].startDate).toBe('2026-10-16');
  });

  it('Planner on the Dyeing page: the Dyeing row is locked until Knitting is saved (by someone), then open after a reload', async () => {
    page = await openPage({ fixture: fresh(), dept: 'dyeing', role: 'planner' });
    const start = () => page!.field('dyeing', 0, 'startDate') as HTMLInputElement;
    expect(start().disabled).toBe(true);
    expect(start().getAttribute('title')).toBe(T.knitTypeMandatory);
    // Knitting is View only here.
    expect(page.pills('knitting')).toContain('View only');
    // Someone saves Knitting with a plan type.
    const plan = page.server.db;
    plan.orderDates.push({
      _id: 'x1',
      orderNo: 'SYN-N1',
      knitting: [{ itemId: page.field('knitting', 0, 'startDate').closest('tr')?.getAttribute('data-item') || 'syn-n1_red_s/j_160', itemData: { Color: 'Red', FabricConstruction: 'S/J' }, startDate: '2026-10-05', endDate: '2026-10-15', planType: 'Tentative', yarnDate: '2026-10-01' }],
      knittingStatus: 'On Process',
      updatedAt: new Date(Date.now()).toISOString(),
    } as Loose);
    await page.reload();
    expect(start().disabled).toBe(false);
  });
});

describe('T7: rights', () => {
  it("Approver is not Admin for other sections (D4); the route section edits and saves as today", async () => {
    page = await openPage({ fixture: twoRows(), dept: 'dyeing', role: 'approver' });
    for (const key of ['knitting', 'deliveryFloor', 'deliveryLock']) expect(page.pills(key)).toContain('View only');
    expect(page.pills('dyeing')).not.toContain('View only');
    await page.set('dyeing', 1, 'remarks', 'a');
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(page.savePlansRequests()[0].body.plans.map((p: Loose) => p.department)).toEqual(['dyeing']);
  });
});
