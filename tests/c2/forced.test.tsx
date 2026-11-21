import { afterEach, describe, expect, it } from 'vitest';
import { openPage, type PageDriver } from './driver';
import { twoRows } from './fixtures';
import { API_BASE, TEST_TOKEN, fingerprintDept } from '../harness/mock-server';
import { T } from '../golden/scenarios/texts';
import { harnessState } from '../harness/state';
import type { Loose } from '../harness/types';

// Plan D7 refined (SPEC section 6): "Save mine anyway" overwrites the conflicting change the user was warned about,
// as it is stored NOW, and nothing that arrives later. It is a REBASED save, never a save without a conflict check:
// - one click, no lasting state: a failed, refused or cancelled forced save leaves the old base and the alert, so the
//   next plain save is a normal checked save (409 again);
// - it reads the order with fresh=1 first and sends that read's fingerprint as the base (a later change: 409 again);
// - the rows are the fresh read's rows with the user's draft values on top, only for the fields the save covers;
// - a Delivery Floor save sends the stored status; a Completed prompt only for a status the user changed.
// N1-N7 and S1-S3 are the final verification's adversarial sequences (round 2), with the expectations of the refined
// design; the rest covers what they do not.

let page: PageDriver | null = null;
afterEach(() => {
  page?.close();
  page = null;
});

const stored = (p: PageDriver) => p.server.db.orderDates.find((d) => d.orderNo === 'SYN-S1');
const lastSave = (p: PageDriver) => p.savePlansRequests().at(-1) as Loose;
const conflictText = (dept: string) => `${dept} was changed by someone else after this order was opened.`;
const ta = (p: PageDriver, key: string, row: number, name: string) => (p.field(key, row, name) as HTMLTextAreaElement).value;
const alertIn = (p: PageDriver, key: string) => p.section(key).querySelector('[data-conflict]');
const saveMine = (p: PageDriver, key: string) => p.click(alertIn(p, key)!.querySelector('[data-action="save-mine"]'));
const requests = (p: PageDriver, from: number) => p.server.log.slice(from).map((r) => `${r.method} ${r.url}`);
const COMPLETED_PROMPT = "Are you sure you want to mark order 'SYN-S1' as Completed? It will be moved to the Completed List.";
const FRESH_READ = 'GET /api/orders/SYN-S1?dept=delivery&fresh=1';
const SAVE_PLANS = 'POST /api/orders/save-plans';

function saveBody(p: PageDriver, dept: string, edit: (rows: Loose[]) => void, status?: string) {
  const record = stored(p);
  const rows = JSON.parse(JSON.stringify(record[dept]));
  edit(rows);
  return JSON.stringify({ orderNo: 'SYN-S1', plans: [{ department: dept, fabricItems: rows, orderStatus: status ?? record[`${dept}Status`] }] });
}

/** Another user saves `dept` through the API (save-plans without base); not a request of this page. */
async function someoneElseSaves(p: PageDriver, dept: string, edit: (rows: Loose[]) => void, status?: string) {
  const body = saveBody(p, dept, edit, status);
  const before = p.server.log.length;
  const res = await p.server.fetch(`${API_BASE}/api/orders/save-plans`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
    body,
  });
  p.server.log.splice(before);
  expect(res.status).toBe(200);
  return fingerprintDept(stored(p), dept);
}

