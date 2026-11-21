import { afterEach, describe, expect, it } from 'vitest';
import { openPage, type PageDriver } from './driver';
import { twoRows } from './fixtures';
import { API_BASE, TEST_TOKEN, fingerprintDept } from '../harness/mock-server';
import { ROLE_STORAGE } from '../harness/runner';
import { T } from '../golden/scenarios/texts';
import type { Loose } from '../harness/types';

// SPEC C2 item 8: the order page's unsaved work is backed up in sessionStorage (debounced, keyed by user, order,
// department and base fingerprint) and offered back on the next visit in this tab while the fingerprint still
// matches, so work survives a forced sign-out (midnight session end, heartbeat 401), a reload or a crash.

let page: PageDriver | null = null;
afterEach(() => {
  page?.close();
  page = null;
});

const PREFIX = 'planning.orderBackup:';
const stored = (p: PageDriver) => p.server.db.orderDates.find((d) => d.orderNo === 'SYN-S1');
const textarea = (p: PageDriver, key: string, row: number, name: string) => (p.field(key, row, name) as HTMLTextAreaElement).value;
const offer = () => document.querySelector('[data-restore-offer]') as HTMLElement | null;
const offerText = (labels: string[]) => `Unsaved changes from your last visit were kept for: ${labels.join(', ')}. Restore them?`;
const staleLine = () => document.querySelector('[data-restore-stale]') as HTMLElement | null;
const staleText = (labels: string) => `${labels} work from your last visit could not be restored: it was changed since.`;

function backupKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  return keys.sort();
}
const keyOf = (user: string, dept: string, fp: string) => `${PREFIX}${user}:SYN-S1:${dept}:${fp}`;

/** What a forced sign-out leaves in localStorage (the dashboard layout and the heartbeat remove these keys). */
function signOut() {
  ['token', 'user', 'username', 'role', 'permissions', 'status', 'sessionExpiresAt'].forEach((k) => localStorage.removeItem(k));
}
function signIn(role: keyof typeof ROLE_STORAGE) {
  Object.entries(ROLE_STORAGE[role]).forEach(([k, v]) => localStorage.setItem(k, v));
}

