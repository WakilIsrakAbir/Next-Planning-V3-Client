import { afterEach, describe, expect, it } from 'vitest';
import { openPage, type PageDriver } from './driver';
import { twoRows } from './fixtures';
import { API_BASE, TEST_TOKEN, fingerprintDept } from '../harness/mock-server';
import { T } from '../golden/scenarios/texts';
import { harnessState } from '../harness/state';
import type { Loose } from '../harness/types';
import { initOrderPageModel, orderPageReducer } from '@/features/planning/order-page/lib/order-page-model';

// Lost-update sequences against the fingerprint-adoption rule (a read adopts a department's fingerprint only when every
// group that keeps a draft was made on what the read shows), against "Save mine anyway" and against the keep-newest
// guard. Each test is someone else's save racing with this page's unsaved work: their change must survive unless the
// user explicitly chose to overwrite it. (Ported from the final verification's adversarial suite.)

let page: PageDriver | null = null;
afterEach(() => {
  page?.close();
  page = null;
});

const stored = (p: PageDriver) => p.server.db.orderDates.find((d) => d.orderNo === 'SYN-S1');
const lastSave = (p: PageDriver) => p.savePlansRequests().at(-1) as Loose;
const conflictText = (dept: string) => `${dept} was changed by someone else after this order was opened.`;
const ta = (p: PageDriver, key: string, row: number, name: string) => (p.field(key, row, name) as HTMLTextAreaElement).value;

/** Another user saves `dept` through the API (save-plans without base), as V2, V3 or an upload would change it. */
async function someoneElseSaves(p: PageDriver, dept: string, edit: (rows: Loose[]) => void, status?: string) {
  const record = stored(p);
  const rows = JSON.parse(JSON.stringify(record[dept]));
  edit(rows);
  const before = p.server.log.length;
  const res = await p.server.fetch(`${API_BASE}/api/orders/save-plans`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNo: 'SYN-S1', plans: [{ department: dept, fabricItems: rows, orderStatus: status ?? record[`${dept}Status`] }] }),
  });
  // Not a request of this page.
  p.server.log.splice(before);
  expect(res.status).toBe(200);
  return fingerprintDept(stored(p), dept);
}

/** Triggers a page read (the fresh=1 read after a save) by saving a Knitting edit. */
async function readViaKnittingSave(p: PageDriver, text = 'k') {
  await p.set('knitting', 0, 'remarks', text);
  await p.saveSection('knitting');
  expect(p.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
  await p.wait(4000);
}

describe('another user changes the SAME group as my draft (non-delivery)', () => {
  it('different row and field: a later read keeps the old base; my Save is refused; their value stays', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    const oldBase = fingerprintDept(stored(page), 'dyeing');
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.wait(1000);
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('dyeing');
    expect(lastSave(page).body.base).toEqual({ dyeing: oldBase });
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
    expect(stored(page).dyeing[0].limitation).toBe('theirs');
  });

  it('their change equals my draft in one field but differs in another: still refused', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'same');
    await page.wait(1000);
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[1].remarks = 'same';
      rows[1].limitation = 'theirs';
    });
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
    expect(stored(page).dyeing[1].limitation).toBe('theirs');
  });

  it('their change equals my draft exactly (same value typed by both): adopting is harmless', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'same');
    await page.wait(1000);
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[1].remarks = 'same';
    });
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('dyeing');
    // Either a refusal or a save of identical content is fine; no other value may change.
    expect(stored(page).dyeing.map((r: Loose) => [r.remarks, r.limitation])).toEqual([
      ['', ''],
      ['same', ''],
    ]);
  });

  it('a status-only change of theirs on a department where I changed rows: refused', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.wait(1000);
    await someoneElseSaves(page, 'dyeing', () => {}, 'Tentative');
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
    expect(stored(page).dyeingStatus).toBe('Tentative');
  });

  it('a rows change of theirs on a department where I changed only the status: refused', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.setStatus('dyeing', 'Tentative');
    await page.wait(1000);
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[0].remarks = 'theirs';
    });
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
    expect(stored(page).dyeing[0].remarks).toBe('theirs');
  });

  it('a V2-style save that changed only itemData.Unit (top-level unit dropped, as V2 sends): refused or kept', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.wait(1000);
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows.forEach((r: Loose) => {
        delete r.unit;
        delete r.processName;
      });
      rows[0].itemData = { ...rows[0].itemData, Unit: 'EKL' };
    });
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('dyeing');
    // Their Unit must survive (refused, or saved on top of it).
    expect(stored(page).dyeing[0].itemData.Unit).toBe('EKL');
  });

  it('itemData.Unit changed while a top-level unit stays (V3 row kept, Unit changed in itemData only): their Unit survives', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    // First a V3 save, so the stored dyeing rows carry a top-level unit.
    await page.set('dyeing', 0, 'remarks', 'first');
    await page.saveSection('dyeing');
    await page.wait(4000);
    expect(stored(page).dyeing[0].unit).toBe('EFL');
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.wait(1000);
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[0].itemData = { ...rows[0].itemData, Unit: 'EKL' };
    });
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('dyeing');
    // The read is not adopted (the itemData Unit is fingerprinted): my save is refused, their Unit stays.
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
    expect(stored(page).dyeing[0].itemData.Unit).toBe('EKL');
  });
});

