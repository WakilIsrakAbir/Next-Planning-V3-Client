import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, waitFor } from '@testing-library/react';
import { openGuidePage, GuidePageServer, type GuidePage } from './guide-page';
import { savedOrder } from '../c2/fixtures';
import { tableValues, withoutTimes } from '../c2/driver';
import { fingerprintAllDepts } from '../harness/mock-server';
import { ROLE_STORAGE } from '../harness/runner';
import { resetHarnessState } from '../harness/state';
import { T } from '../golden/scenarios/texts';
import type { Loose } from '../harness/types';
import { STANDARD } from '../plan-check-list/mock-server';
import type { StoredGuide } from '../plan-guide/guide-server';

// The Checkpoint & Planning Guide card on the universal order page (SPEC C34-int): placement and Hide/Unhide, the
// guide from the full detail answer only, Save Data with the guide (count, plans first, guide only, partial failure),
// the detail cache, keep-newest by guide.version, and no card render while typing in a plan section.

const ORDER = 'SYN-S1';
/** SYN-S1's T&A (the user's example: Knitting 2 to 21 October 2026) as the guide shows it before a save. */
const LIVE = {
  ydStart: '2026-10-01',
  ydEnd: '',
  knitStart: '2026-10-02',
  knitEnd: '2026-10-21',
  dyeStart: '2026-10-12',
  dyeEnd: '2026-10-30',
  floorStart: '2026-10-25',
  floorEnd: '2026-11-10',
  lockStart: '',
  lockEnd: '',
};
const HEATSET_DATES = { ...LIVE, knitStart: '2026-10-12', knitEnd: '2026-10-28' };
const SECTIONS: Record<string, string[]> = {
  yd: ['yd', 'knitting', 'dyeing', 'deliveryFloor', 'deliveryLock'],
  knitting: ['knitting', 'dyeing', 'deliveryFloor', 'deliveryLock'],
  dyeing: ['dyeing', 'knitting', 'deliveryFloor', 'deliveryLock'],
  finishing: ['finishing', 'knitting', 'dyeing', 'deliveryFloor', 'deliveryLock'],
  delivery: ['deliveryFloor', 'deliveryLock', 'knitting', 'dyeing'],
};
const GUIDE_SAVED = `success: Planning Guide saved for Order #${ORDER}.`;
const PUT = `PUT /api/orders/${ORDER}/plan-guide`;
const SAVE_PLANS = 'POST /api/orders/save-plans';

let page: GuidePage | null = null;
afterEach(() => {
  page?.close();
  page = null;
});

const parts = () =>
  Array.from(document.querySelectorAll('[data-general-info], [data-planning-guide], [data-plan-section]')).map((el) =>
    el.hasAttribute('data-general-info') ? 'general' : el.hasAttribute('data-planning-guide') ? 'guide' : el.getAttribute('data-plan-section')
  );
const cachedGuide = (p: GuidePage, dept: string) =>
  (p.modules.cache.cachedOrderDetails.get(`${dept}_${p.orderNo}`) as { guide?: { version: number; yesIds: string[] } } | undefined)?.guide;
const DEPTS = ['yd', 'knitting', 'dyeing', 'finishing', 'delivery'];
const storedPlan = (p: GuidePage) => withoutTimes({ orderDates: p.server.plans.db.orderDates, orders: p.server.plans.db.orders });
const allTables = (p: GuidePage) => SECTIONS.knitting.map((key) => tableValues(p.section(key)));
const lastPut = (p: GuidePage) => p.server.guides.requests('PUT').at(-1);

/** A detail answer as the server gives it, with `guide` and `planData` chosen by the test. */
function detailReply(server: GuidePageServer, planData: Loose, guide: StoredGuide | null): { status: number; json: Loose } {
  const flags = Object.fromEntries(DEPTS.map((d) => [d, { inLatestFile: true, hasItems: true }]));
  return {
    status: 200,
    json: { order: JSON.parse(JSON.stringify(server.order(ORDER))), planData, fingerprints: fingerprintAllDepts(planData), deptFlags: flags, guide },
  };
}

