import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { openPage, type PageDriver } from './driver';
import { twoRows } from './fixtures';
import { API_BASE, TEST_TOKEN } from '../harness/mock-server';
import { T } from '../golden/scenarios/texts';
import { initOrderPageModel, isOlderPlanData, orderPageReducer } from '@/features/planning/lib/order-page-model';

// The lows carried over from the C2a verification (SPEC section 6, items 1-5).

let page: PageDriver | null = null;
afterEach(() => {
  page?.close();
  page = null;
});

const stored = (p: PageDriver) => p.server.db.orderDates.find((d) => d.orderNo === 'SYN-S1');
const textarea = (p: PageDriver, key: string, row: number, name: string) => (p.field(key, row, name) as HTMLTextAreaElement).value;
const statusOf = (p: PageDriver, key: string) => p.section(key).querySelector('[data-field="orderStatus"]') as HTMLSelectElement;

describe('1. a read without a plan (or without updatedAt) is older than a saved plan on screen', () => {
  it('isOlderPlanData', () => {
    const saved = { updatedAt: '2026-11-21T04:00:00.000Z' };
    expect(isOlderPlanData(null, saved)).toBe(true);
    expect(isOlderPlanData({}, saved)).toBe(true);
    expect(isOlderPlanData({ updatedAt: 'not a date' }, saved)).toBe(true);
    expect(isOlderPlanData({ updatedAt: '2026-11-21T03:59:59.999Z' }, saved)).toBe(true);
    expect(isOlderPlanData({ updatedAt: '2026-11-21T04:00:00.000Z' }, saved)).toBe(false);
    expect(isOlderPlanData({ updatedAt: '2026-11-21T04:00:01.000Z' }, saved)).toBe(false);
    // Nothing saved on screen yet: any read is taken.
    expect(isOlderPlanData(null, null)).toBe(false);
    expect(isOlderPlanData({}, {})).toBe(false);
    expect(isOlderPlanData({ updatedAt: '2026-01-01T00:00:00.000Z' }, {})).toBe(false);
  });

  it('the reducer ignores such a read', () => {
    const f = twoRows();
    const m = initOrderPageModel(['knitting'], { order: f.orders[0], planData: { ...f.orderDates[0], updatedAt: '2026-11-21T04:00:00.000Z' } }, {});
    expect(orderPageReducer(m, { type: 'hydrate', data: { order: f.orders[0], planData: null } })).toBe(m);
    expect(orderPageReducer(m, { type: 'hydrate', data: { order: f.orders[0], planData: { knitting: [] } } })).toBe(m);
  });

  it('a stale "no plan yet" read arriving after the first save changes neither the page nor the cache', async () => {
    const f = twoRows();
    f.orderDates = [];
    page = await openPage({ fixture: f, dept: 'knitting', role: 'planner' });
    // What another server instance still has cached: the order before its first save.
    const before = page.server.log.length;
    const staleRead = await (await page.server.fetch(`${API_BASE}/api/orders/SYN-S1?dept=knitting`, { headers: { Authorization: `Bearer ${TEST_TOKEN}` } })).json();
    page.server.log.splice(before);
    expect(staleRead.planData).toBeNull();

    await page.set('knitting', 1, 'remarks', 'first save');
    page.server.scriptNext('detail', { status: 200, json: staleRead });
    await page.saveSection('knitting');
    expect(page.toasts).toEqual([`success: ${T.saved('SYN-S1')}`]);
    expect(page.server.log.at(-1)?.url).toBe('/api/orders/SYN-S1?dept=knitting&fresh=1');
    expect(textarea(page, 'knitting', 1, 'remarks')).toBe('first save');
    expect(page.pills('knitting')).not.toContain('Unsaved');
    // The cache keeps the saved plan: the page opens again from it before its own read answers.
    page.server.scriptNext('detail', { hold: true });
    await page.reopen('knitting');
    expect(textarea(page, 'knitting', 1, 'remarks')).toBe('first save');
    page.server.releaseHeld();
    await page.settle();
    expect(textarea(page, 'knitting', 1, 'remarks')).toBe('first save');
    expect(page.errors).toEqual([]);
  });
});

