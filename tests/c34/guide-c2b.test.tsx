import { afterEach, describe, expect, it } from 'vitest';
import { openGuidePage, type GuidePage } from './guide-page';
import { savedOrder } from '../c2/fixtures';
import { API_BASE, TEST_TOKEN, fingerprintAllDepts } from '../harness/mock-server';
import { harnessState } from '../harness/state';
import { T } from '../golden/scenarios/texts';
import type { Loose } from '../harness/types';
import type { StoredGuide } from '../plan-guide/guide-server';

// The Planning Guide card together with the C2b protection of the order page (final integration):
// - "Save mine anyway" of a refused Save Data is a whole Save Data: the plans first (without base), then the guide,
//   with the same messages (SPEC C2 10a, D7);
// - every read keeps the newest guide by guide.version, "Load latest" included;
// - the leave guard names the Planning Guide next to the sections;
// - the sessionStorage backup of the sections leaves the card working.

const ORDER = 'SYN-S1';
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
const CPB_DATES = { ...LIVE, knitStart: '2026-10-14', knitEnd: '2026-10-30' };
const DEPTS = ['yd', 'knitting', 'dyeing', 'finishing', 'delivery'];
const PUT = `PUT /api/orders/${ORDER}/plan-guide`;
const SAVE_PLANS = 'POST /api/orders/save-plans';
const GUIDE_CHECK = [`GET /api/orders/${ORDER}?fresh=1`, 'GET /api/plan-check-list'];
const GUIDE_SAVED = `success: Planning Guide saved for Order #${ORDER}.`;
const conflictText = (dept: string) => `${dept} was changed by someone else after this order was opened.`;
const leaveMessage = (labels: string[]) => `Unsaved changes in: ${labels.join(', ')}. Leave without saving?`;

let page: GuidePage | null = null;
afterEach(() => {
  page?.close();
  page = null;
});

const storedPlan = (p: GuidePage) => p.server.plans.db.orderDates.find((d) => d.orderNo === ORDER);
const alertOf = (p: GuidePage, key: string) => p.section(key).querySelector('[data-conflict]') as HTMLElement | null;
const value = (p: GuidePage, key: string, row: number, name: string) => p.field(key, row, name).value;
const posts = (p: GuidePage) => p.server.plans.log.filter((r) => r.method === 'POST');
const lastPut = (p: GuidePage) => p.server.guides.requests('PUT').at(-1);
const cachedGuide = (p: GuidePage, dept: string) =>
  (p.modules.cache.cachedOrderDetails.get(`${dept}_${p.orderNo}`) as { guide?: { version: number } } | undefined)?.guide;
const shownGuide = (p: GuidePage) => [p.cardSelect('Heatset').value, p.cardSelect('CPB').value, p.cardInput('Knit Start').value];
const routerCalls = () => harnessState().routerCalls.map((c) => (c.args.length ? `${c.fn}:${c.args.join(',')}` : c.fn));
const button = (text: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

/** Another user saves `dept` through the API (save-plans without base); not a request of this page. */
async function someoneElseSaves(p: GuidePage, dept: string, edit: (rows: Loose[]) => void): Promise<void> {
  const record = storedPlan(p);
  const rows = JSON.parse(JSON.stringify(record[dept]));
  edit(rows);
  const before = p.server.plans.log.length;
  const res = await p.server.plans.fetch(`${API_BASE}/api/orders/save-plans`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNo: ORDER, plans: [{ department: dept, fabricItems: rows, orderStatus: record[`${dept}Status`] }] }),
  });
  p.server.plans.log.splice(before);
  expect(res.status).toBe(200);
}

/** A detail answer with the stored plan and the guide chosen by the test. */
function detailReply(p: GuidePage, guide: StoredGuide | null): { status: number; json: Loose } {
  const planData = JSON.parse(JSON.stringify(storedPlan(p)));
  const flags = Object.fromEntries(DEPTS.map((d) => [d, { inLatestFile: true, hasItems: true }]));
  return {
    status: 200,
    json: { order: JSON.parse(JSON.stringify(p.server.order(ORDER))), planData, fingerprints: fingerprintAllDepts(planData), deptFlags: flags, guide },
  };
}