describe('the backup', () => {
  it('is written shortly after a change, per department, under the base fingerprint; a save removes it', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    const dyeingFp = fingerprintDept(stored(page), 'dyeing');
    await page.set('dyeing', 1, 'remarks', 'd mine');
    await page.setStatus('dyeing', 'Tentative');
    expect(backupKeys()).toEqual([]);
    await page.wait(600);
    expect(backupKeys()).toEqual([keyOf('admin', 'dyeing', dyeingFp)]);
    const backup = JSON.parse(sessionStorage.getItem(keyOf('admin', 'dyeing', dyeingFp)) as string);
    expect(backup).toMatchObject({ v: 1, dept: 'dyeing', base: dyeingFp, groups: ['main'], status: 'Tentative' });
    expect(backup.rows.map((r: Loose) => [r.itemId, r.remarks])).toEqual([
      ['syn-s1_red_solid', ''],
      ['syn-s1_blue_solid', 'd mine'],
    ]);
    // Only what the page edits is kept (no Excel data; fields without a value are left out by JSON).
    const editable = ['itemId', 'yarnDate', 'startDate', 'endDate', 'planType', 'limitation', 'remarks', 'unit', 'processName', 'floorStartDate', 'floorEndDate', 'floorPlanType', 'yarnOkDate', 'matchingOptionDate', 'barrierQty', 'workableQty'];
    for (const row of backup.rows) expect(Object.keys(row).filter((k) => !editable.includes(k))).toEqual([]);
    expect(Object.keys(backup.rows[1])).toEqual(expect.arrayContaining(['itemId', 'startDate', 'endDate', 'planType', 'remarks', 'unit', 'processName']));

    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    await page.wait(600);
    expect(backupKeys()).toEqual([]);
    expect(page.errors).toEqual([]);
  });

  it('survives a forced sign-out: after signing in again the page offers it, naming the sections; Restore puts it back', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('knitting', 1, 'remarks', 'k mine');
    await page.set('deliveryLock', 1, 'remarks', 'l mine');
    // Signed out at once (no time for the debounce): the page writes its backup when it goes away.
    signOut();
    await page.reload('knitting', () => signIn('admin'));
    expect(offer()?.textContent).toContain(offerText(['Knitting Plan', 'Delivery Plan (Lock)']));
    expect(offer()?.className).toContain('alert-warning');
    // Restore and Discard: a keyboard focus outline in the alert's own text colour (readable in both themes).
    offer()!.querySelectorAll('button').forEach((b) => expect(b.className).toContain('focus-visible:outline-warning-content'));
    // Not restored until asked: the saved values are shown, nothing is unsaved.
    expect(textarea(page, 'knitting', 1, 'remarks')).toBe('');
    expect(page.saveDataButton().disabled).toBe(true);

    await page.click(offer()!.querySelector('[data-action="restore-backup"]'));
    expect(offer()).toBeNull();
    expect(textarea(page, 'knitting', 1, 'remarks')).toBe('k mine');
    expect(textarea(page, 'deliveryLock', 1, 'remarks')).toBe('l mine');
    expect(page.pills('knitting')).toContain('Unsaved');
    expect(page.pills('deliveryLock')).toContain('Unsaved');
    expect(page.pills('deliveryFloor')).not.toContain('Unsaved');
    expect(page.saveDataButton().textContent).toBe('Save Data (2)');

    // Saved: the backup is gone, and the next visit offers nothing.
    await page.saveData();
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).knitting[1].remarks).toBe('k mine');
    await page.wait(600);
    expect(backupKeys()).toEqual([]);
    await page.reload();
    expect(offer()).toBeNull();
    expect(page.errors).toEqual([]);
  });

  it('Delivery groups and the Order Status come back as they were', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.setStatus('deliveryLock', 'Pending');
    await page.wait(600);
    await page.reload();
    expect(offer()?.textContent).toContain(offerText(['Delivery Plan (Floor)', 'Delivery Plan (Lock)']));
    await page.click(offer()!.querySelector('[data-action="restore-backup"]'));
    expect(page.field('deliveryFloor', 1, 'floorEndDate').value).toBe('2026-11-04');
    expect(page.generalStatus().value).toBe('Pending');
    expect(page.pills('deliveryFloor')).toContain('Unsaved');
    expect(page.pills('deliveryLock')).toContain('Unsaved');
    // Restored work is saved like any other.
    await page.saveData();
    expect(stored(page).deliveryStatus).toBe('Pending');
    expect(stored(page).delivery[1].floorEndDate).toBe('2026-11-04');
  });

  it('Discard of the offer removes it; Discard of a section removes that section only', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('knitting', 1, 'remarks', 'k mine');
    await page.set('dyeing', 1, 'remarks', 'd mine');
    await page.wait(600);
    expect(backupKeys()).toHaveLength(2);
    page.answer(true);
    await page.discard('dyeing');
    await page.wait(600);
    expect(backupKeys()).toEqual([keyOf('admin', 'knitting', fingerprintDept(stored(page), 'knitting'))]);

    await page.reload();
    expect(offer()?.textContent).toContain(offerText(['Knitting Plan']));
    await page.click(offer()!.querySelector('[data-action="drop-backup"]'));
    expect(offer()).toBeNull();
    expect(backupKeys()).toEqual([]);
    expect(textarea(page, 'knitting', 1, 'remarks')).toBe('');
    await page.reload();
    expect(offer()).toBeNull();
  });

  it('while the offer is shown, new work in other sections is backed up and the offered one is left alone', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'd mine');
    await page.wait(600);
    await page.reload();
    expect(offer()).not.toBeNull();
    await page.set('knitting', 1, 'remarks', 'k new');
    await page.wait(600);
    expect(backupKeys()).toEqual(
      [keyOf('admin', 'dyeing', fingerprintDept(stored(page), 'dyeing')), keyOf('admin', 'knitting', fingerprintDept(stored(page), 'knitting'))].sort()
    );
    await page.reload();
    expect(offer()?.textContent).toContain(offerText(['Knitting Plan', 'Dyeing Plan']));
  });
});

