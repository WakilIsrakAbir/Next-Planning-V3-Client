import { fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { openPage, type PageDriver } from '../c2/driver';
import { twoRows } from '../c2/fixtures';
import { API_BASE, TEST_TOKEN } from '../harness/mock-server';
import type { Loose } from '../harness/types';
import { dayDiff, extrasPayload, withSavedExtras, yarnToKnitStart } from '@/features/planning/lib/plan-extras';
import { planDeptOf, sectionsFor } from '@/features/planning/lib/order-page-model';

// US-11 on the order page: the new date columns (stored in planExtras), the read-only day columns, the removed
// columns, the Dyeing Process Name input, and the Delivery Floor / Lock routes.

let page: PageDriver | null = null;
afterEach(() => {
  page?.close();
  page = null;
});

const RED_KNIT = 'syn-s1_red_s/j_160';
const BLUE_KNIT = 'syn-s1_blue_rib_180';
const RED_DYE = 'syn-s1_red_solid';
const BLUE_DYE = 'syn-s1_blue_solid';

const stored = (p: PageDriver) => p.server.db.orderDates.find((d) => d.orderNo === 'SYN-S1') as Loose;
const lastSave = (p: PageDriver) => p.savePlansRequests().at(-1) as Loose;
const unsaved = (p: PageDriver, key: string) => Boolean(p.section(key).querySelector('[data-pill="unsaved"]'));
const day = (p: PageDriver, key: string, row: number, name: string) =>
  (p.section(key).querySelector(`tr[data-row="${row}"] [data-day="${name}"]`) as HTMLElement | null)?.textContent?.trim() ?? null;
const headers = (p: PageDriver, key: string) =>
  Array.from(p.section(key).querySelectorAll('[data-plan-table] thead tr:first-child th')).map((th) => (th.textContent || '').trim());
const sectionKeys = () => Array.from(document.querySelectorAll('[data-plan-section]')).map((s) => s.getAttribute('data-plan-section'));
const routeKeys = () => Array.from(document.querySelectorAll('[data-plan-section][data-route-section]')).map((s) => s.getAttribute('data-plan-section'));
const viewOnly = (p: PageDriver, key: string) => Boolean(p.section(key).querySelector('[data-pill="view-only"]'));

/** Someone else saves Knitting with these extras (save-plans without base, as another V3 page would). */
async function someoneElseSavesKnitExtras(p: PageDriver, extras: Loose) {
  const record = stored(p);
  const before = p.server.log.length;
  const res = await p.server.fetch(`${API_BASE}/api/orders/save-plans`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNo: 'SYN-S1', plans: [{ department: 'knitting', fabricItems: record.knitting, orderStatus: record.knittingStatus, extras }] }),
  });
  p.server.log.splice(before);
  expect(res.status).toBe(200);
}

