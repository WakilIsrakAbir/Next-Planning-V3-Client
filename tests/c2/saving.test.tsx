import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { openPage, tableValues, withoutTimes, type PageDriver } from './driver';
import { savedOrder, twoRows } from './fixtures';
import { API_BASE, MockServer, TEST_TOKEN, fingerprintDept } from '../harness/mock-server';
import { createDeptPlanLogic } from '@/features/planning/lib/dept-plan-logic';
import { buildMergedItems, formatPlanPayload } from '@/features/planning/lib/order-plan-logic';
import { T } from '../golden/scenarios/texts';
import type { Loose } from '../harness/types';

// Saving from the universal order page: section Saves, Save Data (plan D3, D5, D6; SPEC C2 items 6-7, section 5).

let page: PageDriver | null = null;
afterEach(() => {
  page?.close();
  page = null;
});

const stored = (p: PageDriver) => p.server.db.orderDates.find((d) => d.orderNo === 'SYN-S1');
const departmentsOf = (req: Loose) => req.body.plans.map((pl: Loose) => pl.department);

describe('edit another department as Admin, save it, open its own page', () => {
  it('Dyeing edited and saved from the Knitting page shows the same rows on the Dyeing page', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    const fpBefore = fingerprintDept(stored(page), 'dyeing');
    await page.set('dyeing', 0, 'endDate', '2026-10-27');
    await page.set('dyeing', 1, 'remarks', 'from knitting page');
    await page.set('dyeing', 1, 'endDate', '2026-10-28');
    expect(page.pills('dyeing')).toContain('Unsaved');
    expect(page.pills('knitting')).not.toContain('Unsaved');

    await page.saveSection('dyeing');
    const [req] = page.savePlansRequests();
    expect(departmentsOf(req)).toEqual(['dyeing']);
    expect(req.body.base).toEqual({ dyeing: fpBefore });
    expect(page.toasts).toContain(`success: ${T.saved('SYN-S1')}`);
    expect(page.pills('dyeing')).not.toContain('Unsaved');
    // Today's refetch follows, with fresh=1 for this recently saved order.
    const gets = page.server.log.filter((r) => r.method === 'GET' && r.url.startsWith('/api/orders/SYN-S1'));
    expect(gets.map((r) => r.url)).toEqual(['/api/orders/SYN-S1?dept=knitting', '/api/orders/SYN-S1?dept=knitting&fresh=1']);

    const onKnittingPage = tableValues(page.section('dyeing'));
    expect(onKnittingPage[0].endDate).toBe('2026-10-27');
    expect(onKnittingPage[1]).toMatchObject({ remarks: 'from knitting page', endDate: '2026-10-28', planType: 'Tentative' });

    // The Dyeing page opens from the filled cache and then reads the order again: identical rows.
    await page.reopen('dyeing');
    expect(tableValues(page.section('dyeing'))).toEqual(onKnittingPage);
    expect(page.server.log.at(-1)?.url).toBe('/api/orders/SYN-S1?dept=dyeing&fresh=1');
    expect(page.errors).toEqual([]);
  });

  it('fills all five detail cache keys: another department page paints the saved rows before its request answers', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'cached');
    await page.saveSection('dyeing');
    for (const dept of ['yd', 'dyeing', 'finishing', 'delivery']) {
      page.server.scriptNext('detail', { hold: true });
      await page.reopen(dept);
      expect((page.field('dyeing', 1, 'remarks') as HTMLTextAreaElement).value).toBe('cached');
      page.server.releaseHeld();
      await page.settle();
    }
  });
});