describe('when the backup is not offered', () => {
  it('someone else saved that department since (another fingerprint): not offered', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'd mine');
    await page.set('knitting', 1, 'remarks', 'k mine');
    await page.wait(600);
    // Another user saves Dyeing through the API.
    const record = stored(page);
    const rows = JSON.parse(JSON.stringify(record.dyeing));
    rows[0].remarks = 'theirs';
    const res = await page.server.fetch(`${API_BASE}/api/orders/save-plans`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNo: 'SYN-S1', plans: [{ department: 'dyeing', fabricItems: rows, orderStatus: 'Pending' }] }),
    });
    expect(res.status).toBe(200);
    await page.reload();
    // Knitting is still offered; Dyeing was saved by someone else, so its old work is not: one line says so.
    expect(offer()?.textContent).toContain(offerText(['Knitting Plan']));
    expect(offer()?.textContent).not.toContain('Dyeing');
    expect(staleLine()?.textContent).toBe(staleText('Dyeing Plan'));
  });

  it('saved since: the line is shown, then that backup is removed (not before); Close hides the line', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'd mine');
    await page.wait(600);
    const old = fingerprintDept(stored(page), 'dyeing');
    const rows = JSON.parse(JSON.stringify(stored(page).dyeing));
    rows[0].remarks = 'theirs';
    const res = await page.server.fetch(`${API_BASE}/api/orders/save-plans`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNo: 'SYN-S1', plans: [{ department: 'dyeing', fabricItems: rows, orderStatus: 'Pending' }] }),
    });
    expect(res.status).toBe(200);
    // A slow first read: until it answers, nothing is decided, shown or removed.
    page.server.scriptNext('detail', { hold: true });
    await page.reload();
    await page.wait(3000);
    expect(staleLine()).toBeNull();
    expect(backupKeys()).toEqual([keyOf('admin', 'dyeing', old)]);
    page.server.releaseHeld();
    await page.settle();
    expect(staleLine()?.textContent).toBe(staleText('Dyeing Plan'));
    expect(staleLine()?.getAttribute('role')).toBe('status');
    expect(offer()).toBeNull();
    expect(textarea(page, 'dyeing', 1, 'remarks')).toBe('');
    expect(textarea(page, 'dyeing', 0, 'remarks')).toBe('theirs');
    expect(backupKeys()).toEqual([]);
    await page.click(staleLine()!.querySelector('[aria-label="Close message"]'));
    expect(staleLine()).toBeNull();
    await page.reload();
    expect(staleLine()).toBeNull();
    expect(page.errors).toEqual([]);
  });

  it('saved since, for a section that is View only on this page: no line there, and the backup is left for its own page', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'dyeing', role: 'planner' });
    await page.set('dyeing', 1, 'remarks', 'd mine');
    await page.wait(600);
    const rows = JSON.parse(JSON.stringify(stored(page).dyeing));
    rows[0].remarks = 'theirs';
    const res = await page.server.fetch(`${API_BASE}/api/orders/save-plans`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNo: 'SYN-S1', plans: [{ department: 'dyeing', fabricItems: rows, orderStatus: 'Pending' }] }),
    });
    expect(res.status).toBe(200);
    await page.reload('knitting');
    expect(staleLine()).toBeNull();
    await page.wait(600);
    expect(backupKeys()).toHaveLength(1);
    await page.reload('dyeing');
    expect(staleLine()?.textContent).toBe(staleText('Dyeing Plan'));
    expect(backupKeys()).toEqual([]);
  });

  it('another user signed in in this tab: not offered, and the first user keeps it', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('knitting', 1, 'remarks', 'k mine');
    signOut();
    await page.reload('knitting', () => signIn('planner'));
    expect(offer()).toBeNull();
    await page.wait(600);
    expect(backupKeys()).toEqual([keyOf('admin', 'knitting', fingerprintDept(stored(page), 'knitting'))]);
    signOut();
    await page.reload('knitting', () => signIn('admin'));
    expect(offer()?.textContent).toContain(offerText(['Knitting Plan']));
  });

  it('a section the user may not change on this page is not offered there (View only)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'dyeing', role: 'planner' });
    await page.set('dyeing', 1, 'remarks', 'd mine');
    await page.wait(600);
    await page.reload('knitting');
    expect(offer()).toBeNull();
    expect(textarea(page, 'dyeing', 1, 'remarks')).toBe('');
    await page.reload('dyeing');
    expect(offer()?.textContent).toContain(offerText(['Dyeing Plan']));
  });

  it('the order has other items now: not offered', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('knitting', 1, 'remarks', 'k mine');
    await page.wait(600);
    // A new upload removed the Blue knitting row (the saved plan is unchanged, so the fingerprint still matches).
    page.server.db.orders[0].knittingItems.pop();
    await page.reload();
    expect(offer()).toBeNull();
  });

  it('storage that throws: the page works, keeps no backup and offers nothing', async () => {
    const proto = Object.getPrototypeOf(sessionStorage);
    const original = { get: proto.getItem, set: proto.setItem, remove: proto.removeItem, key: proto.key };
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    const blocked = function (this: Storage) {
      if (this === sessionStorage) throw new Error('blocked');
    };
    proto.getItem = function (this: Storage, k: string) {
      blocked.call(this);
      return original.get.call(this, k);
    };
    proto.setItem = function (this: Storage, k: string, v: string) {
      blocked.call(this);
      return original.set.call(this, k, v);
    };
    proto.removeItem = function (this: Storage, k: string) {
      blocked.call(this);
      return original.remove.call(this, k);
    };
    proto.key = function (this: Storage, i: number) {
      blocked.call(this);
      return original.key.call(this, i);
    };
    try {
      await page.set('knitting', 1, 'remarks', 'k mine');
      await page.wait(600);
      await page.saveSection('knitting');
      expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
      await page.set('knitting', 1, 'remarks', 'k again');
      await page.reload();
      expect(offer()).toBeNull();
      await page.set('knitting', 1, 'remarks', 'k 3');
      await page.wait(600);
    } finally {
      proto.getItem = original.get;
      proto.setItem = original.set;
      proto.removeItem = original.remove;
      proto.key = original.key;
    }
    expect(backupKeys()).toEqual([]);
    expect(page.errors).toEqual([]);
  });
});