describe('placement, strip and Hide/Unhide', () => {
  it('sits between General Information and the plan sections on every department page', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    const order = ['knitting', 'yd', 'dyeing', 'finishing', 'delivery', 'knitting'];
    for (let i = 0; i < order.length; i++) {
      if (i > 0) await page.reopen(order[i]);
      expect(parts(), order[i]).toEqual(['general', 'guide', ...SECTIONS[order[i]]]);
    }
    // Its strip: the title, "0 Yes", nothing saved yet, Save Guide and Hide.
    const strip = page.card().querySelector('[data-c2-chrome]') as HTMLElement;
    expect(strip.textContent).toContain('Checkpoint & Planning Guide');
    expect(page.cardPills()).toEqual(['0 Yes']);
    expect(strip.textContent).toContain('Not saved yet');
    expect((strip.querySelector('[data-action="save-guide"]') as HTMLButtonElement).disabled).toBe(false);
    expect(strip.querySelector('[data-action="toggle-guide"]')?.textContent).toBe('Hide');
    expect(page.cardInput('Knit Start').value).toBe(LIVE.knitStart);
    expect(page.errors).toEqual([]);
  });

  it('Hide/Unhide like the other parts: remembered per page in the same store, the card body gone while hidden', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    const toggle = () => page!.card().querySelector('[data-action="toggle-guide"]') as HTMLButtonElement;
    expect(toggle().getAttribute('aria-label')).toBe('Hide Checkpoint & Planning Guide');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    const bodyId = toggle().getAttribute('aria-controls') as string;
    expect(document.getElementById(bodyId)?.querySelector('[data-guide-table]')).not.toBeNull();

    await page.click(toggle());
    expect(page.card().querySelector('[data-guide-table]')).toBeNull();
    expect([toggle().textContent, toggle().getAttribute('aria-label'), toggle().getAttribute('aria-expanded')]).toEqual([
      'Unhide',
      'Unhide Checkpoint & Planning Guide',
      'false',
    ]);
    expect(localStorage.getItem('orderPage.hiddenSections')).toBe('knitting:guide');
    expect(localStorage.getItem('planningGuideCard.hidden')).toBeNull();
    // The strip stays: the guide can still be saved while hidden.
    expect(page.card().querySelector('[data-action="save-guide"]')).not.toBeNull();

    // Another page of the order keeps its own choice; this page remembers it.
    await page.reopen('dyeing');
    expect(page.card().querySelector('[data-guide-table]')).not.toBeNull();
    await page.reopen('knitting');
    expect(page.card().querySelector('[data-guide-table]')).toBeNull();
    // The title (chevron) toggles too.
    await page.click(page.card().querySelector('button[title="Show the Planning Guide"]'));
    expect(page.card().querySelector('[data-guide-table]')).not.toBeNull();
    expect(localStorage.getItem('orderPage.hiddenSections')).toBe('');
  });

  it('a remembered Hide: the server-rendered page hydrates without a mismatch, then hides the card', async () => {
    localStorage.clear();
    const server = new GuidePageServer(savedOrder(), { user: { username: 'admin', role: 'Admin' } });
    const harness = resetHarnessState({ dept: 'knitting', orderNo: ORDER }, `/planning/knitting/${ORDER}`);
    harness.fetchHandler = server.fetch;
    Object.entries(ROLE_STORAGE.admin).forEach(([k, v]) => localStorage.setItem(k, v));
    vi.resetModules();
    const { default: OrderPlanningScreen } = await import('@/features/planning/components/OrderPlanningScreen');
    const { renderToString } = await import('react-dom/server');
    const { hydrateRoot } = await import('react-dom/client');
    const html = renderToString(<OrderPlanningScreen />);
    expect(html).toContain('data-planning-guide');
    localStorage.setItem('orderPage.hiddenSections', 'knitting:guide');
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    const errors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(host, <OrderPlanningScreen />, { onRecoverableError: (error) => errors.push(error) });
      });
      await waitFor(() => expect(host.querySelector('[data-route-section] [data-plan-table] [data-row="0"]')).not.toBeNull());
      expect(host.querySelector('[data-planning-guide] [data-action="toggle-guide"]')?.textContent).toBe('Unhide');
      expect(host.querySelector('[data-guide-table]')).toBeNull();
      expect(errors).toEqual([]);
    } finally {
      act(() => root?.unmount());
      host.remove();
      harness.fetchHandler = null;
    }
  });
});