describe('Save Data (plan D5, D6)', () => {
  it('sends every dirty section in one save-plans request, clean sections never', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    expect(page.saveDataButton().disabled).toBe(true);
    expect(page.saveDataButton().textContent).toBe('Save Data');
    await page.set('knitting', 1, 'remarks', 'k');
    await page.set('dyeing', 0, 'remarks', 'd');
    await page.set('deliveryLock', 0, 'remarks', 'l');
    expect(page.saveDataButton().textContent).toBe('Save Data (3)');
    const base = { knitting: fingerprintDept(stored(page), 'knitting'), dyeing: fingerprintDept(stored(page), 'dyeing'), delivery: fingerprintDept(stored(page), 'delivery') };

    await page.saveData();
    const reqs = page.savePlansRequests();
    expect(reqs).toHaveLength(1);
    expect(departmentsOf(reqs[0])).toEqual(['knitting', 'dyeing', 'delivery']);
    expect(reqs[0].body.base).toEqual(base);
    // Delivery: only Lock was edited, so its Floor fields come from the saved baseline.
    const deli = reqs[0].body.plans[2];
    expect(deli.fabricItems.map((r: Loose) => [r.remarks, r.floorStartDate])).toEqual([
      ['l', '2026-10-23'],
      ['l', '2026-10-24'],
    ]);
    expect(page.toasts).toEqual([`success: ${T.saved('SYN-S1')}`]);
    for (const key of ['knitting', 'dyeing', 'deliveryFloor', 'deliveryLock']) expect(page.pills(key)).not.toContain('Unsaved');
    expect(page.saveDataButton().disabled).toBe(true);
    expect(stored(page).knitting[1].remarks).toBe('k');
    expect(stored(page).dyeing[0].remarks).toBe('d');
    expect(stored(page).delivery.map((r: Loose) => r.remarks)).toEqual(['l', 'l']);
    // Finishing and YD were never sent.
    expect(stored(page).finishing).toEqual(savedOrder().orderDates[0].finishing);
  });

  it('a failed check saves nothing: today toast, downstream first, the failing section opened and highlighted', async () => {
    const f = twoRows();
    f.orderDates[0].knitting[1].endDate = ''; // Blue knitting saved Tentative without an end date (SAVE-05)
    page = await openPage({ fixture: f, dept: 'knitting', role: 'admin' });
    const scrolled: string[] = [];
    (Element.prototype as Loose).scrollIntoView = function () {
      scrolled.push(this.getAttribute('data-plan-section'));
    };
    try {
      await page.set('knitting', 0, 'remarks', 'k');
      await page.toggle('deliveryFloor');
      await page.set('deliveryLock', 0, 'remarks', 'l');
      // Floor start after Floor end: no check on change, refused at save (SAVE-04).
      await page.toggle('deliveryFloor');
      await page.set('deliveryFloor', 1, 'floorStartDate', '2026-11-20');
      await page.toggle('deliveryFloor');
      expect(page.section('deliveryFloor').querySelector('table')).toBeNull();

      await page.saveData();
      expect(page.savePlansRequests()).toEqual([]);
      // Delivery is checked before Knitting: its toast, not Knitting's.
      expect(page.toasts).toEqual([`error: ${T.endBeforeStart}`]);
      expect(page.section('deliveryFloor').className).toContain('ring-2');
      expect(page.section('deliveryLock').className).toContain('ring-2');
      expect(page.section('knitting').className).not.toContain('ring-2');
      expect(page.section('deliveryFloor').querySelector('table')).not.toBeNull();
      expect(scrolled).toEqual(['deliveryFloor']);
      expect(page.pills('knitting')).toContain('Unsaved');

      // Delivery fixed: now Knitting's own check (SAVE-05) stops the save, again with nothing sent.
      await page.set('deliveryFloor', 1, 'floorStartDate', '2026-10-24');
      await page.wait(4000);
      await page.saveData();
      expect(page.savePlansRequests()).toEqual([]);
      expect(page.toasts.at(-1)).toBe(`error: ${T.typeWithoutDates}`);
      expect(page.section('knitting').className).toContain('ring-2');

      // A section Save runs the same check and sends nothing either.
      await page.wait(4000);
      await page.saveSection('knitting');
      expect(page.savePlansRequests()).toEqual([]);
      expect(page.toasts.at(-1)).toBe(`error: ${T.typeWithoutDates}`);
      // The highlight goes away after a while.
      await page.wait(7000);
      expect(page.section('knitting').className).not.toContain('ring-2');
    } finally {
      delete (Element.prototype as Loose).scrollIntoView;
    }
  });

  it('Completed prompts: once per department in pipeline order; Cancel restores that saved status and stops everything', async () => {
    page = await openPage({ fixture: savedOrder(), dept: 'dyeing', role: 'admin' });
    await page.setStatus('dyeing', 'Completed');
    await page.setStatus('knitting', 'Completed');
    await page.setStatus('deliveryLock', 'Completed');

    // Knitting (first in pipeline order) cancelled: Knitting back to its saved 'Tentative', nothing else asked.
    page.answer(false);
    await page.saveData();
    expect(page.confirms).toEqual([T.completedConfirm('SYN-S1')]);
    expect((page.section('knitting').querySelector('[data-field="orderStatus"]') as HTMLSelectElement).value).toBe('Tentative');
    expect((page.section('dyeing').querySelector('[data-field="orderStatus"]') as HTMLSelectElement).value).toBe('Completed');
    expect(page.savePlansRequests()).toEqual([]);

    // Knitting Completed again; Knitting confirmed, Dyeing cancelled: Dyeing back to its saved 'Pending'.
    await page.setStatus('knitting', 'Completed');
    page.answer(true, false);
    await page.saveData();
    expect(page.confirms).toHaveLength(3);
    expect(page.generalStatus().value).toBe('Pending');
    expect((page.section('knitting').querySelector('[data-field="orderStatus"]') as HTMLSelectElement).value).toBe('Completed');
    expect(page.savePlansRequests()).toEqual([]);

    // All three confirmed: one request, in pipeline order.
    await page.setStatus('dyeing', 'Completed');
    page.answer(true, true, true);
    await page.saveData();
    expect(page.confirms).toHaveLength(6);
    const [req] = page.savePlansRequests();
    expect(req.body.plans.map((pl: Loose) => [pl.department, pl.orderStatus])).toEqual([
      ['knitting', 'Completed'],
      ['dyeing', 'Completed'],
      ['delivery', 'Completed'],
    ]);
    expect(page.server.db.orders[0].dyeingPlanStatus).toBe('Completed');
    expect(page.errors).toEqual([]);
  });

  it('equals today single saves made downstream-first (same stored documents)', async () => {
    const edit = async (p: PageDriver) => {
      await p.set('knitting', 1, 'endDate', '2026-10-18');
      await p.set('knitting', 0, 'limitation', 'knit limit');
      await p.set('dyeing', 1, 'remarks', 'dye note');
      await p.set('dyeing', 0, 'endDate', '2026-10-27');
      await p.setStatus('dyeing', 'Tentative');
      await p.set('deliveryFloor', 1, 'floorEndDate', '2026-11-03');
      await p.set('deliveryLock', 1, 'startDate', '2026-10-27');
      await p.set('deliveryLock', 1, 'endDate', '2026-11-06');
      await p.set('deliveryLock', 1, 'planType', 'Tentative');
      await p.setStatus('deliveryLock', 'Pending');
    };
    const a = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await edit(a);
    await a.saveData();
    expect(a.savePlansRequests()).toHaveLength(1);
    const together = withoutTimes({ orderDates: a.server.db.orderDates, orders: a.server.db.orders });
    a.close();

    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await edit(page);
    for (const key of ['deliveryFloor', 'deliveryLock', 'dyeing', 'knitting']) await page.saveSection(key);
    expect(page.savePlansRequests()).toHaveLength(4);
    expect(page.toasts.filter((t) => t.startsWith('error'))).toEqual([]);
    expect(withoutTimes({ orderDates: page.server.db.orderDates, orders: page.server.db.orders })).toEqual(together);
  });

  it("equals today's save-dates saves made downstream-first, with the rows built by today's handlers outside the page", async () => {
    // The oracle never touches the universal page (no reducer, rowsForSave, PlanSection or save-plans): for each
    // department, downstream first, it does what today's page did after opening that department's page: read the
    // order, build the rows (buildMergedItems), apply the edits with today's handlers (createDeptPlanLogic, the
    // unchanged C1 code), run validateForSave and confirmCompletion, and POST save-dates (the mock's port of today's
    // server). The edits target the same cells as the page run below.
    type Edit = (l: ReturnType<typeof createDeptPlanLogic>, setStatus: (s: string) => void) => void;
    const EDITS: Array<[string, Edit[]]> = [
      [
        'delivery',
        [
          (l) => l.handleFloorChange(1, 'floorEndDate', '2026-11-03'),
          (l) => l.handleStartDateChange(1, '2026-10-27'),
          (l) => l.handleEndDateChange(1, '2026-11-06'),
          (l) => l.handlePlanTypeChange(1, 'Tentative'),
          (_l, setStatus) => setStatus('Pending'),
        ],
      ],
      [
        'dyeing',
        [
          (l) => l.handleTextChange(1, 'remarks', 'dye note'),
          (l) => l.handleEndDateChange(0, '2026-10-27'),
          (_l, setStatus) => setStatus('Tentative'),
        ],
      ],
      [
        'knitting',
        [
          (l) => l.handleEndDateChange(1, '2026-10-18'),
          (l) => l.handleTextChange(0, 'limitation', 'knit limit'),
        ],
      ],
    ];
    const oracle = new MockServer(twoRows());
    const auth = { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' };
    const oracleToasts: string[] = [];
    for (const [dept, edits] of EDITS) {
      const detail = await (await oracle.fetch(`${API_BASE}/api/orders/SYN-S1?dept=${dept}`, { headers: auth })).json();
      let rows: Loose[] = buildMergedItems(detail.order, detail.planData, dept);
      let status: string = detail.planData?.[`${dept}Status`] || 'On Process';
      const logicOf = () =>
        createDeptPlanLogic({
          dept,
          orderNo: 'SYN-S1',
          order: detail.order,
          planData: detail.planData,
          planItems: rows,
          setPlanItems: (u) => {
            rows = typeof u === 'function' ? u(rows) : u;
          },
          orderStatus: status,
          setOrderStatus: (u) => {
            status = typeof u === 'function' ? u(status) : u;
          },
          isAdmin: true,
          showToast: (m) => oracleToasts.push(m),
        });
      for (const edit of edits) edit(logicOf(), (s) => (status = s));
      const logic = logicOf();
      expect(logic.validateForSave()).toBe(true);
      expect(logic.confirmCompletion()).toBe(true);
      const res = await oracle.fetch(`${API_BASE}/api/orders/save-dates`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ orderNo: 'SYN-S1', department: dept, fabricItems: formatPlanPayload(dept, rows), orderStatus: status }),
      });
      expect(res.status).toBe(200);
    }
    expect(oracleToasts).toEqual([]);

    // The universal page: the same cells edited on the Knitting page, then one Save Data.
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('knitting', 1, 'endDate', '2026-10-18');
    await page.set('knitting', 0, 'limitation', 'knit limit');
    await page.set('dyeing', 1, 'remarks', 'dye note');
    await page.set('dyeing', 0, 'endDate', '2026-10-27');
    await page.setStatus('dyeing', 'Tentative');
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-03');
    await page.set('deliveryLock', 1, 'startDate', '2026-10-27');
    await page.set('deliveryLock', 1, 'endDate', '2026-11-06');
    await page.set('deliveryLock', 1, 'planType', 'Tentative');
    await page.setStatus('deliveryLock', 'Pending');
    await page.saveData();
    expect(page.savePlansRequests()).toHaveLength(1);
    expect(page.toasts).toEqual([`success: ${T.saved('SYN-S1')}`]);
    expect(withoutTimes({ orderDates: page.server.db.orderDates, orders: page.server.db.orders })).toEqual(
      withoutTimes({ orderDates: oracle.db.orderDates, orders: oracle.db.orders })
    );
  });

  it('every Save is disabled while a save runs (no double submit)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('knitting', 1, 'remarks', 'k');
    await page.set('dyeing', 1, 'remarks', 'd');
    page.server.scriptNext('saveDates', { hold: true });
    await page.saveSection('knitting');
    const saves = Array.from(document.querySelectorAll('[data-action^="save"]')) as HTMLButtonElement[];
    expect(saves.length).toBeGreaterThan(5);
    expect(saves.every((b) => b.disabled)).toBe(true);
    expect(page.section('knitting').querySelector('[data-action="save-section"] .animate-spin')).not.toBeNull();
    expect(page.section('dyeing').querySelector('[data-action="save-section"] .animate-spin')).toBeNull();
    // A click on a disabled button does nothing; the handler itself also refuses a second save.
    await page.click(page.section('dyeing').querySelector('[data-action="save-section"]'));
    expect(page.savePlansRequests()).toHaveLength(1);
    page.server.releaseHeld();
    await page.settle();
    expect(page.pills('knitting')).not.toContain('Unsaved');
    expect(page.pills('dyeing')).toContain('Unsaved');
    expect(page.section('dyeing').querySelector('[data-action="save-section"]')?.hasAttribute('disabled')).toBe(false);
  });

  it('two Save clicks before the page renders again send one request (the handler itself refuses a second save)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('knitting', 1, 'remarks', 'k');
    await page.set('dyeing', 1, 'remarks', 'd');
    page.server.scriptNext('saveDates', { hold: true });
    const knittingSave = page.section('knitting').querySelector('[data-action="save-section"]') as HTMLButtonElement;
    const dyeingSave = page.section('dyeing').querySelector('[data-action="save-section"]') as HTMLButtonElement;
    const saveData = page.saveDataButton();
    // One act: React renders (and disables the buttons) only after all three clicks.
    act(() => {
      knittingSave.click();
      saveData.click();
      dyeingSave.click();
    });
    await page.settle();
    expect(page.savePlansRequests()).toHaveLength(1);
    page.server.releaseHeld();
    await page.settle();
    const reqs = page.savePlansRequests();
    expect(reqs).toHaveLength(1);
    expect(departmentsOf(reqs[0])).toEqual(['knitting']);
    expect(page.pills('knitting')).not.toContain('Unsaved');
    expect(page.pills('dyeing')).toContain('Unsaved');
    expect(page.errors).toEqual([]);
  });
});