describe('day columns (whole local days, later − earlier)', () => {
  it('dayDiff: a plain number, negative allowed, blank when a date is missing or not a date', () => {
    expect(dayDiff('2026-10-05', '2026-10-15')).toBe('10');
    expect(dayDiff('2026-10-15', '2026-10-05')).toBe('-10');
    expect(dayDiff('2026-10-05', '2026-10-05')).toBe('0');
    expect(dayDiff('2026-10-25', '2026-11-05')).toBe('11');
    expect(dayDiff('2026-10-05T00:00:00.000Z', '2026-10-06')).toBe('1');
    expect(dayDiff('', '2026-10-05')).toBe('');
    expect(dayDiff('2026-10-05', undefined)).toBe('');
    expect(dayDiff('-', '2026-10-05')).toBe('');
    expect(dayDiff('not a date', '2026-10-05')).toBe('');
  });

  it('Y-KS uses the Actual Yarn Date, or the Yarn Date when it is empty', () => {
    expect(yarnToKnitStart({ yarnDate: '2026-10-01', startDate: '2026-10-05' })).toBe('4');
    expect(yarnToKnitStart({ yarnDate: '2026-10-01', actualYarnDate: '2026-10-07', startDate: '2026-10-05' })).toBe('-2');
    expect(yarnToKnitStart({ yarnDate: '', actualYarnDate: '', startDate: '2026-10-05' })).toBe('');
    expect(yarnToKnitStart({ yarnDate: '2026-10-01', startDate: '' })).toBe('');
  });

  it('the tables show Y-KS, KS-KE, DS-DE, DelS-DelE and LockS-LockE from the rows', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    expect([day(page, 'knitting', 0, 'yks'), day(page, 'knitting', 0, 'kske')]).toEqual(['4', '10']);
    expect([day(page, 'knitting', 1, 'yks'), day(page, 'knitting', 1, 'kske')]).toEqual(['5', '10']);
    expect(day(page, 'dyeing', 0, 'dsde')).toBe('9');
    expect(day(page, 'deliveryFloor', 0, 'delsdele')).toBe('9');
    expect(day(page, 'deliveryLock', 0, 'lockslocke')).toBe('10');
    // Blue has no saved Lock dates: blank.
    expect(day(page, 'deliveryLock', 1, 'lockslocke')).toBe('');
    // The cells follow the draft.
    await page.set('knitting', 0, 'actualYarnDate', '2026-10-07');
    expect(day(page, 'knitting', 0, 'yks')).toBe('-2');
    await page.set('knitting', 0, 'endDate', '2026-10-20');
    expect(day(page, 'knitting', 0, 'kske')).toBe('15');
  });
});

describe('columns', () => {
  it('Knitting, Dyeing, Floor and Lock headers (removed and added columns); Process Name is a select again (US-12)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    expect(headers(page, 'knitting').slice(3, 8)).toEqual(['Yarn Date', 'Actual Yarn Date', 'Knitting Planning', 'Y-KS', 'KS-KE']);
    const dye = headers(page, 'dyeing');
    expect(dye).not.toContain('Knitting Limitation');
    expect(dye).not.toContain('Remarks (Knitting)');
    expect(dye.slice(5, 9)).toEqual(['LD Plan Date', 'Actual LD Date', 'Dyeing Planning', 'DS-DE']);
    const floor = headers(page, 'deliveryFloor');
    expect(floor).not.toContain('Knitting Planning');
    expect(floor.slice(3, 8)).toEqual(['Delivery Planning (Floor)', 'DelS-DelE', 'Plan Type (Floor)', 'Dyeing Planning', 'Dyeing Plan Type']);
    const lock = headers(page, 'deliveryLock');
    for (const gone of ['Dyeing Planning', 'Dyeing Plan Type', 'Knitting Planning']) expect(lock).not.toContain(gone);
    expect(lock.slice(3, 5)).toEqual(['Delivery Planning', 'LockS-LockE']);

    // US-12 reverts the US-11 <input list>: Process Name is a <select> (tests/us12 covers its options).
    const process = page.field('dyeing', 0, 'processName') as HTMLSelectElement;
    expect(process.tagName).toBe('SELECT');
    expect(document.querySelector('datalist')).toBeNull();
  });
});

