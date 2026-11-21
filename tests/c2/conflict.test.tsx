import { afterEach, describe, expect, it } from 'vitest';
import { openPage, type PageDriver } from './driver';
import { twoRows } from './fixtures';
import { API_BASE, TEST_TOKEN, fingerprintDept } from '../harness/mock-server';
import { T } from '../golden/scenarios/texts';
import type { Loose } from '../harness/types';

// Plan D7: a save refused because someone else saved the same department after the page read it (409 CONFLICT).
// Each refused section shows an alert with "Load latest" and "Save mine anyway"; other sections keep their drafts.

let page: PageDriver | null = null;
afterEach(() => {
  page?.close();
  page = null;
});

const stored = (p: PageDriver) => p.server.db.orderDates.find((d) => d.orderNo === 'SYN-S1');
const alertOf = (p: PageDriver, key: string) => p.section(key).querySelector('[data-conflict]') as HTMLElement | null;
const textarea = (p: PageDriver, key: string, row: number, name: string) => (p.field(key, row, name) as HTMLTextAreaElement).value;
const lastSave = (p: PageDriver) => p.savePlansRequests().at(-1) as Loose;
const freshReads = (p: PageDriver) => p.server.log.filter((r) => r.method === 'GET' && r.url.includes('fresh=1')).map((r) => r.url);
const conflictText = (dept: string) => `${dept} was changed by someone else after this order was opened.`;

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