describe('another user changes the OTHER delivery group', () => {
  it('Floor draft, their Lock change, a read, then Save Floor: their Lock values and status stay', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.wait(1000);
    await someoneElseSaves(
      page,
      'delivery',
      (rows) => {
        rows[0].limitation = 'theirs';
        rows[0].remarks = 'their remark';
      },
      'Confirm'
    );
    await page.wait(1000);
    await readViaKnittingSave(page);
    expect(page.pills('deliveryFloor')).toContain('Unsaved');
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    const d = stored(page);
    expect(d.delivery[0].limitation).toBe('theirs');
    expect(d.delivery[0].remarks).toBe('their remark');
    expect(d.delivery[1].floorEndDate).toBe('2026-11-04');
    expect(d.deliveryStatus).toBe('Confirm');
  });

  it('Lock draft (rows), their Floor change, a read, then Save Lock: their Floor values stay', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('deliveryLock', 1, 'remarks', 'mine');
    await page.wait(1000);
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].floorPlanType = 'Confirm';
    });
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('deliveryLock');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery[0].floorPlanType).toBe('Confirm');
    expect(stored(page).delivery[1].remarks).toBe('mine');
  });

  it('Lock draft (rows only), their status change, a read, then Save Lock: refused (status is in my group)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('deliveryLock', 1, 'remarks', 'mine');
    await page.wait(1000);
    await someoneElseSaves(page, 'delivery', () => {}, 'Confirm');
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('deliveryLock');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    expect(stored(page).deliveryStatus).toBe('Confirm');
  });

  it('Floor draft, their Lock change, NO read: Save Floor is refused (my stale Lock baseline would be sent)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.wait(1000);
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    expect(stored(page).delivery[0].limitation).toBe('theirs');
  });

  it('Floor draft, their Lock change, NO read: "Save mine anyway" on Floor keeps their Lock values and status (fresh read)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.wait(1000);
    const theirs = await someoneElseSaves(
      page,
      'delivery',
      (rows) => {
        rows[0].limitation = 'theirs';
        rows[0].remarks = 'their remark';
      },
      'Confirm'
    );
    await page.saveSection('deliveryFloor');
    await page.wait(4000);
    const alert = page.section('deliveryFloor').querySelector('[data-conflict]');
    expect(alert).not.toBeNull();
    expect(page.section('deliveryLock').querySelector('[data-conflict]')).toBeNull();
    const reads = page.server.log.length;
    await page.click(alert!.querySelector('[data-action="save-mine"]'));
    // The other group comes from a read past the server cache, made right before the forced save.
    expect(page.server.log.slice(reads).map((r) => `${r.method} ${r.url}`).slice(0, 2)).toEqual([
      'GET /api/orders/SYN-S1?dept=delivery&fresh=1',
      'POST /api/orders/save-plans',
    ]);
    const req = lastSave(page);
    expect(req.body.base).toEqual({ delivery: theirs });
    expect(req.body.plans[0].orderStatus).toBe('Confirm');
    expect(req.body.plans[0].fabricItems.map((r: Loose) => [r.limitation, r.remarks, r.floorEndDate])).toEqual([
      ['theirs', 'their remark', '2026-11-01'],
      ['', '', '2026-11-04'],
    ]);
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    const d = stored(page);
    expect(d.delivery[0].limitation).toBe('theirs');
    expect(d.delivery[0].remarks).toBe('their remark');
    expect(d.deliveryStatus).toBe('Confirm');
    expect(d.delivery[1].floorEndDate).toBe('2026-11-04');
    await page.wait(4000);
    expect(document.querySelector('[data-conflict]')).toBeNull();
    expect(ta(page, 'deliveryLock', 0, 'limitation')).toBe('theirs');
    expect(page.errors).toEqual([]);
  });

  it('Floor and Lock drafts, their Lock change: "Save mine anyway" on Floor keeps their Lock; my Lock draft stays unsaved and refused', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    const before = fingerprintDept(stored(page), 'delivery');
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    await page.wait(1000);
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.saveSection('deliveryFloor');
    expect(page.section('deliveryLock').querySelector('[data-conflict]')).toBeNull();
    await page.wait(4000);
    await page.click(page.section('deliveryFloor').querySelector('[data-conflict] [data-action="save-mine"]'));
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery.map((r: Loose) => [r.limitation, r.remarks, r.floorEndDate])).toEqual([
      ['theirs', '', '2026-11-01'],
      ['', '', '2026-11-04'],
    ]);
    await page.wait(4000);
    // My Lock work was made before their Lock change: it stays unsaved, and the alert moves to Lock.
    expect(page.pills('deliveryLock')).toContain('Unsaved');
    expect(ta(page, 'deliveryLock', 1, 'remarks')).toBe('l mine');
    expect(page.section('deliveryLock').querySelector('[data-conflict]')).not.toBeNull();
    expect(page.section('deliveryFloor').querySelector('[data-conflict]')).toBeNull();
    expect(page.pills('deliveryFloor')).not.toContain('Unsaved');
    // Saving it is refused (the old base is kept), so their Lock change is not overwritten silently.
    await page.saveSection('deliveryLock');
    expect(lastSave(page).body.base).toEqual({ delivery: before });
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(page.errors).toEqual([]);
  });

  it('"Save mine anyway" of one Delivery group when the fresh read fails: nothing is sent, the draft and the alert stay', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.saveSection('deliveryFloor');
    await page.wait(4000);
    page.server.scriptNext('detail', { networkError: true });
    await page.click(page.section('deliveryFloor').querySelector('[data-conflict] [data-action="save-mine"]'));
    expect(page.toasts.at(-1)).toBe('error: Could not load the latest plan of Order #SYN-S1. Please try again.');
    expect(page.savePlansRequests()).toHaveLength(1);
    expect(page.section('deliveryFloor').querySelector('[data-conflict]')).not.toBeNull();
    expect(page.field('deliveryFloor', 1, 'floorEndDate').value).toBe('2026-11-04');
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(page.errors).toEqual([]);
  });
});