describe('Delivery Floor and Lock saves (plan D3)', () => {
  it('Save Floor sends the Floor draft with the saved Lock fields and status; Lock keeps its draft', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 0, 'floorEndDate', '2026-11-03');
    await page.set('deliveryLock', 0, 'remarks', 'lock draft');
    await page.setStatus('deliveryLock', 'Confirm');

    await page.saveSection('deliveryFloor');
    const [req] = page.savePlansRequests();
    expect(req.body.plans).toHaveLength(1);
    const plan = req.body.plans[0];
    expect(plan.orderStatus).toBe('Tentative');
    // Row 1 changes are copied to every row (today's rule), in the Floor and in the Lock table.
    expect(plan.fabricItems.map((r: Loose) => [r.floorEndDate, r.remarks])).toEqual([
      ['2026-11-03', ''],
      ['2026-11-03', ''],
    ]);
    expect(stored(page).deliveryStatus).toBe('Tentative');
    const afterFloorSave = fingerprintDept(stored(page), 'delivery');
    expect(page.pills('deliveryFloor')).not.toContain('Unsaved');
    expect(page.pills('deliveryLock')).toContain('Unsaved');
    expect((page.field('deliveryLock', 0, 'remarks') as HTMLTextAreaElement).value).toBe('lock draft');
    expect(page.generalStatus().value).toBe('Confirm');

    // Then Save Lock: its draft with the now saved Floor values. The delivery plan was saved by this page (Floor),
    // so its new fingerprint is the base: no false conflict from our own Floor save.
    await page.wait(4000);
    await page.saveSection('deliveryLock');
    const second = page.savePlansRequests()[1];
    expect(second.body.base.delivery).toBe(afterFloorSave);
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(stored(page).delivery.map((r: Loose) => [r.floorEndDate, r.remarks])).toEqual([
      ['2026-11-03', 'lock draft'],
      ['2026-11-03', 'lock draft'],
    ]);
    expect(stored(page).deliveryStatus).toBe('Confirm');
    expect(page.pills('deliveryLock')).not.toContain('Unsaved');
  });

  it('Save Lock sends the Lock draft with the saved Floor fields; Floor keeps its draft', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'admin' });
    await page.set('deliveryFloor', 1, 'floorPlanType', 'Confirm');
    await page.set('deliveryLock', 1, 'limitation', 'lim');
    await page.saveSection('deliveryLock');
    const plan = page.savePlansRequests()[0].body.plans[0];
    expect(plan.fabricItems.map((r: Loose) => [r.floorPlanType, r.limitation])).toEqual([
      ['Tentative', ''],
      ['Tentative', 'lim'],
    ]);
    expect(page.pills('deliveryFloor')).toContain('Unsaved');
    expect(page.field('deliveryFloor', 1, 'floorPlanType').value).toBe('Confirm');
    expect(stored(page).delivery[1].floorPlanType).toBe('Tentative');
  });

  it("each card's footer Save Planning Schedule saves the whole Delivery plan, as today's single footer button did", async () => {
    for (const card of ['deliveryLock', 'deliveryFloor']) {
      page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
      const footers = ['deliveryFloor', 'deliveryLock'].map((k) => page!.section(k).querySelector('[data-action="save"]')?.textContent?.trim());
      expect(footers).toEqual(['Save Planning Schedule', 'Save Planning Schedule']);
      await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
      await page.set('deliveryLock', 1, 'remarks', 'both');
      await page.setStatus('deliveryLock', 'Pending');

      await page.click(page.section(card).querySelector('[data-action="save"]'));
      const reqs = page.savePlansRequests();
      expect(reqs).toHaveLength(1);
      const plan = reqs[0].body.plans[0];
      expect(reqs[0].body.plans).toHaveLength(1);
      expect(plan.department).toBe('delivery');
      expect(plan.orderStatus).toBe('Pending');
      expect(plan.fabricItems.map((r: Loose) => [r.floorEndDate, r.remarks])).toEqual([
        ['2026-11-01', ''],
        ['2026-11-04', 'both'],
      ]);
      expect(page.toasts).toEqual([`success: ${T.saved('SYN-S1')}`]);
      expect(page.pills('deliveryFloor')).not.toContain('Unsaved');
      expect(page.pills('deliveryLock')).not.toContain('Unsaved');
      expect(stored(page).deliveryStatus).toBe('Pending');
      page.close();
      page = null;
    }
  });

  it('on a clean delivery page the footer Save still sends the whole Delivery plan, as today', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.click(page.section('deliveryFloor').querySelector('[data-action="save"]'));
    const [req] = page.savePlansRequests();
    expect(req.body.plans.map((p: Loose) => [p.department, p.orderStatus, p.fabricItems.length])).toEqual([['delivery', 'Tentative', 2]]);
    expect(page.toasts).toEqual([`success: ${T.saved('SYN-S1')}`]);
  });
});