describe('2. a read that makes a section unchangeable drops its draft', () => {
  it('the order left the Dyeing latest file: the Dyeing draft is gone and does not come back', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'mine');
    page.server.db.deptValidOrders = { dyeing: ['OTHER-ORDER'] };
    await page.set('knitting', 1, 'remarks', 'k');
    await page.saveSection('knitting');
    expect(page.pills('dyeing')).toEqual(['2 items', 'View only', 'Not in latest file']);
    expect(textarea(page, 'dyeing', 1, 'remarks')).toBe('');
    // Back in the latest file: editable again, with the saved values (the dropped draft is not resurrected).
    page.server.db.deptValidOrders = {};
    await page.set('knitting', 1, 'remarks', 'k2');
    await page.wait(4000);
    await page.saveSection('knitting');
    expect(page.pills('dyeing')).toEqual(['2 items']);
    expect(textarea(page, 'dyeing', 1, 'remarks')).toBe('');
    expect(page.saveDataButton().disabled).toBe(true);
  });

  it('the order has no Dyeing items any more (noItems flip): the draft is gone, Save Data does not count it', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.set('knitting', 1, 'remarks', 'k');
    expect(page.saveDataButton().textContent).toBe('Save Data (2)');
    const dyeingItems = page.server.db.orders[0].dyeingItems;
    page.server.db.orders[0].dyeingItems = [];
    await page.saveSection('knitting');
    expect(page.section('dyeing').querySelector('[data-note="no-items"]')?.textContent).toBe('This order has no Dyeing items.');
    expect(page.pills('dyeing')).not.toContain('Unsaved');
    expect(page.saveDataButton().disabled).toBe(true);
    // The items are back: the saved values show, the old draft stays dropped.
    page.server.db.orders[0].dyeingItems = dyeingItems;
    await page.set('knitting', 1, 'remarks', 'k2');
    await page.wait(4000);
    await page.saveSection('knitting');
    expect(page.section('dyeing').querySelector('[data-note="no-items"]')).toBeNull();
    expect(textarea(page, 'dyeing', 1, 'remarks')).toBe('');
    expect(stored(page).dyeing[1].remarks).toBe('');
  });
});

describe('3. no Order Status change before the rows are loaded (cold first load)', () => {
  it('strip selects are disabled and the General Information select ignores a change until the read answers', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    // A reload of the page with nothing cached, its read held.
    page.server.scriptNext('detail', { hold: true });
    await page.reload();
    for (const key of ['knitting', 'dyeing', 'deliveryLock']) expect(statusOf(page, key).disabled).toBe(true);
    const general = page.generalStatus();
    // The General select keeps today's look while loading (the golden master records it enabled).
    expect(general.disabled).toBe(false);
    expect(general.getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(general, { target: { value: 'Completed' } });
    await page.settle();
    expect(page.generalStatus().value).toBe('On Process');

    page.server.releaseHeld();
    await page.settle();
    // Loaded: the saved rows and statuses (the change before the load did not hold them back).
    expect(page.generalStatus().value).toBe('Tentative');
    expect(page.generalStatus().hasAttribute('aria-disabled')).toBe(false);
    expect(textarea(page, 'knitting', 1, 'remarks')).toBe('');
    expect(page.section('knitting').querySelectorAll('[data-plan-table] tbody > tr[data-row]')).toHaveLength(2);
    expect(page.pills('knitting')).not.toContain('Unsaved');
    for (const key of ['knitting', 'dyeing', 'deliveryLock']) expect(statusOf(page, key).disabled).toBe(false);
    fireEvent.change(page.generalStatus(), { target: { value: 'Pending' } });
    await page.settle();
    expect(statusOf(page, 'knitting').value).toBe('Pending');
    expect(page.pills('knitting')).toContain('Unsaved');
  });

  it('opened from the cache: the statuses can change at once', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    page.server.scriptNext('detail', { hold: true });
    await page.reopen('knitting');
    expect(statusOf(page, 'dyeing').disabled).toBe(false);
    expect(page.generalStatus().hasAttribute('aria-disabled')).toBe(false);
    page.server.releaseHeld();
    await page.settle();
  });
});