describe('a refused section Save', () => {
  it('shows the alert in that section only, keeps every draft and the server message; nothing is read again', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('knitting', 1, 'remarks', 'k mine');
    await page.set('dyeing', 1, 'remarks', 'd mine');
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[0].remarks = 'theirs';
    });

    await page.saveSection('dyeing');
    expect(page.toasts).toEqual([`error: ${conflictText('Dyeing')}`]);
    const alert = alertOf(page, 'dyeing');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.className).toContain('alert-warning');
    expect(alert?.textContent).toContain(conflictText('Dyeing'));
    expect(Array.from(alert!.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Load latest', 'Save mine anyway']);
    for (const key of ['knitting', 'deliveryFloor', 'deliveryLock']) expect(alertOf(page, key)).toBeNull();
    expect(page.pills('dyeing')).toContain('Unsaved');
    expect(page.pills('knitting')).toContain('Unsaved');
    expect(textarea(page, 'dyeing', 1, 'remarks')).toBe('d mine');
    expect(textarea(page, 'dyeing', 0, 'remarks')).toBe('');
    expect(stored(page).dyeing[1].remarks).toBe('');
    expect(freshReads(page)).toEqual([]);
    // The alert stays after the toast is gone.
    await page.wait(4000);
    expect(alertOf(page, 'dyeing')).not.toBeNull();
    expect(page.errors).toEqual([]);
  });

  it('Load latest asks first; Cancel keeps the draft; OK reads with fresh=1 and merges only that section again', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('knitting', 1, 'remarks', 'k mine');
    await page.set('dyeing', 1, 'remarks', 'd mine');
    const theirs = await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[0].remarks = 'theirs';
    });
    await page.saveSection('dyeing');

    page.answer(false);
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="load-latest"]'));
    expect(page.confirms).toEqual(['Load the latest saved Dyeing Plan? Your unsaved changes in Dyeing Plan will be lost.']);
    expect(freshReads(page)).toEqual([]);
    expect(textarea(page, 'dyeing', 1, 'remarks')).toBe('d mine');

    page.answer(true);
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="load-latest"]'));
    expect(freshReads(page)).toEqual(['/api/orders/SYN-S1?dept=knitting&fresh=1']);
    expect(textarea(page, 'dyeing', 0, 'remarks')).toBe('theirs');
    expect(textarea(page, 'dyeing', 1, 'remarks')).toBe('');
    expect(page.pills('dyeing')).not.toContain('Unsaved');
    expect(alertOf(page, 'dyeing')).toBeNull();
    // Other dirty sections keep their drafts.
    expect(textarea(page, 'knitting', 1, 'remarks')).toBe('k mine');
    expect(page.pills('knitting')).toContain('Unsaved');

    // The section adopted the read's fingerprint: a new edit saves on top of their change, without a conflict.
    await page.set('dyeing', 1, 'remarks', 'again');
    await page.wait(4000);
    await page.saveSection('dyeing');
    expect(lastSave(page).body.base).toEqual({ dyeing: theirs });
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).dyeing.map((r: Loose) => r.remarks)).toEqual(['theirs', 'again']);
    expect(page.errors).toEqual([]);
  });

  it('Save mine anyway reads the latest, then sends the section again based on that read and overwrites their change', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('knitting', 1, 'remarks', 'k mine');
    await page.set('dyeing', 1, 'remarks', 'd mine');
    const theirs = await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[0].remarks = 'theirs';
    });
    await page.saveSection('dyeing');
    const refused = lastSave(page);

    const from = page.server.log.length;
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="save-mine"]'));
    // Plan D7 (refined): a save rebased on a fresh read, with that read's fingerprint as its base.
    expect(page.server.log.slice(from, from + 2).map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET /api/orders/SYN-S1?dept=knitting&fresh=1',
      'POST /api/orders/save-plans',
    ]);
    const again = lastSave(page);
    expect(page.savePlansRequests()).toHaveLength(2);
    expect(again.body.base).toEqual({ dyeing: theirs });
    expect(again.body.plans).toEqual(refused.body.plans);
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).dyeing.map((r: Loose) => r.remarks)).toEqual(['', 'd mine']);
    expect(alertOf(page, 'dyeing')).toBeNull();
    expect(page.pills('dyeing')).not.toContain('Unsaved');
    expect(page.pills('knitting')).toContain('Unsaved');
    // Saved: the next Dyeing save has a base again (the fingerprint of what was just stored).
    const mine = fingerprintDept(stored(page), 'dyeing');
    await page.set('dyeing', 0, 'remarks', 'next');
    await page.wait(4000);
    await page.saveSection('dyeing');
    expect(lastSave(page).body.base).toEqual({ dyeing: mine });
    expect(page.errors).toEqual([]);
  });

  it('Save mine anyway is offered only while the section has unsaved work; Discard of a refused section loads the latest', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'dyeing', role: 'planner' });
    await page.set('dyeing', 1, 'remarks', 'd mine');
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[1].limitation = 'theirs';
    });
    await page.saveSection('dyeing');
    expect(alertOf(page, 'dyeing')?.querySelector('[data-action="save-mine"]')).not.toBeNull();
    // The value typed back: nothing unsaved, so nothing "of mine" to save over theirs.
    await page.set('dyeing', 1, 'remarks', '');
    expect(alertOf(page, 'dyeing')?.querySelector('[data-action="save-mine"]')).toBeNull();
    expect(alertOf(page, 'dyeing')?.textContent).toContain('Load latest shows their changes.');

    await page.set('dyeing', 1, 'remarks', 'd mine 2');
    page.answer(true);
    await page.discard('dyeing');
    expect(page.confirms).toEqual(['Discard the unsaved changes in Dyeing Plan?']);
    expect(freshReads(page)).toEqual(['/api/orders/SYN-S1?dept=dyeing&fresh=1']);
    expect(alertOf(page, 'dyeing')).toBeNull();
    expect(textarea(page, 'dyeing', 1, 'limitation')).toBe('theirs');
    expect(textarea(page, 'dyeing', 1, 'remarks')).toBe('');
    expect(page.errors).toEqual([]);
  });

  it('a failed Load latest read: the toast, the alert and the draft stay', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'dyeing', role: 'planner' });
    await page.set('dyeing', 1, 'remarks', 'd mine');
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[1].limitation = 'theirs';
    });
    await page.saveSection('dyeing');
    await page.wait(4000);
    page.server.scriptNext('detail', { networkError: true });
    page.answer(true);
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="load-latest"]'));
    expect(page.toasts.at(-1)).toBe('error: Could not load the latest plan of Order #SYN-S1. Please try again.');
    expect(alertOf(page, 'dyeing')).not.toBeNull();
    expect(textarea(page, 'dyeing', 1, 'remarks')).toBe('d mine');
    expect(page.errors).toEqual([]);
  });
});