describe('extra dates (planExtras)', () => {
  it('are item-wise (Row 1 does not copy them), dirty, sent as `extras` (never in fabricItems) and read back', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'planner' });
    expect(unsaved(page, 'knitting')).toBe(false);
    await page.set('knitting', 0, 'actualYarnDate', '2026-10-03');
    expect(page.field('knitting', 1, 'actualYarnDate').value).toBe('');
    expect(unsaved(page, 'knitting')).toBe(true);

    await page.saveSection('knitting');
    const plan = lastSave(page).body.plans[0];
    expect(plan.department).toBe('knitting');
    expect(plan.extras).toEqual({ [RED_KNIT]: { actualYarnDate: '2026-10-03' }, [BLUE_KNIT]: { actualYarnDate: '' } });
    plan.fabricItems.forEach((it: Loose) => expect(it).not.toHaveProperty('actualYarnDate'));
    expect(stored(page).planExtras.knitting[RED_KNIT]).toEqual({ actualYarnDate: '2026-10-03' });
    expect(stored(page).knitting[0]).not.toHaveProperty('actualYarnDate');
    expect(unsaved(page, 'knitting')).toBe(false);
    expect(page.field('knitting', 0, 'actualYarnDate').value).toBe('2026-10-03');

    // A browser reload (no caches) reads them from planData.planExtras.
    await page.reload('knitting');
    expect(page.field('knitting', 0, 'actualYarnDate').value).toBe('2026-10-03');
    expect(page.field('knitting', 1, 'actualYarnDate').value).toBe('');
    expect(unsaved(page, 'knitting')).toBe(false);
  });

  it('Dyeing LD dates: Discard puts them back; Save Data sends the Dyeing extras', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'dyeing', role: 'planner' });
    await page.set('dyeing', 1, 'ldPlanDate', '2026-10-10');
    expect(unsaved(page, 'dyeing')).toBe(true);
    page.answer(true);
    await page.discard('dyeing');
    expect(page.field('dyeing', 1, 'ldPlanDate').value).toBe('');
    expect(unsaved(page, 'dyeing')).toBe(false);

    await page.set('dyeing', 1, 'actualLdDate', '2026-10-12');
    await page.saveData();
    expect(lastSave(page).body.plans.map((p: Loose) => [p.department, p.extras])).toEqual([
      ['dyeing', { [RED_DYE]: { ldPlanDate: '', actualLdDate: '' }, [BLUE_DYE]: { ldPlanDate: '', actualLdDate: '2026-10-12' } }],
    ]);
    expect(stored(page).planExtras.dyeing[BLUE_DYE]).toEqual({ ldPlanDate: '', actualLdDate: '2026-10-12' });
  });

  it("conflicts: someone else's extras refuse a save made on the old ones; Load latest shows them", async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'planner' });
    await page.set('knitting', 0, 'actualYarnDate', '2026-10-03');
    await someoneElseSavesKnitExtras(page, { [RED_KNIT]: { actualYarnDate: '2026-10-02' } });

    await page.saveSection('knitting');
    expect(page.toasts.at(-1)).toBe('error: Knitting was changed by someone else after this order was opened.');
    expect(page.section('knitting').querySelector('[data-conflict]')).not.toBeNull();
    expect(stored(page).planExtras.knitting[RED_KNIT]).toEqual({ actualYarnDate: '2026-10-02' });

    page.answer(true);
    await page.click(page.section('knitting').querySelector('[data-action="load-latest"]'));
    expect(page.field('knitting', 0, 'actualYarnDate').value).toBe('2026-10-02');
    expect(page.section('knitting').querySelector('[data-conflict]')).toBeNull();
    expect(unsaved(page, 'knitting')).toBe(false);
  });

  it('a read merges the saved extras into clean sections only (an unsaved extra date is kept)', () => {
    const rows = [{ itemId: 'a', yarnDate: '2026-10-01' }, { itemId: 'b' }];
    const merged = withSavedExtras(rows, { planExtras: { knitting: { a: { actualYarnDate: '2026-10-04' } } } }, 'knitting');
    expect(merged[0]).toEqual({ itemId: 'a', yarnDate: '2026-10-01', actualYarnDate: '2026-10-04' });
    expect(merged[1]).toBe(rows[1]);
    expect(withSavedExtras(rows, { planExtras: { knitting: {} } }, 'delivery')).toBe(rows);
    expect(extrasPayload('delivery', rows)).toBeUndefined();
    expect(extrasPayload('dyeing', [{ itemId: 'x', ldPlanDate: '2026-10-01' }])).toEqual({ x: { ldPlanDate: '2026-10-01', actualLdDate: '' } });
  });
});