describe('4. strip status labels and the failed-check ring', () => {
  it('each strip Order Status select is named by its section', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'admin' });
    const labels = Array.from(document.querySelectorAll('[data-plan-section] [data-field="orderStatus"]')).map((s) => s.getAttribute('aria-label'));
    expect(labels).toEqual(['Delivery Plan (Lock) Order Status', 'Knitting Plan Order Status', 'Dyeing Plan Order Status']);
    // Each strip Discard is named by its section too; the strip selects show a focus ring for the keyboard.
    const discards = Array.from(document.querySelectorAll('[data-plan-section] [data-action="discard"]')).map((b) => b.getAttribute('aria-label'));
    expect(discards).toEqual([
      'Discard Delivery Plan (Floor) changes',
      'Discard Delivery Plan (Lock) changes',
      'Discard Knitting Plan changes',
      'Discard Dyeing Plan changes',
    ]);
    document.querySelectorAll('[data-plan-section] [data-c2-chrome] [data-field="orderStatus"]').forEach((el) => {
      expect(el.className).toContain('focus-visible:ring-2');
    });
  });

  it('the ring uses the error token and stays until its own section is edited (another section does not clear it)', async () => {
    const f = twoRows();
    f.orderDates[0].knitting[1].endDate = '';
    page = await openPage({ fixture: f, dept: 'knitting', role: 'admin' });
    await page.set('knitting', 0, 'remarks', 'k');
    await page.set('dyeing', 0, 'remarks', 'd');
    await page.saveData();
    expect(page.toasts).toEqual([`error: ${T.typeWithoutDates}`]);
    expect(page.section('knitting').className).toContain('ring-2 ring-error');
    await page.wait(60_000);
    await page.set('dyeing', 0, 'remarks', 'd2');
    expect(page.section('knitting').className).toContain('ring-2 ring-error');
    await page.setStatus('knitting', 'Pending');
    expect(page.section('knitting').className).not.toContain('ring-2');
  });
});

describe('5. a Dyeing save lifts the delivery row lock at once (same order object, before the read answers)', () => {
  it('Save Dyeing with a start date for a row whose saved Dyeing start was blank', async () => {
    const f = twoRows();
    // Blue's saved Dyeing plan has no start date: the Blue delivery row's Lock dates stay locked (today's rule).
    f.orderDates[0].dyeing[1].startDate = '';
    f.orderDates[0].dyeing[1].planType = '';
    page = await openPage({ fixture: f, dept: 'dyeing', role: 'admin' });
    const lockStart = () => page!.field('deliveryLock', 1, 'startDate') as HTMLInputElement;
    expect(lockStart().disabled).toBe(true);
    expect(lockStart().getAttribute('title')).toBe(T.dyeMissing);
    const orderBefore = page.server.db.orders[0];

    await page.set('dyeing', 1, 'startDate', '2026-10-17');
    // The delivery locks read the SAVED Dyeing plan (plan D1): an unsaved start date changes nothing.
    expect(lockStart().disabled).toBe(true);
    page.server.scriptNext('detail', { hold: true });
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).dyeing[1].startDate).toBe('2026-10-17');
    // The read after the save is still held: the page has its saved plan from the save answer, same order object.
    expect(page.server.heldCount).toBe(1);
    expect(page.server.db.orders[0]).toBe(orderBefore);
    expect(lockStart().disabled).toBe(false);
    expect(lockStart().hasAttribute('title')).toBe(false);
    page.server.releaseHeld();
    await page.settle();
    expect(lockStart().disabled).toBe(false);
    expect(page.errors).toEqual([]);
  });
});