describe('the offered work is protected until it is answered, and checked again on Restore', () => {
  it('a slow first read (longer than the backup delay): the earlier backup is not erased before it is offered', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'dyeing', role: 'planner' });
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.wait(1000);
    expect(backupKeys()).toHaveLength(1);
    page.server.scriptNext('detail', { hold: true });
    await page.reload();
    // The page waits 3 s for its first read; the debounced write and any flush must leave the backup alone.
    await page.wait(3000);
    expect(backupKeys()).toHaveLength(1);
    page.server.releaseHeld();
    await page.settle();
    expect(offer()?.textContent).toContain(offerText(['Dyeing Plan']));
    await page.click(offer()!.querySelector('[data-action="restore-backup"]'));
    expect(textarea(page, 'dyeing', 1, 'remarks')).toBe('mine');
    expect(page.errors).toEqual([]);
  });

  it('offer shown, someone saves that department, a read adopts their fingerprint: Restore does not put the old work on top', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.wait(1000);
    await page.reload();
    expect(offer()).not.toBeNull();
    // Another user saves Dyeing through the API.
    const rows = JSON.parse(JSON.stringify(stored(page).dyeing));
    rows[1].limitation = 'theirs';
    const res = await page.server.fetch(`${API_BASE}/api/orders/save-plans`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNo: 'SYN-S1', plans: [{ department: 'dyeing', fabricItems: rows, orderStatus: stored(page).dyeingStatus }] }),
    });
    expect(res.status).toBe(200);
    await page.wait(1000);
    // A Knitting save while the offer is shown reads the order again: the clean Dyeing section takes their data.
    await page.set('knitting', 0, 'remarks', 'k');
    await page.saveSection('knitting');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    await page.wait(4000);
    expect(textarea(page, 'dyeing', 1, 'limitation')).toBe('theirs');
    await page.click(offer()!.querySelector('[data-action="restore-backup"]'));
    // Not restored: the backup was made on the Dyeing plan before their save.
    expect(page.toasts.at(-1)).toBe('error: Some unsaved changes could not be restored: the saved plan has changed since.');
    expect(page.pills('dyeing')).not.toContain('Unsaved');
    expect(textarea(page, 'dyeing', 1, 'remarks')).toBe('');
    expect(textarea(page, 'dyeing', 1, 'limitation')).toBe('theirs');
    expect(stored(page).dyeing[1].limitation).toBe('theirs');
    expect(page.errors).toEqual([]);
  });
});