describe('the guide comes only from the full detail answer', () => {
  it('waits for the details (no T&A from a header), then shows the stored guide of the detail answer', async () => {
    page = await openGuidePage({
      fixture: savedOrder(),
      dept: 'knitting',
      before: (s) => {
        s.plans.scriptNext('detail', { hold: true });
        s.guides.saveDirectly(ORDER, { yesIds: ['heatset'], dates: HEATSET_DATES }, 'planner9');
      },
    });
    expect(page.card().textContent).toContain("Loading the order's T&A dates…");
    expect(page.card().querySelector('input[type="date"]')).toBeNull();
    expect((page.card().querySelector('[data-action="save-guide"]') as HTMLButtonElement).disabled).toBe(true);

    page.server.plans.releaseHeld();
    await page.settle();
    expect(page.cardSelect('Heatset').value).toBe('Yes');
    expect(page.cardInput('Knit Start').value).toBe('2026-10-12');
    expect(page.cardInput('Knit End').value).toBe('2026-10-28');
    expect(page.card().querySelector('[data-guide-lead]')?.textContent).toBe('+10d / +7d Checklist Lead Time');
    expect(page.card().querySelector('[data-testid="guide-saved-by"]')?.textContent).toMatch(/^Saved by planner9, /);
    expect(page.cardPills()).toEqual(['1 Yes']);
    expect(page.saveDataButton().textContent).toBe('Save Data');
  });
});