/** Floor draft, their Lock change, Save Floor refused (409). Returns the base the page read first and theirs. */
async function refusedFloor(p: PageDriver) {
  const mine = fingerprintDept(stored(p), 'delivery');
  await p.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
  await p.wait(1000);
  const theirs = await someoneElseSaves(p, 'delivery', (rows) => {
    rows[0].limitation = 'theirs';
  });
  await p.saveSection('deliveryFloor');
  expect(p.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
  await p.wait(4000);
  return { mine, theirs };
}

describe('"Save mine anyway" is one click: a failed forced save leaves the conflict check in place', () => {
  it('N1: the forced POST fails (network): the alert stays, and a later plain Save Floor is refused, their Lock stays', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    const { mine, theirs } = await refusedFloor(page);
    page.server.scriptNext('saveDates', { networkError: true });
    const from = page.server.log.length;
    await saveMine(page, 'deliveryFloor');
    expect(requests(page, from)).toEqual([FRESH_READ, SAVE_PLANS]);
    expect(lastSave(page).body.base).toEqual({ delivery: theirs });
    expect(page.toasts.at(-1)).toBe('error: Failed to fetch');
    expect(alertIn(page, 'deliveryFloor')).not.toBeNull();
    expect(page.field('deliveryFloor', 1, 'floorEndDate').value).toBe('2026-11-04');
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    await page.wait(4000);
    await page.saveSection('deliveryFloor');
    // A normal checked save: the old base, refused again; no fresh read was used for its rows.
    expect(lastSave(page).body.base).toEqual({ delivery: mine });
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(stored(page).delivery[1]?.floorEndDate).not.toBe('2026-11-04');
    expect(page.errors).toEqual([]);
  });

  it('N1b: their Lock change and Completed status: my forced Floor save asks no Completed prompt and keeps both', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.wait(1000);
    const theirs = await someoneElseSaves(
      page,
      'delivery',
      (rows) => {
        rows[0].limitation = 'theirs';
      },
      'Completed'
    );
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    await page.wait(4000);
    await saveMine(page, 'deliveryFloor');
    // The Completed status is theirs, not a choice of mine: no prompt.
    expect(page.confirms).toEqual([]);
    const req = lastSave(page);
    expect(req.body.base).toEqual({ delivery: theirs });
    expect(req.body.plans[0].orderStatus).toBe('Completed');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(stored(page).deliveryStatus).toBe('Completed');
    expect(stored(page).delivery[1].floorEndDate).toBe('2026-11-04');
    // Saved: the next plain Save Floor is based on the answer.
    await page.wait(4000);
    expect(document.querySelector('[data-conflict]')).toBeNull();
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-05');
    await page.saveSection('deliveryFloor');
    expect(page.confirms).toEqual([]);
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(stored(page).deliveryStatus).toBe('Completed');
    expect(page.errors).toEqual([]);
  });

  it('N1b (status chosen by me): forced Save Lock with my Completed asks; Cancel sends nothing, then a plain Save Lock is refused', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    const mine = fingerprintDept(stored(page), 'delivery');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    await page.setStatus('deliveryLock', 'Completed');
    await page.wait(1000);
    await someoneElseSaves(
      page,
      'delivery',
      (rows) => {
        rows[0].limitation = 'theirs';
      },
      'Confirm'
    );
    page.answer(true);
    await page.saveSection('deliveryLock');
    expect(page.confirms).toEqual([COMPLETED_PROMPT]);
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    await page.wait(4000);
    page.answer(false);
    const posts = page.savePlansRequests().length;
    await saveMine(page, 'deliveryLock');
    // My own change to Completed (the fresh read stores Confirm): today's prompt. Cancel: nothing is sent, and the
    // status goes back to the one this page shows as saved (not to theirs, which this page has not shown).
    expect(page.confirms).toEqual([COMPLETED_PROMPT, COMPLETED_PROMPT]);
    expect(page.savePlansRequests()).toHaveLength(posts);
    expect(page.generalStatus().value).toBe('Tentative');
    expect(alertIn(page, 'deliveryLock')).not.toBeNull();
    expect(ta(page, 'deliveryLock', 1, 'remarks')).toBe('l mine');
    await page.saveSection('deliveryLock');
    expect(lastSave(page).body.base).toEqual({ delivery: mine });
    expect(lastSave(page).body.plans[0].orderStatus).toBe('Tentative');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(stored(page).deliveryStatus).toBe('Confirm');
    expect(page.errors).toEqual([]);
  });

  it('S3: the forced Save Data gets a 500; a plain Save Data then is refused, their Lock stays', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    const mine = fingerprintDept(stored(page), 'delivery');
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.wait(1000);
    const theirs = await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.saveData();
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    await page.wait(4000);
    page.server.scriptNext('saveDates', { status: 500, json: { message: 'Database write failed.' } });
    await saveMine(page, 'deliveryFloor');
    expect(lastSave(page).body.base).toEqual({ delivery: theirs });
    expect(page.toasts.at(-1)).toBe('error: Database write failed.');
    expect(alertIn(page, 'deliveryFloor')).not.toBeNull();
    await page.wait(4000);
    await page.saveData();
    expect(lastSave(page).body.base).toEqual({ delivery: mine });
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(page.errors).toEqual([]);
  });

  it('a forced save that the checks refuse sends nothing and leaves the old base', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    const mine = fingerprintDept(stored(page), 'delivery');
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.wait(1000);
    // Their Lock change (saved without the page's checks) has an end before its start: today's check refuses it.
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].startDate = '2026-11-10';
    });
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    await page.wait(4000);
    const posts = page.savePlansRequests().length;
    await saveMine(page, 'deliveryFloor');
    expect(page.savePlansRequests()).toHaveLength(posts);
    expect(page.toasts.at(-1)).toBe('error: Save failed: End date cant be less than start date.');
    expect(alertIn(page, 'deliveryFloor')).not.toBeNull();
    await page.wait(4000);
    await page.saveSection('deliveryFloor');
    expect(lastSave(page).body.base).toEqual({ delivery: mine });
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    expect(stored(page).delivery[0].startDate).toBe('2026-11-10');
    expect(page.errors).toEqual([]);
  });
});