describe('Discard', () => {
  it('a section returns to its saved rows and status after a confirm; Cancel keeps the edits', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'planner' });
    await page.set('knitting', 1, 'remarks', 'draft');
    await page.setStatus('knitting', 'Pending');
    page.answer(false);
    await page.discard('knitting');
    expect(page.confirms).toEqual(['Discard the unsaved changes in Knitting Plan?']);
    expect((page.field('knitting', 1, 'remarks') as HTMLTextAreaElement).value).toBe('draft');
    page.answer(true);
    await page.discard('knitting');
    expect((page.field('knitting', 1, 'remarks') as HTMLTextAreaElement).value).toBe('');
    expect(page.generalStatus().value).toBe('Tentative');
    expect(page.pills('knitting')).not.toContain('Unsaved');
    expect((page.section('knitting').querySelector('[data-action="discard"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('a delivery group: only its own fields (and the status for Lock)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 0, 'floorStartDate', '2026-10-25');
    await page.set('deliveryLock', 0, 'remarks', 'keep me');
    page.answer(true);
    await page.discard('deliveryFloor');
    expect(page.field('deliveryFloor', 0, 'floorStartDate').value).toBe('2026-10-23');
    expect(page.field('deliveryFloor', 1, 'floorStartDate').value).toBe('2026-10-24');
    expect((page.field('deliveryLock', 0, 'remarks') as HTMLTextAreaElement).value).toBe('keep me');
    expect(page.pills('deliveryLock')).toContain('Unsaved');
    await page.setStatus('deliveryLock', 'Pending');
    page.answer(true);
    await page.discard('deliveryLock');
    expect((page.field('deliveryLock', 0, 'remarks') as HTMLTextAreaElement).value).toBe('');
    expect(page.generalStatus().value).toBe('Tentative');
    expect(page.saveDataButton().disabled).toBe(true);
  });
});