describe('items added or removed by an upload', () => {
  it('an upload added a Dyeing item (order + plan row): my dirty Dyeing save is refused', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.wait(1000);
    const order = page.server.db.orders[0];
    order.dyeingItems.push({ ...order.dyeingItems[0], Color: 'Green' });
    const rec = stored(page);
    rec.dyeing.push({ itemId: 'syn-s1_green_solid', itemData: { Color: 'Green' }, startDate: '', endDate: '', planType: '', limitation: '', remarks: '' });
    rec.updatedAt = new Date(Date.now()).toISOString();
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
    expect(stored(page).dyeing).toHaveLength(3);
  });

  it('an upload removed a Dyeing item (order + plan row): my dirty Dyeing save is refused', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.wait(1000);
    page.server.db.orders[0].dyeingItems.splice(0, 1);
    const rec = stored(page);
    rec.dyeing.splice(0, 1);
    rec.updatedAt = new Date(Date.now()).toISOString();
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
    expect(stored(page).dyeing).toHaveLength(1);
  });

  it('an upload changed only Excel itemData of the plan rows (not fingerprinted): my save goes through', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.wait(1000);
    const rec = stored(page);
    rec.dyeing[0].itemData = { ...rec.dyeing[0].itemData, RequiredQtyKgs: 999 };
    rec.updatedAt = new Date(Date.now()).toISOString();
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
  });
});