describe('"Save mine anyway" is sent with the fresh read\'s base', () => {
  it('N2: their Lock change lands between the fresh read and my POST: refused again (409), the alert shows again', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await refusedFloor(page);
    const h = harnessState();
    const direct = h.fetchHandler!;
    const p = page;
    let injected = false;
    h.fetchHandler = async (input, init) => {
      const res = await direct(input, init);
      const method = ((init || {}) as { method?: string }).method || 'GET';
      if (!injected && method === 'GET' && String(input).includes('fresh=1')) {
        injected = true;
        // Someone else saves Lock again right after the page's fresh read was answered.
        const body = saveBody(p, 'delivery', (rows) => {
          rows[0].remarks = 'their later remark';
        });
        const before = p.server.log.length;
        await p.server.fetch(`${API_BASE}/api/orders/save-plans`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
          body,
        });
        p.server.log.splice(before, 1);
      }
      return res;
    };
    try {
      await saveMine(page, 'deliveryFloor');
    } finally {
      h.fetchHandler = direct;
    }
    expect(injected).toBe(true);
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    expect(alertIn(page, 'deliveryFloor')).not.toBeNull();
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(stored(page).delivery[0].remarks).toBe('their later remark');
    // Warned again: Save mine anyway now keeps both of their Lock changes and saves my Floor.
    await page.wait(4000);
    await saveMine(page, 'deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(stored(page).delivery[0].remarks).toBe('their later remark');
    expect(stored(page).delivery[1].floorEndDate).toBe('2026-11-04');
    expect(page.errors).toEqual([]);
  });

  it('N3: both groups dirty, Save Data refused: Save mine anyway sends my Floor and Lock on the fresh read (mine overwrite theirs)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    await page.wait(1000);
    const theirs = await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.saveData();
    await page.wait(4000);
    await saveMine(page, 'deliveryLock');
    expect(lastSave(page).body.base).toEqual({ delivery: theirs });
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    // By design: the Lock section is mine, as on my screen; the user was warned about Delivery.
    expect(stored(page).delivery.map((r: Loose) => [r.limitation, r.remarks, r.floorEndDate])).toEqual([
      ['', '', '2026-11-01'],
      ['', 'l mine', '2026-11-04'],
    ]);
    expect(document.querySelector('[data-conflict]')).toBeNull();
    expect(page.errors).toEqual([]);
  });

  it('N4: their status-only change (Lock group) and my Floor draft: Save mine anyway keeps their status', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.wait(1000);
    await someoneElseSaves(page, 'delivery', () => {}, 'Confirm');
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    await page.wait(4000);
    await saveMine(page, 'deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).deliveryStatus).toBe('Confirm');
    expect(stored(page).delivery[1].floorEndDate).toBe('2026-11-04');
    expect(page.generalStatus().value).toBe('Confirm');
    expect(page.errors).toEqual([]);
  });

  it('n03: Lock draft, their Floor change: Save mine anyway on Lock keeps their Floor (from the fresh read)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    await page.wait(1000);
    const theirs = await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].floorPlanType = 'Confirm';
      rows[0].floorEndDate = '2026-11-03';
    });
    await page.saveSection('deliveryLock');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    await page.wait(4000);
    await saveMine(page, 'deliveryLock');
    const req = lastSave(page);
    expect(req.body.base).toEqual({ delivery: theirs });
    expect(req.body.plans[0].fabricItems.map((r: Loose) => [r.floorPlanType, r.floorEndDate, r.remarks])).toEqual([
      ['Confirm', '2026-11-03', ''],
      ['Tentative', '2026-11-02', 'l mine'],
    ]);
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery[0].floorPlanType).toBe('Confirm');
    expect(stored(page).delivery[0].floorEndDate).toBe('2026-11-03');
    expect(stored(page).delivery[1].remarks).toBe('l mine');
    expect(page.errors).toEqual([]);
  });
});