describe('server answers (SPEC C2 item 6, section 5)', () => {
  const failures: Array<[string, Loose, string]> = [
    ['404 from an older server', { status: 404, text: '<!DOCTYPE html><html><body><pre>Cannot POST /api/orders/save-plans</pre></body></html>' }, 'Deploy the updated Next Planning V3 server to save from this page.'],
    ['404 order not found', { status: 404, json: { message: 'Order "SYN-S1" not found.' } }, 'Order "SYN-S1" not found.'],
    ['500 kept changing', { status: 500, json: { message: 'The order kept changing while it was being saved. Nothing was saved; please save again.' } }, 'The order kept changing while it was being saved. Nothing was saved; please save again.'],
    ['409 conflict (temporary C2a handling)', { status: 409, json: { code: 'CONFLICT', message: 'Dyeing was changed by someone else after this order was opened.', departments: ['dyeing'] } }, 'Dyeing was changed by someone else after this order was opened.'],
    ['400', { status: 400, json: { code: 'INVALID', message: 'plans.0.fabricItems: At least one item is required.' } }, 'plans.0.fabricItems: At least one item is required.'],
  ];
  for (const [name, reply, toast] of failures) {
    it(`${name}: the toast, every draft stays, nothing merged again, same base next time`, async () => {
      page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
      await page.set('knitting', 1, 'remarks', 'k');
      await page.set('dyeing', 1, 'remarks', 'd');
      page.server.scriptNext('saveDates', reply);
      await page.saveData();
      expect(page.toasts).toEqual([`error: ${toast}`]);
      expect(page.pills('knitting')).toContain('Unsaved');
      expect(page.pills('dyeing')).toContain('Unsaved');
      expect((page.field('dyeing', 1, 'remarks') as HTMLTextAreaElement).value).toBe('d');
      const getsAfter = page.server.log.filter((r) => r.method === 'GET' && r.url.includes('fresh=1'));
      expect(getsAfter).toEqual([]);
      await page.wait(4000);
      await page.saveData();
      const [first, second] = page.savePlansRequests();
      expect(second.body.base).toEqual(first.body.base);
      expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    });
  }
});