describe('Load latest of one group, then Save of the other', () => {
  it('they changed BOTH groups; Save Lock refused; Load latest Lock; then Save Floor is refused too (not absorbed)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    await page.wait(1000);
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].floorPlanType = 'Confirm';
      rows[0].limitation = 'theirs';
    });
    await page.saveSection('deliveryLock');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    page.answer(true);
    await page.click(page.section('deliveryLock').querySelector('[data-conflict] [data-action="load-latest"]'));
    expect(ta(page, 'deliveryLock', 0, 'limitation')).toBe('theirs');
    expect(page.section('deliveryFloor').querySelector('[data-conflict]')).not.toBeNull();
    await page.wait(4000);
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    expect(stored(page).delivery[0].floorPlanType).toBe('Confirm');
    expect(stored(page).delivery[0].limitation).toBe('theirs');
  });

  it('they changed Lock only; Save Lock refused; Load latest Lock; Save Floor keeps their Lock', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    await page.wait(1000);
    await someoneElseSaves(
      page,
      'delivery',
      (rows) => {
        rows[0].limitation = 'theirs';
      },
      'Confirm'
    );
    await page.saveSection('deliveryLock');
    page.answer(true);
    await page.click(page.section('deliveryLock').querySelector('[data-conflict] [data-action="load-latest"]'));
    await page.wait(4000);
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(stored(page).deliveryStatus).toBe('Confirm');
    expect(stored(page).delivery[1].floorEndDate).toBe('2026-11-04');
  });
});

