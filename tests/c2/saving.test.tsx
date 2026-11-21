import { afterEach, describe, expect, it, vi } from 'vitest';
import { openPage, tableValues, withoutTimes, type PageDriver } from './driver';
import { savedOrder, twoRows } from './fixtures';
import { fingerprintDept } from '../harness/mock-server';
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
});