describe('a refused Save Data', () => {
  async function refusedSaveData() {
    const p = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await p.set('knitting', 1, 'remarks', 'k mine');
    await p.set('dyeing', 1, 'remarks', 'd mine');
    await p.set('deliveryLock', 1, 'remarks', 'l mine');
    const bases = { knitting: fingerprintDept(stored(p), 'knitting'), delivery: fingerprintDept(stored(p), 'delivery') };
    const oldDyeing = fingerprintDept(stored(p), 'dyeing');
    const theirs = await someoneElseSaves(p, 'dyeing', (rows) => {
      rows[0].remarks = 'theirs';
    });
    return { p, bases, oldDyeing, theirs };
  }

  it('nothing is saved; only the refused section shows the alert and is brought into view', async () => {
    const { p } = await refusedSaveData();
    page = p;
    const scrolled: string[] = [];
    (Element.prototype as Loose).scrollIntoView = function () {
      scrolled.push(this.getAttribute('data-plan-section'));
    };
    try {
      await page.saveData();
    } finally {
      delete (Element.prototype as Loose).scrollIntoView;
    }
    expect(lastSave(page).body.plans.map((pl: Loose) => pl.department)).toEqual(['knitting', 'dyeing', 'delivery']);
    expect(page.toasts).toEqual([`error: ${conflictText('Dyeing')}`]);
    expect(scrolled).toEqual(['dyeing']);
    expect(alertOf(page, 'dyeing')).not.toBeNull();
    for (const key of ['knitting', 'deliveryFloor', 'deliveryLock']) expect(alertOf(page, key)).toBeNull();
    expect(stored(page).knitting[1].remarks).toBe('');
    expect(page.saveDataButton().textContent).toBe('Save Data (3)');
  });

  it('Save mine anyway: Save Data again, rebased on a fresh read for the refused department only', async () => {
    const { p, bases, theirs } = await refusedSaveData();
    page = p;
    await page.saveData();
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="save-mine"]'));
    const again = lastSave(page);
    expect(again.body.plans.map((pl: Loose) => pl.department)).toEqual(['knitting', 'dyeing', 'delivery']);
    expect(again.body.base).toEqual({ ...bases, dyeing: theirs });
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).knitting[1].remarks).toBe('k mine');
    expect(stored(page).dyeing.map((r: Loose) => r.remarks)).toEqual(['', 'd mine']);
    expect(stored(page).delivery[1].remarks).toBe('l mine');
    expect(page.saveDataButton().disabled).toBe(true);
    expect(document.querySelector('[data-conflict]')).toBeNull();
  });

  it('Load latest: the refused section is merged again; the next Save Data sends the other sections', async () => {
    const { p, bases } = await refusedSaveData();
    page = p;
    await page.saveData();
    page.answer(true);
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="load-latest"]'));
    expect(textarea(page, 'dyeing', 0, 'remarks')).toBe('theirs');
    expect(page.saveDataButton().textContent).toBe('Save Data (2)');
    await page.wait(4000);
    await page.saveData();
    const next = lastSave(page);
    expect(next.body.plans.map((pl: Loose) => pl.department)).toEqual(['knitting', 'delivery']);
    expect(next.body.base).toEqual(bases);
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).dyeing[0].remarks).toBe('theirs');
  });

  it('"Save mine anyway" is one click: refused again for another department, Dyeing keeps its old base and its alert', async () => {
    const { p, bases, oldDyeing, theirs } = await refusedSaveData();
    page = p;
    await page.saveData();
    // Meanwhile someone else saves Delivery too: the rebased Save Data is refused for Delivery.
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="save-mine"]'));
    expect(lastSave(page).body.base).toEqual({ ...bases, dyeing: theirs });
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    expect(alertOf(page, 'dyeing')).not.toBeNull();
    expect(alertOf(page, 'deliveryLock')).not.toBeNull();
    expect(alertOf(page, 'deliveryFloor')).toBeNull();
    expect(stored(page).dyeing[0].remarks).toBe('theirs');
    // Nothing was saved, so nothing was settled: a plain Save Data sends the old bases and is refused again.
    await page.wait(4000);
    await page.saveData();
    expect(lastSave(page).body.base).toEqual({ ...bases, dyeing: oldDyeing });
    expect(page.toasts.at(-1)).toBe('error: Dyeing and Delivery were changed by someone else after this order was opened.');
    expect(stored(page).dyeing[0].remarks).toBe('theirs');
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(page.errors).toEqual([]);
  });

  it('"Save mine anyway" after a refusal of the rebased save rebases both refused departments (no back and forth)', async () => {
    const { p, bases } = await refusedSaveData();
    page = p;
    await page.saveData();
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="save-mine"]'));
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    // Save mine anyway in the Delivery alert: Dyeing (still refused) and Delivery are both rebased on a new read.
    await page.wait(4000);
    const theirDyeing = fingerprintDept(stored(page), 'dyeing');
    const theirDelivery = fingerprintDept(stored(page), 'delivery');
    await page.click(alertOf(page, 'deliveryLock')!.querySelector('[data-action="save-mine"]'));
    expect(lastSave(page).body.base).toEqual({ knitting: bases.knitting, dyeing: theirDyeing, delivery: theirDelivery });
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(document.querySelector('[data-conflict]')).toBeNull();
    expect(stored(page).dyeing.map((r: Loose) => r.remarks)).toEqual(['', 'd mine']);
    expect(stored(page).delivery[0].limitation).toBe('');
    expect(stored(page).delivery[1].remarks).toBe('l mine');
    expect(page.errors).toEqual([]);
  });
});