describe('what a forced save leaves behind', () => {
  it('N5: Load latest after a forced save that left my Lock work stale: Lock merged, conflict gone, next save based on the read', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    await page.wait(1000);
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.saveSection('deliveryFloor');
    await page.wait(4000);
    await saveMine(page, 'deliveryFloor');
    const afterForced = fingerprintDept(stored(page), 'delivery');
    await page.wait(4000);
    expect(alertIn(page, 'deliveryLock')).not.toBeNull();
    page.answer(true);
    await page.click(alertIn(page, 'deliveryLock')!.querySelector('[data-action="load-latest"]'));
    expect(document.querySelector('[data-conflict]')).toBeNull();
    expect(ta(page, 'deliveryLock', 0, 'limitation')).toBe('theirs');
    expect(ta(page, 'deliveryLock', 1, 'remarks')).toBe('');
    await page.wait(4000);
    await page.set('deliveryLock', 1, 'remarks', 'again');
    await page.saveSection('deliveryLock');
    expect(lastSave(page).body.base).toEqual({ delivery: afterForced });
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(stored(page).delivery[1].remarks).toBe('again');
    expect(stored(page).delivery[1].floorEndDate).toBe('2026-11-04');
    expect(page.errors).toEqual([]);
  });

  it('N6: a reload after a forced save that left my Lock work stale: not offered, the line names it, nothing overwritten', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    await page.wait(1000);
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.saveSection('deliveryFloor');
    await page.wait(4000);
    await saveMine(page, 'deliveryFloor');
    await page.wait(4000);
    await page.reload();
    expect(document.querySelector('[data-restore-offer]')).toBeNull();
    expect(document.querySelector('[data-restore-stale]')?.textContent).toBe(
      'Delivery Plan (Lock) work from your last visit could not be restored: it was changed since.'
    );
    expect(page.pills('deliveryLock')).not.toContain('Unsaved');
    expect(stored(page).delivery[0].limitation).toBe('theirs');
    expect(page.errors).toEqual([]);
  });

  /** An upload added a Green item; someone planned it (Lock: 'their green'), and, unless `unplannedUpstream`, also
   *  its Knitting and Dyeing. Not a request of this page. */
  function uploadAddsGreen(p: PageDriver, unplannedUpstream = false) {
    const order = p.server.db.orders[0];
    const rec = stored(p);
    order.deliveryItems.push({ ...order.deliveryItems[0], Color: 'Green', FabricConstruction: 'Pique', GSM: 200 });
    if (!unplannedUpstream) {
      order.knittingItems.push({ ...order.knittingItems[0], Color: 'Green', FabricConstruction: 'Pique', GSM: 200 });
      order.dyeingItems.push({ ...order.dyeingItems[0], Color: 'Green' });
      rec.knitting.push({
        itemId: 'syn-s1_green_pique_200',
        itemData: { Color: 'Green', FabricConstruction: 'Pique' },
        startDate: '2026-10-07',
        endDate: '2026-10-17',
        planType: 'Tentative',
        limitation: '',
        remarks: '',
        yarnDate: '2026-10-01',
      });
      rec.dyeing.push({
        itemId: 'syn-s1_green_solid',
        itemData: { Color: 'Green', Unit: 'EFL', ProcessName: 'Solid', 'Process Name': 'Solid' },
        startDate: '2026-10-18',
        endDate: '2026-10-27',
        planType: 'Tentative',
        limitation: '',
        remarks: '',
      });
    }
    rec.delivery.push({
      itemId: 'syn-s1_green_pique_200',
      itemData: { Color: 'Green', FabricConstruction: 'Pique' },
      startDate: '2026-10-27',
      endDate: '2026-11-06',
      planType: 'Tentative',
      limitation: 'their green',
      remarks: '',
      floorStartDate: '',
      floorEndDate: '',
      floorPlanType: '',
    });
    rec.updatedAt = new Date(Date.now()).toISOString();
  }

  it('N7: an upload added a delivery item someone planned (Lock): my forced Floor save keeps their row', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.wait(1000);
    uploadAddsGreen(page);
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    await page.wait(4000);
    await saveMine(page, 'deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    const d = stored(page);
    expect(d.delivery.map((r: Loose) => r.itemId)).toEqual(['syn-s1_red_s/j_160', 'syn-s1_blue_rib_180', 'syn-s1_green_pique_200']);
    // Their Green row as a reload shows it: their Lock values, and today's Floor defaults (Dyeing + 7 days) for its
    // blank Floor fields.
    expect(d.delivery.map((r: Loose) => [r.limitation, r.startDate, r.endDate, r.floorStartDate, r.floorEndDate])).toEqual([
      ['', '2026-10-26', '2026-11-05', '2026-10-23', '2026-11-01'],
      ['', '', '', '2026-10-24', '2026-11-04'],
      ['their green', '2026-10-27', '2026-11-06', '2026-10-25', '2026-11-03'],
    ]);
    // The page shows their row, with nothing unsaved and no alert.
    await page.wait(4000);
    expect(ta(page, 'deliveryLock', 2, 'limitation')).toBe('their green');
    expect(page.pills('deliveryFloor')).not.toContain('Unsaved');
    expect(document.querySelector('[data-conflict]')).toBeNull();
    expect(page.errors).toEqual([]);
  });

  it('N7, and the read after the save fails: the page keeps their row, so a later plain Save Floor does not drop it', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.wait(1000);
    uploadAddsGreen(page);
    await page.saveSection('deliveryFloor');
    await page.wait(4000);
    // The forced save's fresh read is answered; the read after the save is lost.
    page.server.scriptNext('detail', {});
    page.server.scriptNext('detail', { status: 500, json: { message: 'Server error while loading the order.' } });
    await saveMine(page, 'deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(page.server.pendingScripts()).toEqual([]);
    // The saved rows were merged over the fresh read's order: their Green row is on screen.
    expect(ta(page, 'deliveryLock', 2, 'limitation')).toBe('their green');
    await page.wait(4000);
    await page.set('deliveryFloor', 0, 'floorEndDate', '2026-11-02');
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery.map((r: Loose) => [r.itemId, r.limitation])).toEqual([
      ['syn-s1_red_s/j_160', ''],
      ['syn-s1_blue_rib_180', ''],
      ['syn-s1_green_pique_200', 'their green'],
    ]);
    expect(page.errors).toEqual([]);
  });

  it('N7 (as found: the added item has no Dyeing plan): today\'s check refuses the forced save; their row stays, nothing is sent', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.wait(1000);
    uploadAddsGreen(page, true);
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    await page.wait(4000);
    const posts = page.savePlansRequests().length;
    await saveMine(page, 'deliveryFloor');
    expect(page.toasts.at(-1)).toBe('error: Save failed: Dyeing Plan type selection is mandatory before inputting Delivery plan!');
    expect(page.savePlansRequests()).toHaveLength(posts);
    expect(alertIn(page, 'deliveryFloor')).not.toBeNull();
    expect(stored(page).delivery.map((r: Loose) => r.limitation)).toEqual(['', 'their green']);
    expect(page.errors).toEqual([]);
  });

  it('a non-delivery section: an upload added a Dyeing item someone planned; my forced Dyeing save keeps their row', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'dyeing', role: 'planner' });
    await page.set('dyeing', 1, 'remarks', 'd mine');
    await page.wait(1000);
    const order = page.server.db.orders[0];
    order.knittingItems.push({ ...order.knittingItems[0], Color: 'Green', FabricConstruction: 'Pique', GSM: 200 });
    order.dyeingItems.push({ ...order.dyeingItems[0], Color: 'Green' });
    const rec = stored(page);
    rec.knitting.push({
      itemId: 'syn-s1_green_pique_200',
      itemData: { Color: 'Green', FabricConstruction: 'Pique' },
      startDate: '2026-10-07',
      endDate: '2026-10-17',
      planType: 'Tentative',
      limitation: '',
      remarks: '',
      yarnDate: '2026-10-01',
    });
    rec.dyeing.push({
      itemId: 'syn-s1_green_solid',
      itemData: { Color: 'Green', Unit: 'EFL', ProcessName: 'Solid', 'Process Name': 'Solid' },
      startDate: '2026-10-18',
      endDate: '2026-10-27',
      planType: 'Tentative',
      limitation: 'their green',
      remarks: '',
    });
    rec.updatedAt = new Date(Date.now()).toISOString();
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
    await page.wait(4000);
    await saveMine(page, 'dyeing');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    const d = stored(page);
    expect(d.dyeing.map((r: Loose) => [r.itemId, r.remarks, r.limitation])).toEqual([
      ['syn-s1_red_solid', '', ''],
      ['syn-s1_blue_solid', 'd mine', ''],
      ['syn-s1_green_solid', '', 'their green'],
    ]);
    expect(page.errors).toEqual([]);
  });

  it('a draft item the order no longer has (an upload removed it) is left out, as a reload would leave it out', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'dyeing', role: 'planner' });
    await page.set('dyeing', 0, 'remarks', 'red mine');
    await page.set('dyeing', 1, 'remarks', 'blue mine');
    await page.wait(1000);
    const order = page.server.db.orders[0];
    order.dyeingItems.splice(0, 1);
    const rec = stored(page);
    rec.dyeing.splice(0, 1);
    rec.updatedAt = new Date(Date.now()).toISOString();
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
    await page.wait(4000);
    await saveMine(page, 'dyeing');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(lastSave(page).body.plans[0].fabricItems.map((r: Loose) => [r.itemId, r.remarks])).toEqual([['syn-s1_blue_solid', 'blue mine']]);
    expect(stored(page).dyeing.map((r: Loose) => [r.itemId, r.remarks])).toEqual([['syn-s1_blue_solid', 'blue mine']]);
    expect(page.errors).toEqual([]);
  });
});