describe('fingerprints and the keep-newest guard (S1 step 9, SPEC C2 item 7)', () => {
  it('only the saved sections adopt the new fingerprint: a section that stays dirty keeps its old base', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    const dyeingBase = fingerprintDept(stored(page), 'dyeing');
    await page.set('knitting', 1, 'remarks', 'k');
    await page.set('dyeing', 1, 'remarks', 'mine');
    // Someone else saves Dyeing meanwhile.
    stored(page).dyeing[0].remarks = 'someone else';
    await page.saveSection('knitting');
    expect(page.toasts).toEqual([`success: ${T.saved('SYN-S1')}`]);
    // The dirty Dyeing section kept its draft and its old base: its save is refused instead of overwriting.
    expect((page.field('dyeing', 0, 'remarks') as HTMLTextAreaElement).value).toBe('');
    await page.wait(4000);
    await page.saveSection('dyeing');
    const req = page.savePlansRequests()[1];
    expect(req.body.base).toEqual({ dyeing: dyeingBase });
    expect(page.toasts.at(-1)).toBe('error: Dyeing was changed by someone else after this order was opened.');
    expect(stored(page).dyeing[0].remarks).toBe('someone else');
    expect(page.pills('dyeing')).toContain('Unsaved');
  });

  it('a delivery group that stays dirty keeps the old base through a read: Save Floor is refused, the other change stays', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    const deliveryBase = fingerprintDept(stored(page), 'delivery');
    // Floor edited here, Lock left clean.
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    await page.set('knitting', 1, 'remarks', 'k');
    // Someone else changes a stored delivery Floor value.
    stored(page).delivery[0].floorPlanType = 'Confirm';
    // Saving Knitting reads the order again (fresh=1): the clean Lock group is merged again, the Floor draft stays.
    await page.saveSection('knitting');
    expect(page.toasts).toEqual([`success: ${T.saved('SYN-S1')}`]);
    expect(page.server.log.at(-1)?.url).toBe('/api/orders/SYN-S1?dept=knitting&fresh=1');
    expect(page.pills('deliveryFloor')).toContain('Unsaved');
    expect(page.pills('deliveryLock')).not.toContain('Unsaved');
    expect(page.field('deliveryFloor', 1, 'floorEndDate').value).toBe('2026-11-04');

    // The delivery base is still the one this page loaded: the save is refused instead of overwriting.
    await page.wait(4000);
    await page.saveSection('deliveryFloor');
    const req = page.savePlansRequests()[1];
    expect(req.body.base).toEqual({ delivery: deliveryBase });
    expect(page.toasts.at(-1)).toBe('error: Delivery was changed by someone else after this order was opened.');
    expect(stored(page).delivery[0].floorPlanType).toBe('Confirm');
    expect(page.pills('deliveryFloor')).toContain('Unsaved');
    // Save Data (Floor dirty) is refused the same way.
    await page.wait(4000);
    await page.saveData();
    expect(page.savePlansRequests()[2].body.base).toEqual({ delivery: deliveryBase });
    expect(page.toasts.at(-1)).toBe('error: Delivery was changed by someone else after this order was opened.');
    expect(stored(page).delivery[0].floorPlanType).toBe('Confirm');
  });

  it('a reload within 2 minutes of a save still reads fresh=1 (the mark is kept for this tab)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    const detailUrls = () => page!.server.log.filter((r) => r.method === 'GET' && r.url.startsWith('/api/orders/')).map((r) => r.url);
    await page.set('dyeing', 1, 'remarks', 'x');
    await page.saveSection('dyeing');
    await page.wait(60_000);
    await page.reload('delivery');
    expect(detailUrls().at(-1)).toBe('/api/orders/SYN-S1?dept=delivery&fresh=1');
    expect((page.field('dyeing', 1, 'remarks') as HTMLTextAreaElement).value).toBe('x');
    // After 2 minutes the reads use the server cache again.
    await page.wait(61_000);
    await page.reload();
    expect(detailUrls().at(-1)).toBe('/api/orders/SYN-S1?dept=delivery');
    // Storage that throws: nothing breaks, the mark simply lives in this page's memory only.
    const proto = Object.getPrototypeOf(sessionStorage);
    const original = { get: proto.getItem, set: proto.setItem };
    proto.getItem = function (this: Storage, key: string) {
      if (this === sessionStorage) throw new Error('blocked');
      return original.get.call(this, key);
    };
    proto.setItem = function (this: Storage, key: string, value: string) {
      if (this === sessionStorage) throw new Error('blocked');
      return original.set.call(this, key, value);
    };
    try {
      await page.set('dyeing', 1, 'remarks', 'y');
      await page.saveSection('dyeing');
      expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
      expect(detailUrls().at(-1)).toBe('/api/orders/SYN-S1?dept=delivery&fresh=1');
      await page.reload();
      expect(detailUrls().at(-1)).toBe('/api/orders/SYN-S1?dept=delivery');
    } finally {
      proto.getItem = original.get;
      proto.setItem = original.set;
    }
    expect(page.errors).toEqual([]);
  });

  it('a detail read older than the plan on screen is ignored', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    const old = JSON.parse(JSON.stringify(page.server.db.orderDates[0]));
    const oldOrder = JSON.parse(JSON.stringify(page.server.db.orders[0]));
    await page.set('knitting', 1, 'remarks', 'new');
    // The refetch after the save gets another server instance's older copy.
    page.server.scriptNext('detail', { status: 200, json: { order: oldOrder, planData: old } });
    await page.saveSection('knitting');
    expect((page.field('knitting', 1, 'remarks') as HTMLTextAreaElement).value).toBe('new');
    expect(page.pills('knitting')).not.toContain('Unsaved');
  });
});