/** Dyeing edited here, the guide set to Heatset, then Save Data refused because someone else saved Dyeing (409). */
async function refusedSaveData(p: GuidePage): Promise<void> {
  await p.set('dyeing', 0, 'remarks', 'd mine');
  await p.setYes('Heatset', true);
  expect(p.saveDataButton().textContent).toBe('Save Data (2)');
  await someoneElseSaves(p, 'dyeing', (rows) => {
    rows[0].limitation = 'theirs';
  });
  const from = p.server.log.length;
  await p.saveData();
  // Nothing was saved: the plans were refused, so the guide was not sent either.
  expect(p.server.log.slice(from)).toEqual([SAVE_PLANS]);
  expect(p.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
  expect(alertOf(p, 'dyeing')).not.toBeNull();
  expect(p.server.guides.guides.has(ORDER)).toBe(false);
  expect(p.cardPills()).toEqual(['1 Yes', 'Unsaved']);
  expect(p.saveDataButton().textContent).toBe('Save Data (2)');
  await p.wait(4000);
}

describe('"Save mine anyway" with unsaved Planning Guide changes', () => {
  it('after a refused Save Data it is a whole Save Data: the plans again without base, then the guide', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await refusedSaveData(page);

    const from = page.server.log.length;
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="save-mine"]'));
    expect(page.server.log.slice(from)).toEqual([SAVE_PLANS, ...GUIDE_CHECK, PUT, `GET /api/orders/${ORDER}?dept=knitting&fresh=1`]);
    const [refused, again] = posts(page);
    expect(refused.body.base).toHaveProperty('dyeing');
    expect(again.body.base).toBeUndefined();
    expect(again.body.plans).toEqual(refused.body.plans);
    expect(lastPut(page)?.body).toEqual({ yesIds: ['heatset'], dates: HEATSET_DATES });

    expect(page.toasts.at(-1)).toBe(`success: ${T.saved(ORDER)}`);
    expect(storedPlan(page).dyeing[0]).toMatchObject({ remarks: 'd mine', limitation: '' });
    expect(page.server.guides.guides.get(ORDER)).toMatchObject({ version: 1, yesIds: ['heatset'], dates: HEATSET_DATES });
    expect(alertOf(page, 'dyeing')).toBeNull();
    expect(page.pills('dyeing')).not.toContain('Unsaved');
    expect(page.cardPills()).toEqual(['1 Yes']);
    expect(page.saveDataButton().textContent).toBe('Save Data');
    expect(page.modules.guard.getUnsavedLabels()).toEqual([]);
    expect(DEPTS.map((d) => cachedGuide(page!, d)?.version)).toEqual([1, 1, 1, 1, 1]);
    expect(page.errors).toEqual([]);
  });

  it('the guide fails after "Save mine anyway" saved the plans: "Plans saved. Planning Guide not saved: <reason>"', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await refusedSaveData(page);
    page.server.guides.scriptNext({ method: 'PUT', status: 500, json: { message: 'Server error while saving the Planning Guide.' } });

    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="save-mine"]'));
    expect(page.toasts.at(-1)).toBe('error: Plans saved. Planning Guide not saved: Server error while saving the Planning Guide.');
    expect(posts(page)).toHaveLength(2);
    expect(storedPlan(page).dyeing[0]).toMatchObject({ remarks: 'd mine', limitation: '' });
    expect(alertOf(page, 'dyeing')).toBeNull();
    expect(page.pills('dyeing')).not.toContain('Unsaved');
    // The guide stays unsaved and counts in Save Data; the card shows the reason.
    expect(page.server.guides.guides.has(ORDER)).toBe(false);
    expect(page.cardPills()).toEqual(['1 Yes', 'Unsaved']);
    expect(page.saveDataButton().textContent).toBe('Save Data (1)');
    expect(page.modules.guard.getUnsavedLabels()).toEqual(['Planning Guide']);
    expect(page.card().querySelector('[role="alert"]')?.textContent).toContain('Server error while saving the Planning Guide.');

    // Save Data again sends only the guide.
    await page.wait(4000);
    const from = page.server.log.length;
    await page.saveData();
    expect(page.server.log.slice(from)).toEqual([...GUIDE_CHECK, PUT]);
    expect(page.toasts.at(-1)).toBe(GUIDE_SAVED);
    expect(page.saveDataButton().textContent).toBe('Save Data');
    expect(page.errors).toEqual([]);
  });

  it('after a refused section Save it stays a section save: the guide is not sent', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await page.set('dyeing', 0, 'remarks', 'd mine');
    await page.setYes('Heatset', true);
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`error: ${conflictText('Dyeing')}`);
    await page.wait(4000);

    const from = page.server.log.length;
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="save-mine"]'));
    expect(page.server.log.slice(from)).toEqual([SAVE_PLANS, `GET /api/orders/${ORDER}?dept=knitting&fresh=1`]);
    expect(posts(page).at(-1)?.body.base).toBeUndefined();
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved(ORDER)}`);
    expect(page.server.guides.requests('PUT')).toEqual([]);
    expect(page.cardPills()).toEqual(['1 Yes', 'Unsaved']);
    expect(page.saveDataButton().textContent).toBe('Save Data (1)');
    expect(page.errors).toEqual([]);
  });
});

describe('"Load latest" keeps the newest Planning Guide (guide.version)', () => {
  it('takes a newer stored guide with the latest plan; a save of the card is then based on it', async () => {
    page = await openGuidePage({
      fixture: savedOrder(),
      dept: 'knitting',
      before: (s) => {
        s.guides.saveDirectly(ORDER, { yesIds: ['heatset'], dates: HEATSET_DATES }, 'planner9');
      },
    });
    expect(shownGuide(page)).toEqual(['Yes', 'No', '2026-10-12']);
    await page.set('dyeing', 0, 'remarks', 'd mine');
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[0].limitation = 'theirs';
    });
    // Someone also saved the guide (version 2).
    page.server.guides.saveDirectly(ORDER, { yesIds: ['cpb'], dates: CPB_DATES }, 'planner9');
    await page.saveSection('dyeing');
    expect(alertOf(page, 'dyeing')).not.toBeNull();
    // A refusal reads nothing: the card still shows version 1.
    expect(shownGuide(page)).toEqual(['Yes', 'No', '2026-10-12']);

    page.answer(true);
    const from = page.server.log.length;
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="load-latest"]'));
    expect(page.confirms).toEqual(['Load the latest saved Dyeing Plan? Your unsaved changes in Dyeing Plan will be lost.']);
    expect(page.server.log.slice(from)).toEqual([`GET /api/orders/${ORDER}?dept=knitting&fresh=1`]);
    expect(value(page, 'dyeing', 0, 'limitation')).toBe('theirs');
    expect(value(page, 'dyeing', 0, 'remarks')).toBe('');
    expect(alertOf(page, 'dyeing')).toBeNull();
    // The read's guide is newer: the card shows it, and the cache holds it.
    expect(shownGuide(page)).toEqual(['No', 'Yes', '2026-10-14']);
    expect(page.cardPills()).toEqual(['1 Yes']);
    expect(cachedGuide(page, 'knitting')?.version).toBe(2);

    // The card's next save is based on version 2 (no conflict).
    await page.wait(4000);
    await page.setCardDate('Lock Start', '2026-11-20');
    await page.saveGuide();
    expect(lastPut(page)?.body).toMatchObject({ version: 2, yesIds: ['cpb'], dates: { lockStart: '2026-11-20' } });
    expect(page.toasts.at(-1)).toBe(GUIDE_SAVED);
    expect(page.server.guides.guides.get(ORDER)).toMatchObject({ version: 3 });
    expect(page.errors).toEqual([]);
  });

  it('never replaces a newer guide with an older one, and keeps unsaved guide changes', async () => {
    let v1: StoredGuide | null = null;
    page = await openGuidePage({
      fixture: savedOrder(),
      dept: 'knitting',
      before: (s) => {
        v1 = s.guides.saveDirectly(ORDER, { yesIds: ['heatset'], dates: HEATSET_DATES }, 'planner9');
        s.guides.saveDirectly(ORDER, { yesIds: ['cpb'], dates: CPB_DATES }, 'planner9');
      },
    });
    expect(shownGuide(page)).toEqual(['No', 'Yes', '2026-10-14']);

    // 1. "Load latest" whose read carries an OLDER guide (another server instance): the plan is taken, the guide not.
    await page.set('dyeing', 0, 'remarks', 'd mine');
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[0].limitation = 'theirs';
    });
    await page.saveSection('dyeing');
    page.server.plans.scriptNext('detail', detailReply(page, v1));
    page.answer(true);
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="load-latest"]'));
    expect(value(page, 'dyeing', 0, 'limitation')).toBe('theirs');
    expect(alertOf(page, 'dyeing')).toBeNull();
    expect(shownGuide(page)).toEqual(['No', 'Yes', '2026-10-14']);
    expect(cachedGuide(page, 'knitting')?.version).toBe(2);

    // 2. Unsaved guide changes, then "Load latest" brings a newer guide (version 3): the page takes it (cache), the
    //    card keeps the unsaved changes, and saving them is refused instead of overwriting version 3.
    await page.wait(4000);
    await page.setCardDate('Lock Start', '2026-11-20');
    page.server.guides.saveDirectly(ORDER, { yesIds: ['singeing'], dates: { ...LIVE, knitStart: '2026-10-09', knitEnd: '2026-10-28' } }, 'planner9');
    await page.set('dyeing', 0, 'remarks', 'again');
    await someoneElseSaves(page, 'dyeing', (rows) => {
      rows[0].limitation = 'theirs 2';
    });
    await page.saveSection('dyeing');
    expect(alertOf(page, 'dyeing')).not.toBeNull();
    page.answer(true);
    await page.click(alertOf(page, 'dyeing')!.querySelector('[data-action="load-latest"]'));
    expect(value(page, 'dyeing', 0, 'limitation')).toBe('theirs 2');
    expect(cachedGuide(page, 'knitting')?.version).toBe(3);
    expect(page.cardInput('Lock Start').value).toBe('2026-11-20');
    expect(shownGuide(page)).toEqual(['No', 'Yes', '2026-10-14']);
    expect(page.cardPills()).toContain('Unsaved');
    expect(page.saveDataButton().textContent).toBe('Save Data (1)');

    await page.wait(4000);
    await page.saveData();
    expect(lastPut(page)?.body).toMatchObject({ version: 2 });
    expect(page.toasts.at(-1)).toMatch(/^error: Planning Guide not saved: The Planning Guide of this order was changed by planner9/);
    expect(page.server.guides.guides.get(ORDER)).toMatchObject({ version: 3, yesIds: ['singeing'] });
    expect(page.errors).toEqual([]);
  });
});

describe('the leave guard names the Planning Guide', () => {
  it('Back with unsaved sections and an unsaved guide names all of them; each label goes when its work is saved', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await page.set('knitting', 0, 'remarks', 'k');
    await page.setYes('Heatset', true);
    await page.set('dyeing', 0, 'remarks', 'd');
    const all = ['Knitting Plan', 'Dyeing Plan', 'Planning Guide'];
    expect(page.modules.guard.getUnsavedLabels()).toEqual(all);
    expect(page.saveDataButton().textContent).toBe('Save Data (3)');

    // Cancel keeps the page and the work.
    page.answer(false);
    await page.click(button('Back'));
    expect(page.confirms).toEqual([leaveMessage(all)]);
    expect(routerCalls()).toEqual([]);
    expect(page.cardPills()).toEqual(['1 Yes', 'Unsaved']);

    // The sections saved: only the guide is left.
    await page.saveSection('knitting');
    await page.wait(4000);
    page.answer(true);
    await page.click(page.section('dyeing').querySelector('[data-action="discard"]'));
    expect(page.modules.guard.getUnsavedLabels()).toEqual(['Planning Guide']);
    page.answer(false);
    await page.click(button('Back'));
    expect(page.confirms.at(-1)).toBe(leaveMessage(['Planning Guide']));
    expect(routerCalls()).toEqual([]);

    // The guide saved: nothing is unsaved and Back leaves without asking.
    await page.saveGuide();
    expect(page.toasts.at(-1)).toBe(GUIDE_SAVED);
    expect(page.modules.guard.getUnsavedLabels()).toEqual([]);
    const asked = page.confirms.length;
    await page.click(button('Back'));
    expect(page.confirms).toHaveLength(asked);
    expect(routerCalls()).toEqual(['push:/planning/knitting']);
    expect(page.errors).toEqual([]);
  });

  it('a guide changed first is named first; OK leaves', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await page.setYes('CPB', true);
    await page.set('deliveryLock', 0, 'remarks', 'l');
    expect(page.modules.guard.getUnsavedLabels()).toEqual(['Planning Guide', 'Delivery Plan (Lock)']);
    page.answer(true);
    await page.click(document.querySelector('button[title="Go Back"]'));
    expect(page.confirms).toEqual([leaveMessage(['Planning Guide', 'Delivery Plan (Lock)'])]);
    expect(routerCalls()).toEqual(['push:/planning/knitting']);
    expect(page.errors).toEqual([]);
  });
});

describe('the unsaved-work backup next to the card', () => {
  it('backs up the sections only; after Restore the card works and Save Data saves the restored plan and the guide', async () => {
    page = await openGuidePage({ fixture: savedOrder(), dept: 'knitting' });
    await page.set('dyeing', 0, 'remarks', 'd mine');
    await page.setYes('Heatset', true);
    await page.wait(600);
    const backups = () => {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('planning.orderBackup:')) keys.push(k);
      }
      return keys;
    };
    expect(backups().map((k) => k.split(':').slice(1, 4).join(':'))).toEqual([`admin:${ORDER}:dyeing`]);

    // The page opens again in this tab: the restore offer names the section, not the guide (it is not backed up).
    await page.reopen('knitting');
    const offer = () => document.querySelector('[data-restore-offer]') as HTMLElement | null;
    expect(offer()?.textContent).toContain('Unsaved changes from your last visit were kept for: Dyeing Plan. Restore them?');
    expect(page.cardPills()).toEqual(['0 Yes']);
    expect(shownGuide(page)).toEqual(['No', 'No', '2026-10-02']);
    expect(page.saveDataButton().disabled).toBe(true);

    await page.click(offer()!.querySelector('[data-action="restore-backup"]'));
    expect(offer()).toBeNull();
    expect(value(page, 'dyeing', 0, 'remarks')).toBe('d mine');
    expect(page.saveDataButton().textContent).toBe('Save Data (1)');
    // The card keeps working beside the restored section.
    await page.setYes('Heatset', true);
    expect(shownGuide(page)).toEqual(['Yes', 'No', '2026-10-12']);
    expect(page.saveDataButton().textContent).toBe('Save Data (2)');
    expect(page.modules.guard.getUnsavedLabels()).toEqual(['Dyeing Plan', 'Planning Guide']);

    const from = page.server.log.length;
    await page.saveData();
    expect(page.server.log.slice(from)).toEqual([SAVE_PLANS, ...GUIDE_CHECK, PUT, `GET /api/orders/${ORDER}?dept=knitting&fresh=1`]);
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved(ORDER)}`);
    expect(storedPlan(page).dyeing[0].remarks).toBe('d mine');
    expect(page.server.guides.guides.get(ORDER)).toMatchObject({ version: 1, yesIds: ['heatset'], dates: HEATSET_DATES });
    expect(page.saveDataButton().textContent).toBe('Save Data');
    await page.wait(600);
    expect(backups()).toEqual([]);
    expect(page.errors).toEqual([]);
  });
});