describe('Save Data with the Planning Guide (SPEC C2 10a)', () => {
  it("guide only: counts in Save Data, sends no save-plans request, saves the guide and changes nothing else (T13)", async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    expect(page.saveDataButton().disabled).toBe(true);
    const planBefore = storedPlan(page);
    const tablesBefore = allTables(page);

    await page.setYes('Heatset', true);
    // The user's example: Heatset (10/7) on T&A Knitting 2-21 Oct 2026.
    expect([page.cardInput('Knit Start').value, page.cardInput('Knit End').value]).toEqual(['2026-10-12', '2026-10-28']);
    expect(page.card().querySelector('[data-guide-lead]')?.textContent).toBe('+10d / +7d Checklist Lead Time');
    expect(page.cardPills()).toEqual(['1 Yes', 'Unsaved']);
    expect(page.saveDataButton().textContent).toBe('Save Data (1)');
    expect(page.saveDataButton().disabled).toBe(false);
    expect(page.modules.guard.getUnsavedLabels()).toEqual(['Planning Guide']);

    const from = page.server.log.length;
    await page.saveData();
    // The guide's save check (the order's T&A and the Plan Check List read again), then the PUT; no plan request.
    expect(page.server.log.slice(from)).toEqual([`GET /api/orders/${ORDER}?fresh=1`, 'GET /api/plan-check-list', PUT]);
    expect(lastPut(page)?.body).toEqual({ yesIds: ['heatset'], dates: HEATSET_DATES });
    expect(page.toasts).toEqual([GUIDE_SAVED]);
    expect(page.saveDataButton().textContent).toBe('Save Data');
    expect(page.saveDataButton().disabled).toBe(true);
    expect(page.cardPills()).toEqual(['1 Yes']);
    expect(page.modules.guard.getUnsavedLabels()).toEqual([]);
    expect(page.server.guides.guides.get(ORDER)).toMatchObject({
      version: 1,
      yesIds: ['heatset'],
      dates: HEATSET_DATES,
      lead: { startDays: 10, endDays: 7, startFrom: ['Heatset'], endFrom: ['Heatset'], startFromIds: ['heatset'], endFromIds: ['heatset'] },
      tna: { knitStart: '2026-10-02', knitEnd: '2026-10-21' },
    });

    // T13: no plan row, Order field, status or T&A changed; the sections show what they showed.
    expect(storedPlan(page)).toEqual(planBefore);
    expect(allTables(page)).toEqual(tablesBefore);
    expect(page.server.order(ORDER).knitStart).toBe('2026-10-02');
    expect(page.server.plans.log.filter((r) => r.method !== 'GET')).toEqual([]);
    expect(page.errors).toEqual([]);
  });

  it('anyone who can open the page edits and saves the guide (D12): a Planner, other sections View only', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting', role: 'planner' });
    expect(page.pills('dyeing')).toContain('View only');
    await page.setYes('CPB', true);
    expect(page.saveDataButton().textContent).toBe('Save Data (1)');
    await page.saveData();
    expect(page.toasts).toEqual([GUIDE_SAVED]);
    expect(page.server.guides.guides.get(ORDER)).toMatchObject({ yesIds: ['cpb'], updatedBy: 'planner1', lead: { startDays: 12, endDays: 9 } });
  });

  it('plans first, then the guide: one save-plans request with the dirty plans only, then the PUT', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await page.set('knitting', 0, 'remarks', 'k');
    await page.setYes('Heatset', true);
    expect(page.saveDataButton().textContent).toBe('Save Data (2)');

    const from = page.server.log.length;
    await page.saveData();
    expect(page.server.log.slice(from)).toEqual([
      SAVE_PLANS,
      `GET /api/orders/${ORDER}?fresh=1`,
      'GET /api/plan-check-list',
      PUT,
      `GET /api/orders/${ORDER}?dept=knitting&fresh=1`,
    ]);
    const posts = page.server.plans.log.filter((r) => r.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].body.plans.map((p: Loose) => p.department)).toEqual(['knitting']);
    expect(page.toasts).toEqual([`success: ${T.saved(ORDER)}`]);
    expect(page.pills('knitting')).not.toContain('Unsaved');
    expect(page.cardPills()).toEqual(['1 Yes']);
    expect(page.saveDataButton().textContent).toBe('Save Data');
    expect(page.server.guides.guides.get(ORDER)).toMatchObject({ version: 1, dates: HEATSET_DATES });
    expect((page.field('knitting', 0, 'remarks') as HTMLTextAreaElement).value).toBe('k');
  });

  it('the guide fails after the plans saved: "Plans saved. Planning Guide not saved: <reason>", the guide stays unsaved', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await page.set('knitting', 0, 'remarks', 'k');
    await page.setYes('Heatset', true);
    page.server.guides.scriptNext({ method: 'PUT', status: 500, json: { message: 'Server error while saving the Planning Guide.' } });
    await page.saveData();

    expect(page.toasts.at(-1)).toBe('error: Plans saved. Planning Guide not saved: Server error while saving the Planning Guide.');
    expect(page.server.plans.log.filter((r) => r.method === 'POST')).toHaveLength(1);
    expect(page.pills('knitting')).not.toContain('Unsaved');
    expect(page.cardPills()).toEqual(['1 Yes', 'Unsaved']);
    expect(page.saveDataButton().textContent).toBe('Save Data (1)');
    expect(page.modules.guard.getUnsavedLabels()).toEqual(['Planning Guide']);
    expect(page.server.guides.guides.has(ORDER)).toBe(false);
    // The card shows the reason too.
    expect(page.card().querySelector('[role="alert"]')?.textContent).toContain('Server error while saving the Planning Guide.');

    // Save Data again: only the guide is left, so only the guide is sent.
    await page.wait(4000);
    const from = page.server.log.length;
    await page.saveData();
    expect(page.server.log.slice(from).filter((line) => line === SAVE_PLANS)).toEqual([]);
    expect(page.server.log.slice(from)).toContain(PUT);
    expect(page.toasts.at(-1)).toBe(GUIDE_SAVED);
    expect(page.cardPills()).toEqual(['1 Yes']);
    expect(page.saveDataButton().textContent).toBe('Save Data');
  });

  it('a guide-only Save Data that fails: "Planning Guide not saved: <reason>" (no "Plans saved.")', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await page.setYes('Heatset', true);
    page.server.guides.scriptNext({ method: 'PUT', status: 400, json: { code: 'INVALID', message: 'dates.knitStart: must be empty or a date (YYYY-MM-DD).' } });
    await page.saveData();
    expect(page.toasts.at(-1)).toBe('error: Planning Guide not saved: dates.knitStart: must be empty or a date (YYYY-MM-DD).');
    expect(page.cardPills()).toContain('Unsaved');
  });

  it('a failed plan check saves nothing, the guide included', async () => {
    const f = savedOrder();
    f.orderDates[0].knitting[0].endDate = ''; // Knitting saved Tentative without an end date (SAVE-05)
    page = await openGuidePage({ fixture: f, dept: 'knitting' });
    await page.set('knitting', 0, 'remarks', 'k');
    await page.setYes('Heatset', true);
    const from = page.server.log.length;
    await page.saveData();
    expect(page.toasts).toEqual([`error: ${T.typeWithoutDates}`]);
    expect(page.server.log.slice(from)).toEqual([]);
    expect(page.cardPills()).toContain('Unsaved');
    expect(page.saveDataButton().textContent).toBe('Save Data (2)');
  });

  it('while a plan save runs, Save Guide and Discard wait; a section Save never sends the guide', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await page.set('knitting', 0, 'remarks', 'k');
    await page.setYes('Heatset', true);
    page.server.plans.scriptNext('saveDates', { hold: true });
    await page.saveSection('knitting');
    const saveGuide = () => page!.card().querySelector('[data-action="save-guide"]') as HTMLButtonElement;
    const discard = () => page!.card().querySelector('[data-action="discard-guide"]') as HTMLButtonElement;
    expect(saveGuide().disabled).toBe(true);
    expect(discard().disabled).toBe(true);
    page.server.plans.releaseHeld();
    await page.settle();
    expect(saveGuide().disabled).toBe(false);
    expect(discard().disabled).toBe(false);
    expect(page.server.guides.requests('PUT')).toEqual([]);
    expect(page.cardPills()).toContain('Unsaved');
    expect(page.saveDataButton().textContent).toBe('Save Data (1)');
  });

  it('guide edits made while its Save Data PUT runs stay unsaved, and count again', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await page.setYes('Heatset', true);
    const release = page.server.guides.holdNext('PUT');
    fireEvent.click(page.saveDataButton());
    await page.settle();
    expect(page.server.guides.requests('PUT')).toHaveLength(1);
    await page.setCardDate('Lock Start', '2026-11-20');
    release();
    await page.settle();
    expect(page.server.guides.guides.get(ORDER)).toMatchObject({ version: 1, dates: { lockStart: '' } });
    expect(page.cardInput('Lock Start').value).toBe('2026-11-20');
    expect(page.cardPills()).toEqual(['1 Yes', 'Unsaved']);
    expect(page.saveDataButton().textContent).toBe('Save Data (1)');
    await page.wait(4000);
    await page.saveData();
    expect(lastPut(page)?.body).toMatchObject({ version: 1, dates: { lockStart: '2026-11-20' } });
    expect(page.saveDataButton().textContent).toBe('Save Data');
  });
});