describe('only the edited section renders again (SPEC C2 item 10c)', () => {
  it('typing in Knitting renders no other section', async () => {
    const counts: Record<string, number> = {};
    (globalThis as Loose).__C2_RENDERS__ = counts;
    vi.doMock('@/features/planning/components/DeptPlanSection', async () => {
      const real = await vi.importActual<Loose>('@/features/planning/components/DeptPlanSection');
      return {
        default: (props: Loose) => {
          const key = props.columns ? `delivery-${props.columns}` : props.dept;
          const c = (globalThis as Loose).__C2_RENDERS__;
          c[key] = (c[key] || 0) + 1;
          return real.default(props);
        },
      };
    });
    try {
      page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
      Object.keys(counts).forEach((k) => delete counts[k]);
      const { fireEvent } = await import('@testing-library/react');
      for (const ch of 'abc') {
        const el = page.field('knitting', 1, 'remarks') as HTMLTextAreaElement;
        fireEvent.change(el, { target: { value: el.value + ch } });
        await page.settle();
      }
      expect(counts).toEqual({ knitting: 3 });
    } finally {
      vi.doUnmock('@/features/planning/components/DeptPlanSection');
    }
  });

  it('typing in Delivery Lock renders only the Lock section, typing in Floor only the Floor section; both edits are saved', async () => {
    const counts: Record<string, number> = {};
    (globalThis as Loose).__C2_RENDERS__ = counts;
    vi.doMock('@/features/planning/components/DeptPlanSection', async () => {
      const real = await vi.importActual<Loose>('@/features/planning/components/DeptPlanSection');
      return {
        default: (props: Loose) => {
          const key = props.columns ? `delivery-${props.columns}` : props.dept;
          const c = (globalThis as Loose).__C2_RENDERS__;
          c[key] = (c[key] || 0) + 1;
          return real.default(props);
        },
      };
    });
    try {
      page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'admin' });
      const { fireEvent } = await import('@testing-library/react');
      const type = async (key: string, row: number, name: string, values: string[]) => {
        Object.keys(counts).forEach((k) => delete counts[k]);
        for (const value of values) {
          fireEvent.change(page!.field(key, row, name), { target: { value } });
          await page!.settle();
        }
      };
      await type('deliveryLock', 1, 'remarks', ['a', 'ab', 'abc']);
      expect(counts).toEqual({ 'delivery-lock': 3 });
      // Row 1 of Lock auto-fills every row below it (row 0 is the first row): still only the Lock section.
      await type('deliveryLock', 0, 'limitation', ['L']);
      expect(counts).toEqual({ 'delivery-lock': 1 });
      await type('deliveryFloor', 1, 'floorEndDate', ['2026-11-03', '2026-11-04']);
      expect(counts).toEqual({ 'delivery-floor': 2 });
      // The Floor section was skipped while Lock changed: its edit must not have lost the Lock edits.
      await type('deliveryLock', 1, 'remarks', ['abcd']);
      expect(counts).toEqual({ 'delivery-lock': 1 });
      await page.saveData();
      const plan = page.savePlansRequests()[0].body.plans[0];
      expect(plan.fabricItems.map((r: Loose) => [r.floorEndDate, r.limitation, r.remarks])).toEqual([
        ['2026-11-01', 'L', ''],
        ['2026-11-04', 'L', 'abcd'],
      ]);
    } finally {
      vi.doUnmock('@/features/planning/components/DeptPlanSection');
    }
  });
});