describe('Delivery Floor and Lock (one fingerprint, two sections)', () => {
  it('both groups refused through Save Data: both show the alert; Load latest asks for and merges both', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.saveData();
    expect(alertOf(page, 'deliveryFloor')).not.toBeNull();
    expect(alertOf(page, 'deliveryLock')).not.toBeNull();
    page.answer(true);
    await page.click(alertOf(page, 'deliveryFloor')!.querySelector('[data-action="load-latest"]'));
    expect(page.confirms).toEqual([
      'Load the latest saved Delivery Plan (Floor), Delivery Plan (Lock)? Your unsaved changes in Delivery Plan (Floor), Delivery Plan (Lock) will be lost.',
    ]);
    expect(document.querySelector('[data-conflict]')).toBeNull();
    expect(textarea(page, 'deliveryLock', 0, 'limitation')).toBe('theirs');
    expect(page.field('deliveryFloor', 1, 'floorEndDate').value).toBe('2026-11-02');
    expect(page.saveDataButton().disabled).toBe(true);
  });

  it('Save Floor refused for a Floor change of theirs: Load latest of Floor keeps the Lock draft, and Save Lock then keeps their change', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    const theirs = await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].floorPlanType = 'Confirm';
    });
    await page.saveSection('deliveryFloor');
    expect(alertOf(page, 'deliveryFloor')).not.toBeNull();
    expect(alertOf(page, 'deliveryLock')).toBeNull();

    page.answer(true);
    await page.click(alertOf(page, 'deliveryFloor')!.querySelector('[data-action="load-latest"]'));
    expect(page.confirms).toEqual(['Load the latest saved Delivery Plan (Floor)? Your unsaved changes in Delivery Plan (Floor) will be lost.']);
    expect(page.field('deliveryFloor', 0, 'floorPlanType').value).toBe('Confirm');
    expect(page.pills('deliveryFloor')).not.toContain('Unsaved');
    // The Lock draft was made on Lock values nobody changed: it stays, and the read's fingerprint is the base now.
    expect(textarea(page, 'deliveryLock', 1, 'remarks')).toBe('l mine');
    expect(page.pills('deliveryLock')).toContain('Unsaved');
    expect(document.querySelector('[data-conflict]')).toBeNull();

    await page.wait(4000);
    await page.saveSection('deliveryLock');
    expect(lastSave(page).body.base).toEqual({ delivery: theirs });
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery.map((r: Loose) => [r.floorPlanType, r.remarks])).toEqual([
      ['Confirm', ''],
      ['Tentative', 'l mine'],
    ]);
  });

  it('Save Floor refused for a Lock change of theirs while Lock has a draft: after Load latest of Floor the alert moves to Lock', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    const theirs = await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.saveSection('deliveryFloor');
    page.answer(true);
    await page.click(alertOf(page, 'deliveryFloor')!.querySelector('[data-action="load-latest"]'));
    // Saving Floor would send the Lock values this page read first (overwriting theirs): Lock is the refused part now.
    expect(alertOf(page, 'deliveryFloor')).toBeNull();
    expect(alertOf(page, 'deliveryLock')).not.toBeNull();
    expect(textarea(page, 'deliveryLock', 0, 'limitation')).toBe('');

    // Save mine anyway on Lock: the Lock section rebased on a fresh read (mine overwrites theirs, as stored now).
    await page.wait(4000);
    await page.click(alertOf(page, 'deliveryLock')!.querySelector('[data-action="save-mine"]'));
    const req = lastSave(page);
    expect(req.body.base).toEqual({ delivery: theirs });
    expect(req.body.plans[0].fabricItems.map((r: Loose) => [r.limitation, r.remarks, r.floorEndDate])).toEqual([
      ['', '', '2026-11-01'],
      ['', 'l mine', '2026-11-02'],
    ]);
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(document.querySelector('[data-conflict]')).toBeNull();
    expect(page.errors).toEqual([]);
  });
});