describe('reads racing with saves (keep-newest)', () => {
  it('the read after save 1 answers after save 2: it is ignored (screen, base and cache keep save 2)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('knitting', 0, 'remarks', 'k1');
    // Hold the read that follows save 1.
    page.server.scriptNext('detail', { hold: true });
    await page.saveSection('knitting');
    expect(page.server.heldCount).toBe(1);
    await page.wait(2000);
    await page.set('dyeing', 1, 'remarks', 'd2');
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    const fpAfter2 = fingerprintDept(stored(page), 'dyeing');
    await page.wait(2000);
    // Now the stale read (taken before save 2) arrives; the read after save 2 is already in.
    page.server.releaseHeld();
    await page.settle();
    expect(ta(page, 'dyeing', 1, 'remarks')).toBe('d2');
    expect(page.pills('dyeing')).not.toContain('Unsaved');
    // The cache must still hold save 2: another department page paints it before its own read answers.
    page.server.scriptNext('detail', { hold: true });
    await page.reopen('delivery');
    expect(ta(page, 'dyeing', 1, 'remarks')).toBe('d2');
    page.server.releaseHeld();
    await page.settle();
    // The next Dyeing save must be based on save 2.
    await page.set('dyeing', 1, 'limitation', 'L3');
    await page.saveSection('dyeing');
    expect(lastSave(page).body.base).toEqual({ dyeing: fpAfter2 });
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
  });

  it('yd: an upload filled itemData Barrier Qty. while the stored top-level barrierQty is "" (invisible on the page): Save YD is refused', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'yd', role: 'planner' });
    // A first V3 save stores barrierQty '' at the top level.
    await page.set('yd', 0, 'remarks', 'first');
    await page.saveSection('yd');
    await page.wait(4000);
    const rec0 = stored(page);
    rec0.yd[0].barrierQty = '';
    rec0.yd[0].itemData = { ...rec0.yd[0].itemData, 'Barrier Qty.': '' };
    rec0.updatedAt = new Date(Date.now()).toISOString();
    await page.reload();
    await page.set('yd', 0, 'limitation', 'mine');
    await page.wait(1000);
    // Upload: itemData['Barrier Qty.'] filled from the file (existing was ''), top-level barrierQty kept ('').
    const rec = stored(page);
    rec.yd[0].itemData = { ...rec.yd[0].itemData, 'Barrier Qty.': 50 };
    rec.updatedAt = new Date(Date.now()).toISOString();
    await page.saveSection('yd');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('YD')}`);
    expect(stored(page).yd[0].itemData['Barrier Qty.']).toBe(50);
  });

  it('yd + read: the same upload, then a read (Knitting save), then Save YD: refused, their Barrier Qty. stays', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'yd', role: 'admin' });
    await page.set('yd', 0, 'remarks', 'first');
    await page.saveSection('yd');
    await page.wait(4000);
    const rec0 = stored(page);
    rec0.yd[0].barrierQty = '';
    rec0.yd[0].itemData = { ...rec0.yd[0].itemData, 'Barrier Qty.': '' };
    rec0.updatedAt = new Date(Date.now()).toISOString();
    await page.reload();
    await page.set('yd', 0, 'limitation', 'mine');
    await page.wait(1000);
    const rec = stored(page);
    rec.yd[0].itemData = { ...rec.yd[0].itemData, 'Barrier Qty.': 50 };
    rec.updatedAt = new Date(Date.now()).toISOString();
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.saveSection('yd');
    // A silent overwrite would leave ''.
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('YD')}`);
    expect(stored(page).yd[0].itemData['Barrier Qty.']).toBe(50);
  });

  it('a save answer older than the plan on screen (a read of a later save answered first) replaces neither the plan nor the cache', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    // A slow server instance: the read that follows save 1 is handled only when released (after save 2 and their save).
    const h = harnessState();
    const direct = h.fetchHandler!;
    let handleRead: (() => void) | null = null;
    h.fetchHandler = (input, init) => {
      const method = ((init || {}) as { method?: string }).method || 'GET';
      if (!handleRead && method === 'GET' && String(input).includes('/api/orders/SYN-S1?')) {
        return new Promise((resolve) => {
          handleRead = () => resolve(direct(input, init));
        });
      }
      return direct(input, init);
    };
    await page.set('knitting', 0, 'remarks', 'k1');
    await page.saveSection('knitting');
    expect(handleRead).not.toBeNull();
    await page.wait(2000);
    // Save 2 is stored now; its answer is held.
    await page.set('dyeing', 1, 'remarks', 'd2');
    page.server.scriptNext('saveDates', { hold: true });
    await page.saveSection('dyeing');
    expect(page.server.heldCount).toBe(1);
    await page.wait(1000);
    await someoneElseSaves(page, 'knitting', (rows) => {
      rows[1].limitation = 'theirs';
    });
    await page.wait(1000);
    // The read is handled now (it holds save 2 and their save) and answers first.
    handleRead!();
    await page.settle();
    expect(ta(page, 'knitting', 1, 'limitation')).toBe('theirs');
    // Save 2's (older) answer arrives; the read after it is held.
    page.server.scriptNext('detail', { hold: true });
    page.server.releaseHeld();
    await page.settle();
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(ta(page, 'dyeing', 1, 'remarks')).toBe('d2');
    expect(page.pills('dyeing')).not.toContain('Unsaved');
    expect(ta(page, 'knitting', 1, 'limitation')).toBe('theirs');
    // The cache still holds the newer read: the page opens again from it before its own read answers.
    await page.reopen();
    expect(ta(page, 'knitting', 1, 'limitation')).toBe('theirs');
    expect(ta(page, 'dyeing', 1, 'remarks')).toBe('d2');
    page.server.releaseHeld();
    await page.settle();
    expect(ta(page, 'knitting', 1, 'limitation')).toBe('theirs');
    expect(page.errors).toEqual([]);
  });

  it('the reducer: an older save answer keeps the newer plan and merges the saved group again from it', () => {
    const f = twoRows();
    const newer = { ...JSON.parse(JSON.stringify(f.orderDates[0])), updatedAt: '2026-11-21T05:00:00.000Z' };
    newer.dyeing[1].remarks = 'd2';
    newer.knitting[1].limitation = 'theirs';
    const m = initOrderPageModel(['knitting', 'dyeing'], { order: f.orders[0], planData: newer, fingerprints: { dyeing: 'fp-old' } }, {});
    const older = { ...JSON.parse(JSON.stringify(f.orderDates[0])), updatedAt: '2026-11-21T04:00:00.000Z' };
    older.dyeing[1].remarks = 'd2';
    const dirty = orderPageReducer(m, { type: 'rows', dept: 'dyeing', update: (rows) => rows.map((r, i) => (i === 0 ? { ...r, remarks: 'later' } : r)) });
    const next = orderPageReducer(dirty, { type: 'saved', saved: [{ dept: 'dyeing', groups: ['main'] }], planData: older, fingerprints: { dyeing: 'fp-2' } });
    expect(next.planData).toBe(newer);
    expect(next.drafts.dyeing.rows.map((r) => r.remarks)).toEqual(['', 'd2']);
    expect(next.drafts.knitting).toBe(m.drafts.knitting);
    expect(next.fingerprints.dyeing).toBe('fp-2');
    // A newer answer is taken as before.
    const newest = { ...older, updatedAt: '2026-11-21T06:00:00.000Z' };
    expect(orderPageReducer(dirty, { type: 'saved', saved: [{ dept: 'dyeing', groups: ['main'] }], planData: newest }).planData).toBe(newest);
  });

  it('a read answered while my Dyeing edit is dirty and someone else saved Dyeing: not absorbed even when it arrives late', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    const base0 = fingerprintDept(stored(page), 'dyeing');
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.wait(1000);
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[0].remarks = 'theirs';
    });
    await page.wait(1000);
    page.server.scriptNext('detail', { hold: true });
    await page.set('knitting', 0, 'remarks', 'k');
    await page.saveSection('knitting');
    await page.wait(1000);
    page.server.releaseHeld();
    await page.settle();
    await page.saveSection('dyeing');
    expect(lastSave(page).body.base).toEqual({ dyeing: base0 });
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
  });
});