describe('the detail cache and keep-newest', () => {
  it('the PUT answer goes into all five detail cache keys: another department page paints the saved guide at once', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    expect(DEPTS.map((d) => Boolean(page!.modules.cache.cachedOrderDetails.get(`${d}_${ORDER}`)))).toEqual([false, true, false, false, false]);
    await page.setYes('Heatset', true);
    await page.saveGuide();
    expect(page.toasts).toEqual([GUIDE_SAVED]);
    expect(DEPTS.map((d) => cachedGuide(page!, d))).toEqual(DEPTS.map(() => expect.objectContaining({ version: 1, yesIds: ['heatset'] })));
    // The copies hold the same detail answer (order and plan) as the page's own key.
    const own = page.modules.cache.getPrecachedOrderDetail('knitting', ORDER);
    expect(page.modules.cache.getPrecachedOrderDetail('dyeing', ORDER)).toMatchObject({ order: own?.order, planData: own?.planData });

    for (const dept of ['dyeing', 'delivery']) {
      page.server.plans.scriptNext('detail', { hold: true });
      await page.reopen(dept);
      // Before its request answers: the saved guide, from the cache.
      expect(page.cardSelect('Heatset').value, dept).toBe('Yes');
      expect(page.cardInput('Knit Start').value).toBe('2026-10-12');
      expect(page.cardPills()).toEqual(['1 Yes']);
      // Detail reads after a guide save skip the server's 60 s cache, as after a plan save.
      expect(page.server.log.at(-1)).toBe(`GET /api/orders/${ORDER}?dept=${dept}&fresh=1`);
      page.server.plans.releaseHeld();
      await page.settle();
    }
  });

  it('a plan save keeps the guide in every cache key', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await page.setYes('Heatset', true);
    await page.saveGuide();
    await page.wait(4000);
    await page.set('knitting', 0, 'remarks', 'k');
    await page.saveSection('knitting');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved(ORDER)}`);
    expect(DEPTS.map((d) => cachedGuide(page!, d)?.version)).toEqual([1, 1, 1, 1, 1]);
  });

  it('keep-newest by guide.version: an older guide never replaces a newer one, a newer one does, apart from the plan guard', async () => {
    let v1: StoredGuide | null = null;
    page = await openGuidePage({
      fixture: savedOrder(),
      dept: 'knitting',
      before: (s) => {
        v1 = s.guides.saveDirectly(ORDER, { yesIds: ['heatset'], dates: HEATSET_DATES }, 'planner9');
        s.guides.saveDirectly(ORDER, { yesIds: ['cpb'], dates: { ...LIVE, knitStart: '2026-10-14', knitEnd: '2026-10-30' } }, 'planner9');
      },
    });
    const shown = () => [page!.cardSelect('Heatset').value, page!.cardSelect('CPB').value, page!.cardInput('Knit Start').value];
    expect(shown()).toEqual(['No', 'Yes', '2026-10-14']);

    // A read (same plan) with an older guide (another server instance's cache): the newer guide stays, on screen
    // and in the cache.
    const plan = () => JSON.parse(JSON.stringify(page!.server.plans.db.orderDates[0]));
    page.server.plans.scriptNext('detail', detailReply(page.server, plan(), v1));
    await page.reopen('knitting');
    expect(shown()).toEqual(['No', 'Yes', '2026-10-14']);
    expect(cachedGuide(page, 'knitting')?.version).toBe(2);

    // Someone saves the guide again: the next read brings the newer guide.
    page.server.guides.saveDirectly(ORDER, { yesIds: ['singeing'], dates: { ...LIVE, knitStart: '2026-10-09', knitEnd: '2026-10-28' } }, 'planner9');
    await page.reopen('knitting');
    expect(page.cardSelect('Singeing').value).toBe('Yes');
    expect(page.cardInput('Knit Start').value).toBe('2026-10-09');
    expect(cachedGuide(page, 'knitting')?.version).toBe(3);

    // A read whose plan is OLDER than the screen's but whose guide is newer: the plan part is ignored, the guide
    // is taken (each part has its own guard).
    const oldPlan = plan();
    const v4 = page.server.guides.saveDirectly(ORDER, { yesIds: ['mercerized'], dates: { ...LIVE, knitStart: '2026-10-13', knitEnd: '2026-10-30' } }, 'planner9');
    await page.set('knitting', 0, 'remarks', 'kept');
    page.server.plans.scriptNext('detail', detailReply(page.server, oldPlan, v4));
    await page.saveSection('knitting');
    expect((page.field('knitting', 0, 'remarks') as HTMLTextAreaElement).value).toBe('kept');
    expect(page.cardSelect('Mercerized').value).toBe('Yes');
    expect(page.cardInput('Knit Start').value).toBe('2026-10-13');
    expect(DEPTS.map((d) => cachedGuide(page!, d)?.version)).toEqual([4, 4, 4, 4, 4]);
  });

  it('a newer guide from a read does not replace unsaved guide edits', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await page.setCardDate('Lock Start', '2026-11-20');
    page.server.guides.saveDirectly(ORDER, { yesIds: ['cpb'], dates: { ...LIVE, knitStart: '2026-10-14', knitEnd: '2026-10-30' } }, 'planner9');
    // A plan save reads the order again: the read carries the other user's guide.
    await page.set('knitting', 0, 'remarks', 'k');
    await page.saveSection('knitting');
    expect(page.cardInput('Lock Start').value).toBe('2026-11-20');
    expect(page.cardSelect('CPB').value).toBe('No');
    expect(page.cardPills()).toContain('Unsaved');
    // Saving it is refused (409) instead of overwriting the other save; Reload is offered.
    await page.wait(4000);
    await page.saveData();
    expect(page.toasts.at(-1)).toMatch(/^error: Planning Guide not saved: The Planning Guide of this order was changed by planner9/);
    expect(page.card().querySelector('[role="alert"]')?.textContent).toContain('Reload');
  });
});

describe('typing in a plan section does not draw the card (SPEC C2 10c)', () => {
  it('no card render while typing in Knitting or Delivery Lock; a guide edit draws it', async () => {
    const counter = { renders: 0 };
    (globalThis as Loose).__C34_GUIDE_RENDERS__ = counter;
    vi.doMock('@/features/planning/lib/use-planning-guide', async () => {
      const real = await vi.importActual<typeof import('@/features/planning/lib/use-planning-guide')>('@/features/planning/lib/use-planning-guide');
      return {
        ...real,
        usePlanningGuide: (options: Parameters<typeof real.usePlanningGuide>[0]) => {
          (globalThis as Loose).__C34_GUIDE_RENDERS__.renders += 1;
          return real.usePlanningGuide(options);
        },
      };
    });
    try {
      page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
      expect(counter.renders).toBeGreaterThan(0);
      counter.renders = 0;
      for (const value of ['a', 'ab', 'abc']) await page.set('knitting', 0, 'remarks', value);
      for (const value of ['x', 'xy']) await page.set('deliveryLock', 0, 'remarks', value);
      await page.set('dyeing', 0, 'remarks', 'd');
      expect(page.saveDataButton().textContent).toBe('Save Data (3)');
      expect(counter.renders).toBe(0);
      await page.setYes('Heatset', true);
      expect(counter.renders).toBeGreaterThan(0);
      expect(page.saveDataButton().textContent).toBe('Save Data (4)');
    } finally {
      vi.doUnmock('@/features/planning/lib/use-planning-guide');
    }
  });
});

describe('carry-over checks on the page', () => {
  it('"T&A / Check List changed since saved" with Apply after a General upload moved the T&A', async () => {
    page = await openGuidePage({
      fixture: savedOrder(),
      dept: 'knitting',
      before: (s) => {
        s.guides.saveDirectly(ORDER, { yesIds: ['heatset'], dates: HEATSET_DATES }, 'planner9');
        s.order(ORDER).knitStart = '2026-10-05';
      },
    });
    // The stored dates stay; the Knit row says what the T&A and the lead give now.
    expect(page.cardInput('Knit Start').value).toBe('2026-10-12');
    expect(page.card().querySelector('[data-guide-hint="knit"]')?.textContent).toContain(
      'T&A / Check List changed since saved: now 15-Oct-2026 to 28-Oct-2026'
    );
    expect(page.card().querySelectorAll('[data-guide-hint]')).toHaveLength(1);
    expect(page.saveDataButton().textContent).toBe('Save Data');
    await page.click(page.card().querySelector('button[aria-label="Apply the new Knit dates"]'));
    expect(page.cardInput('Knit Start').value).toBe('2026-10-15');
    expect(page.saveDataButton().textContent).toBe('Save Data (1)');
    await page.saveData();
    expect(page.toasts.at(-1)).toBe(GUIDE_SAVED);
    expect(page.server.guides.guides.get(ORDER)).toMatchObject({ version: 2, dates: { knitStart: '2026-10-15' }, tna: { knitStart: '2026-10-05' } });
    expect(page.card().querySelectorAll('[data-guide-hint]')).toHaveLength(0);
  });

  it('a Plan Check List change in End days only holds the save back (the lead differs), then the save goes through', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await page.setYes('Singeing', true);
    expect([page.cardInput('Knit Start').value, page.cardInput('Knit End').value]).toEqual(['2026-10-09', '2026-10-28']);
    page.server.guides.lists.saveDirectly(
      STANDARD.map((item) => (item.id === 'singeing' ? { ...item, endDays: 9 } : item)),
      'planner9'
    );
    await page.saveData();
    expect(page.toasts.at(-1)).toBe(
      'error: Planning Guide not saved: The Plan Check List changed after this page loaded them, so the Planning Guide was not saved. ' +
        'The guide now uses the latest values: check its dates and save again.'
    );
    expect(page.server.guides.requests('PUT')).toEqual([]);
    expect([page.cardInput('Knit Start').value, page.cardInput('Knit End').value]).toEqual(['2026-10-09', '2026-10-30']);
    expect(page.card().querySelector('[data-guide-lead]')?.textContent).toBe('+7d / +9d Checklist Lead Time');
    await page.wait(4000);
    await page.saveData();
    expect(page.toasts.at(-1)).toBe(GUIDE_SAVED);
    expect(page.server.guides.guides.get(ORDER)).toMatchObject({ lead: { startDays: 7, endDays: 9 }, dates: { knitEnd: '2026-10-30' } });
  });

  it('"Removed" is decided against the current list, also when the stored snapshot keeps the criterion as inactive', async () => {
    const OLD = { id: 'chk_old', name: 'Old one', startDays: 30, endDays: 30, active: true };
    let stored: StoredGuide | null = null;
    page = await openGuidePage({
      fixture: savedOrder(),
      dept: 'knitting',
      list: [...STANDARD, OLD],
      before: (s) => {
        s.guides.saveDirectly(ORDER, { yesIds: ['heatset', 'chk_old'], dates: HEATSET_DATES }, 'planner9');
        // "Old one" is deleted from the Plan Check List; the guide is saved again with it still Yes, so the server's
        // snapshot keeps it as an inactive entry.
        s.guides.lists.saveDirectly(STANDARD, 'planner9');
        stored = s.guides.saveDirectly(ORDER, { yesIds: ['heatset', 'chk_old'], dates: HEATSET_DATES }, 'planner9');
      },
    });
    expect((stored as StoredGuide | null)?.checks.find((check) => check.id === 'chk_old')).toEqual({ ...OLD, active: false });
    const row = page.card().querySelector('[data-criterion="chk_old"]') as HTMLElement;
    expect(row.textContent).toContain('Old one');
    expect(row.textContent).toContain('Removed');
    expect(row.textContent).not.toContain('Inactive');
    expect(page.cardSelect('Old one').value).toBe('Yes');
    // It never counts: only Heatset gives the lead.
    expect(page.card().querySelector('[data-guide-lead]')?.textContent).toBe('+10d / +7d Checklist Lead Time');
    expect(page.card().querySelectorAll('[data-guide-hint]')).toHaveLength(0);
  });

  it('an order number with "/" and a space: encoded request paths, cache keys by the order number', async () => {
    const orderNo = 'V3T-C34/2 X';
    const f = savedOrder();
    f.orderNo = orderNo;
    f.orders[0].orderNo = orderNo;
    f.orderDates[0].orderNo = orderNo;
    page = await openGuidePage({ fixture: f, dept: 'knitting' });
    expect(page.server.log).toContain('GET /api/orders/V3T-C34%2F2%20X?dept=knitting');
    await page.setYes('Heatset', true);
    const from = page.server.log.length;
    await page.saveData();
    expect(page.server.log.slice(from)).toEqual(['GET /api/orders/V3T-C34%2F2%20X?fresh=1', 'GET /api/plan-check-list', 'PUT /api/orders/V3T-C34%2F2%20X/plan-guide']);
    expect(page.toasts.at(-1)).toBe(`success: Planning Guide saved for Order #${orderNo}.`);
    expect(page.server.guides.guides.get(orderNo)).toMatchObject({ orderNo, version: 1 });
    expect(DEPTS.map((d) => cachedGuide(page!, d)?.version)).toEqual([1, 1, 1, 1, 1]);
    expect(page.modules.cache.cachedOrderDetails.has(`knitting_${orderNo}`)).toBe(true);
  });
});