describe('Delivery Floor and Lock routes', () => {
  it('route sections and section order (D2)', () => {
    expect(planDeptOf('deliveryfloor')).toBe('delivery');
    expect(planDeptOf('deliverylock')).toBe('delivery');
    expect(planDeptOf('dyeing')).toBe('dyeing');
    const view = (route: string) => sectionsFor(route).map((s) => `${s.key}${s.isRoute ? '*' : ''}`);
    expect(view('deliveryfloor')).toEqual(['deliveryFloor*', 'yd', 'knitting', 'dyeing', 'deliveryLock']);
    expect(view('deliverylock')).toEqual(['deliveryLock*', 'yd', 'knitting', 'dyeing', 'deliveryFloor']);
    expect(view('delivery')).toEqual(['deliveryFloor*', 'deliveryLock*', 'yd', 'knitting', 'dyeing']);
    expect(sectionsFor('deliveryfloor').every((s) => !s.footerSavesDept)).toBe(true);
    expect(sectionsFor('delivery').filter((s) => s.footerSavesDept).map((s) => s.key)).toEqual(['deliveryFloor', 'deliveryLock']);
  });

  it('Floor route: Floor is the route section, Lock is Admin-edit; a planner saves Floor (department delivery)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'deliveryfloor', role: 'planner' });
    expect(sectionKeys()).toEqual(['deliveryFloor', 'yd', 'knitting', 'dyeing', 'deliveryLock']);
    expect(routeKeys()).toEqual(['deliveryFloor']);
    expect(document.querySelector('h3')?.textContent).toContain('Delivery Plan (Floor)');
    expect(viewOnly(page, 'deliveryFloor')).toBe(false);
    expect(viewOnly(page, 'deliveryLock')).toBe(true);
    // The delivery Order Status belongs to Lock: General Information does not change it for a planner here.
    fireEvent.change(page.generalStatus(), { target: { value: 'Pending' } });
    await page.settle();
    expect(page.generalStatus().value).toBe('Tentative');

    await page.set('deliveryFloor', 0, 'floorEndDate', '2026-11-03');
    await page.saveSection('deliveryFloor');
    const body = lastSave(page).body;
    expect(body.plans.map((p: Loose) => [p.department, p.orderStatus, p.extras])).toEqual([['delivery', 'Tentative', undefined]]);
    expect(stored(page).delivery[0].floorEndDate).toBe('2026-11-03');
    // The footer Save of a split route saves its own section only.
    expect(page.section('deliveryFloor').querySelector('[data-action="save"]')?.getAttribute('title')).toBeNull();
  });

  it('Lock route: the reverse; an Admin may edit the added section', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'deliverylock', role: 'planner' });
    expect(sectionKeys()).toEqual(['deliveryLock', 'yd', 'knitting', 'dyeing', 'deliveryFloor']);
    expect(routeKeys()).toEqual(['deliveryLock']);
    expect(viewOnly(page, 'deliveryLock')).toBe(false);
    expect(viewOnly(page, 'deliveryFloor')).toBe(true);
    page.close();
    page = await openPage({ fixture: twoRows(), dept: 'deliveryfloor', role: 'admin' });
    expect(viewOnly(page, 'deliveryLock')).toBe(false);
  });

  it('/planning/delivery keeps both route sections and the footer that saves Floor and Lock together', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    expect(sectionKeys()).toEqual(['deliveryFloor', 'deliveryLock', 'yd', 'knitting', 'dyeing']);
    expect(routeKeys()).toEqual(['deliveryFloor', 'deliveryLock']);
    expect(page.section('deliveryFloor').querySelector('[data-action="save"]')?.getAttribute('title')).toBe('Saves Delivery Floor and Lock together');
  });

  it('Item 01: the YD order page shows the Knitting, Dyeing, Floor and Lock sections', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'yd', role: 'admin' });
    expect(sectionKeys()).toEqual(['yd', 'knitting', 'dyeing', 'deliveryFloor', 'deliveryLock']);
    for (const key of ['knitting', 'dyeing', 'deliveryFloor', 'deliveryLock']) {
      expect(page.section(key).querySelectorAll('[data-plan-table] tbody > tr[data-row]').length).toBe(2);
    }
  });
});