describe('restore of a backup after someone else saved', () => {
  it('someone saved the OTHER delivery group after my backup: no offer, nothing restored over their data', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.wait(1000);
    const keys = Object.keys(sessionStorage).filter((k) => k.startsWith('planning.orderBackup:'));
    expect(keys).toHaveLength(1);
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.wait(1000);
    await page.reload();
    expect(document.querySelector('[data-restore-offer]')).toBeNull();
    expect(ta(page, 'deliveryLock', 0, 'limitation')).toBe('theirs');
    expect(page.field('deliveryFloor', 1, 'floorEndDate').value).toBe('2026-11-02');
  });

  it('offer shown, then someone else saves, then Restore and Save: refused, their change stays', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'dyeing', role: 'planner' });
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.wait(1000);
    await page.reload();
    expect(document.querySelector('[data-restore-offer]')).not.toBeNull();
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[0].remarks = 'theirs';
    });
    await page.click(document.querySelector('[data-action="restore-backup"]'));
    expect(ta(page, 'dyeing', 1, 'remarks')).toBe('mine');
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
    expect(stored(page).dyeing[0].remarks).toBe('theirs');
  });

  it('a backup written after the widened adoption is keyed by the adopted fingerprint and restores onto the read', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.wait(1000);
    const theirs = await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.wait(1000);
    await readViaKnittingSave(page);
    await page.wait(1000);
    const keys = Object.keys(sessionStorage).filter((k) => k.startsWith('planning.orderBackup:'));
    expect(keys.some((k) => k.endsWith(encodeURIComponent(theirs)))).toBe(true);
    await page.reload();
    expect(document.querySelector('[data-restore-offer]')).not.toBeNull();
    await page.click(document.querySelector('[data-action="restore-backup"]'));
    expect(page.field('deliveryFloor', 1, 'floorEndDate').value).toBe('2026-11-04');
    expect(ta(page, 'deliveryLock', 0, 'limitation')).toBe('theirs');
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery[0].limitation).toBe('theirs');
  });
});