describe('the `saved` logic around one Delivery group', () => {
  it('S1: plain Save Floor while Lock is dirty (nobody else): Lock stays unsaved, adopts the base; Save Lock then goes through', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    await page.setStatus('deliveryLock', 'Confirm');
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).deliveryStatus).toBe('Tentative');
    expect(page.pills('deliveryLock')).toContain('Unsaved');
    expect(document.querySelector('[data-conflict]')).toBeNull();
    await page.wait(4000);
    await page.saveSection('deliveryLock');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).deliveryStatus).toBe('Confirm');
    expect(stored(page).delivery[1].remarks).toBe('l mine');
    expect(stored(page).delivery[1].floorEndDate).toBe('2026-11-04');
    expect(page.errors).toEqual([]);
  });

  it('S2: forced Save Lock while my Floor draft was made before their Floor change: Floor alert, a plain Save Floor refused', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    await page.wait(1000);
    await someoneElseSaves(page, 'delivery', (rows) => {
      rows[0].floorPlanType = 'Confirm';
    });
    await page.saveSection('deliveryLock');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    await page.wait(4000);
    await saveMine(page, 'deliveryLock');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery[0].floorPlanType).toBe('Confirm');
    await page.wait(4000);
    expect(alertIn(page, 'deliveryFloor')).not.toBeNull();
    await page.saveSection('deliveryFloor');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Delivery')}`);
    expect(stored(page).delivery[0].floorPlanType).toBe('Confirm');
    expect(stored(page).delivery[1].remarks).toBe('l mine');
    expect(page.errors).toEqual([]);
  });
});
