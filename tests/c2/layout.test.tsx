import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { openPage, type PageDriver } from './driver';
import { notInLatest, savedOrder, twoRows } from './fixtures';
import type { Fixture } from '../harness/types';

// The universal order page: which sections, in which order, who may edit them, pills, notes, Hide/Unhide, statuses.

let page: PageDriver | null = null;
afterEach(() => {
  page?.close();
  page = null;
});

const sectionKeys = () => Array.from(document.querySelectorAll('[data-plan-section]')).map((s) => s.getAttribute('data-plan-section'));
const routeKeys = () => Array.from(document.querySelectorAll('[data-route-section]')).map((s) => s.getAttribute('data-plan-section'));
const isDisabled = (el: Element) => el.matches(':disabled');

describe('sections and their order (plan D2)', () => {
  const cases: Array<[string, string[], string[]]> = [
    ['yd', ['yd', 'knitting', 'dyeing', 'deliveryFloor', 'deliveryLock'], ['yd']],
    // US-12: the order has YD items, so the YD section is added after the route section(s).
    ['knitting', ['knitting', 'yd', 'dyeing', 'deliveryFloor', 'deliveryLock'], ['knitting']],
    ['dyeing', ['dyeing', 'yd', 'knitting', 'deliveryFloor', 'deliveryLock'], ['dyeing']],
    ['finishing', ['finishing', 'knitting', 'dyeing', 'deliveryFloor', 'deliveryLock'], ['finishing']],
    ['delivery', ['deliveryFloor', 'deliveryLock', 'yd', 'knitting', 'dyeing'], ['deliveryFloor', 'deliveryLock']],
  ];
  for (const [dept, keys, route] of cases) {
    it(`${dept} page: ${keys.join(', ')}`, async () => {
      page = await openPage({ fixture: savedOrder(), dept, role: 'admin' });
      expect(sectionKeys()).toEqual(keys);
      expect(routeKeys()).toEqual(route);
      const titles = keys.map((k) => page!.section(k).querySelector('[data-c2-chrome] button span')?.textContent);
      expect(titles).toEqual(
        keys.map(
          (k) =>
            ({
              yd: 'YD Plan',
              knitting: 'Knitting Plan',
              dyeing: 'Dyeing Plan',
              finishing: 'Finishing Plan',
              deliveryFloor: 'Delivery Plan (Floor)',
              deliveryLock: 'Delivery Plan (Lock)',
            })[k]
        )
      );
      expect(page.errors).toEqual([]);
    });
  }
});

describe('Delivery Floor and Lock: two tables over the same rows (plan D3)', () => {
  it('Floor shows only the Floor fields, Lock the delivery fields and the Order Status', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    const fieldsOf = (key: string) =>
      Array.from(page!.section(key).querySelectorAll('[data-plan-table] [data-row="0"] [data-field]')).map((e) => e.getAttribute('data-field'));
    expect(fieldsOf('deliveryFloor')).toEqual(['floorStartDate', 'floorEndDate', 'floorPlanType']);
    expect(fieldsOf('deliveryLock')).toEqual(['startDate', 'endDate', 'planType', 'limitation', 'remarks']);
    expect(page.section('deliveryFloor').querySelector('[data-c2-chrome] [data-field="orderStatus"]')).toBeNull();
    expect((page.section('deliveryLock').querySelector('[data-c2-chrome] [data-field="orderStatus"]') as HTMLSelectElement).value).toBe('Tentative');
    // Both tables show the identification and read-only columns.
    const firstCells = (key: string) =>
      Array.from(page!.section(key).querySelectorAll('[data-plan-table] [data-row="1"] td'))
        .slice(0, 3)
        .map((td) => td.textContent);
    expect(firstCells('deliveryFloor')).toEqual(['Blue', 'Rib', '180']);
    expect(firstCells('deliveryLock')).toEqual(['Blue', 'Rib', '180']);
    // Blue has no saved delivery row: the Floor defaults (Dyeing + 7 days) are shown, and are not "Unsaved".
    expect(page.field('deliveryFloor', 1, 'floorStartDate').value).toBe('2026-10-24');
    expect(page.pills('deliveryFloor')).toEqual(['2 items']);
  });

  it('an edit in one group marks only that group Unsaved', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'delivery', role: 'planner' });
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    expect(page.pills('deliveryFloor')).toContain('Unsaved');
    expect(page.pills('deliveryLock')).not.toContain('Unsaved');
    await page.set('deliveryLock', 1, 'remarks', 'lock note');
    expect(page.pills('deliveryLock')).toContain('Unsaved');
    expect(page.saveDataButton().textContent).toContain('Save Data (2)');
  });
});

describe('edit rights (plan D4)', () => {
  for (const role of ['planner', 'approver', 'viewer', 'none', 'lowerApprover'] as const) {
    it(`${role}: the route section as today, every other section View only`, async () => {
      page = await openPage({ fixture: twoRows(), dept: 'knitting', role });
      expect(page.pills('knitting')).not.toContain('View only');
      expect(page.section('knitting').querySelector('fieldset')?.disabled).toBe(false);
      expect(page.section('knitting').querySelector('[data-action="save-section"]')).not.toBeNull();
      for (const [key, label] of [
        ['dyeing', 'Dyeing'],
        ['deliveryFloor', 'Delivery'],
        ['deliveryLock', 'Delivery'],
      ]) {
        const s = page.section(key);
        expect(page.pills(key)).toContain('View only');
        const fieldset = s.querySelector('fieldset') as HTMLFieldSetElement;
        expect(fieldset.disabled).toBe(true);
        expect(fieldset.getAttribute('title')).toBe(`View only: no ${label} Plan access`);
        // Every control of the table is disabled and looks disabled.
        const controls = Array.from(s.querySelectorAll('[data-plan-table] [data-field]'));
        expect(controls.length).toBeGreaterThan(0);
        expect(controls.every(isDisabled)).toBe(true);
        expect(fieldset.className).toContain('[&_:is(input,select,textarea):disabled]:opacity-60');
        // No Save, no Discard, no auto-fill hint; the status select is disabled; Hide/Unhide still works.
        expect(s.querySelector('[data-action="save-section"]')).toBeNull();
        expect(s.querySelector('[data-action="discard"]')).toBeNull();
        expect(s.querySelector('[data-action="save"]')).toBeNull();
        expect(s.textContent).not.toContain('Row 1 changes auto-fill');
        const status = s.querySelector('[data-c2-chrome] [data-field="orderStatus"]');
        if (status) expect(isDisabled(status)).toBe(true);
        expect(isDisabled(s.querySelector('[data-action="toggle-section"]') as Element)).toBe(false);
      }
      expect(page.errors).toEqual([]);
    });
  }

  it("Admin (role exactly 'Admin') may edit every section", async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    for (const key of ['knitting', 'dyeing', 'deliveryFloor', 'deliveryLock']) {
      expect(page.pills(key)).not.toContain('View only');
      expect(page.section(key).querySelector('fieldset')?.disabled).toBe(false);
      expect(page.section(key).querySelector('[data-action="save-section"]')?.textContent).toBe(
        { knitting: 'Save Knitting', dyeing: 'Save Dyeing', deliveryFloor: 'Save Floor', deliveryLock: 'Save Lock' }[key]
      );
    }
    // Only the route section has today's footer (Cancel, Save Planning Schedule).
    expect(page.section('knitting').querySelector('[data-action="save"]')).not.toBeNull();
    expect(page.section('dyeing').querySelector('[data-action="save"]')).toBeNull();
    // Outside the delivery page it saves the section itself: no scope title.
    expect(page.section('knitting').querySelector('[data-action="save"]')?.hasAttribute('title')).toBe(false);
  });

  it('a View only section cannot be changed even through the DOM: no draft, not Unsaved, not counted, never sent', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'planner' });
    const statusOf = (key: string) => page!.section(key).querySelector('[data-c2-chrome] [data-field="orderStatus"]') as HTMLSelectElement;
    const tamper = async () => {
      // Events dispatched straight on the controls (as from DevTools): React still runs their onChange.
      fireEvent.change(page!.field('dyeing', 0, 'remarks'), { target: { value: 'tamper' } });
      fireEvent.change(page!.field('dyeing', 1, 'endDate'), { target: { value: '2026-10-28' } });
      fireEvent.change(page!.field('deliveryFloor', 1, 'floorEndDate'), { target: { value: '2026-11-09' } });
      fireEvent.change(page!.field('deliveryLock', 0, 'remarks'), { target: { value: 'tamper' } });
      fireEvent.change(statusOf('dyeing'), { target: { value: 'Completed' } });
      fireEvent.change(statusOf('deliveryLock'), { target: { value: 'Confirm' } });
      await page!.settle();
    };
    const expectUnchanged = () => {
      expect((page!.field('dyeing', 0, 'remarks') as HTMLTextAreaElement).value).toBe('');
      expect(page!.field('dyeing', 1, 'endDate').value).toBe('2026-10-26');
      expect(page!.field('deliveryFloor', 1, 'floorEndDate').value).toBe('2026-11-02');
      expect((page!.field('deliveryLock', 0, 'remarks') as HTMLTextAreaElement).value).toBe('');
      expect(statusOf('dyeing').value).toBe('Pending');
      expect(statusOf('deliveryLock').value).toBe('Tentative');
      for (const key of ['knitting', 'dyeing', 'deliveryFloor', 'deliveryLock']) expect(page!.pills(key)).not.toContain('Unsaved');
      expect(page!.saveDataButton().disabled).toBe(true);
      expect(page!.saveDataButton().textContent).toBe('Save Data');
    };

    await tamper();
    expectUnchanged();
    // The disabled attributes removed as well: still nothing changes.
    document.querySelectorAll('fieldset[disabled], [data-c2-chrome] select[disabled]').forEach((el) => el.removeAttribute('disabled'));
    await tamper();
    expectUnchanged();

    // The route section works as today, and Save Data sends it alone.
    await page.set('knitting', 1, 'remarks', 'mine');
    expect(page.saveDataButton().textContent).toBe('Save Data (1)');
    await page.saveData();
    const reqs = page.savePlansRequests();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].body.plans.map((p: { department: string }) => p.department)).toEqual(['knitting']);
    const stored = page.server.db.orderDates[0];
    expect(stored.dyeing[0].remarks).toBe('');
    expect(stored.dyeingStatus).toBe('Pending');
    expect(stored.delivery[0].remarks).toBe('');
    expect(page.errors).toEqual([]);
  });

  it('a section that turns View only (the order left that latest file) has nothing to save, even with edits', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('dyeing', 1, 'remarks', 'mine');
    await page.set('knitting', 1, 'remarks', 'k');
    expect(page.saveDataButton().textContent).toBe('Save Data (2)');
    // The Dyeing latest file no longer lists the order; the read after the Knitting save says so.
    page.server.db.deptValidOrders = { dyeing: ['OTHER-ORDER'] };
    await page.saveSection('knitting');
    expect(page.pills('dyeing')).toEqual(['2 items', 'View only', 'Not in latest file']);
    expect(page.saveDataButton().disabled).toBe(true);
    expect(page.saveDataButton().textContent).toBe('Save Data');
    await page.set('knitting', 1, 'remarks', 'k2');
    await page.wait(4000);
    await page.saveData();
    const second = page.savePlansRequests()[1];
    expect(second.body.plans.map((p: { department: string }) => p.department)).toEqual(['knitting']);
    expect(page.server.db.orderDates[0].dyeing[1]?.remarks ?? '').toBe('');
  });

  it('View only cells show the section reason, not the Row 1 auto-fill hint or the in-row lock reasons', async () => {
    const f = twoRows();
    f.orderDates[0].knitting[0].planType = 'Confirm';
    // Route section: today's tooltips.
    page = await openPage({ fixture: f, dept: 'knitting', role: 'planner' });
    expect(page.field('knitting', 0, 'yarnDate').getAttribute('title')).toBe('⚡ Changing Row 1 Yarn Date auto-fills all items');
    expect(page.field('knitting', 0, 'startDate').getAttribute('title')).toBe('Only Admin can modify Confirmed plan');
    // The same rows in a View only section: no cell tooltip, the fieldset's reason applies.
    await page.reopen('dyeing');
    const knitting = page.section('knitting');
    expect(knitting.querySelector('fieldset')?.getAttribute('title')).toBe('View only: no Knitting Plan access');
    const titled = Array.from(knitting.querySelectorAll('[data-plan-table] [title]')).map((el) => el.getAttribute('title'));
    expect(titled).toEqual([]);
    for (const key of ['deliveryFloor', 'deliveryLock']) {
      expect(Array.from(page.section(key).querySelectorAll('[data-plan-table] [title]'))).toEqual([]);
    }
  });
});

describe('Order Status per section', () => {
  it('General Information is bound to the route department (delivery: the Lock status)', async () => {
    page = await openPage({ fixture: savedOrder(), dept: 'delivery', role: 'admin' });
    expect(page.generalStatus().value).toBe('Tentative');
    await page.setStatus('deliveryLock', 'Confirm');
    expect(page.generalStatus().value).toBe('Confirm');
    expect(page.pills('deliveryLock')).toContain('Unsaved');
    expect(page.pills('deliveryFloor')).not.toContain('Unsaved');
    // Other departments have their own status.
    expect((page.section('dyeing').querySelector('[data-field="orderStatus"]') as HTMLSelectElement).value).toBe('Pending');
    expect((page.section('knitting').querySelector('[data-field="orderStatus"]') as HTMLSelectElement).value).toBe('Tentative');
  });

  it('the knitting page: General Information and the Knitting strip show one status', async () => {
    page = await openPage({ fixture: savedOrder(), dept: 'knitting', role: 'planner' });
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(page.generalStatus(), { target: { value: 'Pending' } });
    await page.settle();
    expect((page.section('knitting').querySelector('[data-field="orderStatus"]') as HTMLSelectElement).value).toBe('Pending');
    expect(page.pills('knitting')).toContain('Unsaved');
  });
});

describe('Hide/Unhide', () => {
  it('hides the table, is remembered by the browser for that page, and works without storage', async () => {
    page = await openPage({ fixture: savedOrder(), dept: 'knitting', role: 'admin' });
    await page.toggle('dyeing');
    expect(page.section('dyeing').querySelector('table')).toBeNull();
    expect(page.section('dyeing').querySelector('[data-action="toggle-section"]')?.textContent).toBe('Unhide');
    expect(localStorage.getItem('orderPage.hiddenSections')).toBe('knitting:dyeing');
    await page.reopen('knitting');
    expect(page.section('dyeing').querySelector('table')).toBeNull();
    // Remembered per page: the Dyeing page (its own section first) is not changed by a Hide on the Knitting page.
    await page.reopen('dyeing');
    expect(page.section('dyeing').querySelector('table')).not.toBeNull();
    await page.toggle('knitting');
    expect(localStorage.getItem('orderPage.hiddenSections')).toBe('dyeing:knitting,knitting:dyeing');
    await page.reopen('knitting');
    expect(page.section('knitting').querySelector('table')).not.toBeNull();
    expect(page.section('dyeing').querySelector('table')).toBeNull();
    await page.toggle('dyeing');
    expect(page.section('dyeing').querySelector('table')).not.toBeNull();
    expect(localStorage.getItem('orderPage.hiddenSections')).toBe('dyeing:knitting');
    // General Information has its own Hide/Unhide.
    const general = document.querySelector('[data-general-info]') as HTMLElement;
    await page.click(general.querySelector('[data-action="toggle-section"]'));
    expect(general.querySelector('[data-field="orderStatus"]')).toBeNull();
    expect(localStorage.getItem('orderPage.hiddenSections')).toBe('dyeing:knitting,knitting:general');
  });

  it('each Hide/Unhide button names its part and points at what it hides', async () => {
    page = await openPage({ fixture: savedOrder(), dept: 'delivery', role: 'admin' });
    const toggles = () =>
      Array.from(document.querySelectorAll('[data-action="toggle-section"]')).map((b) => [
        b.getAttribute('aria-label'),
        b.getAttribute('aria-expanded'),
        b.getAttribute('aria-controls'),
      ]);
    expect(toggles()).toEqual([
      ['Hide General Information', 'true', 'order-general-info-body'],
      ['Hide Delivery Plan (Floor)', 'true', 'plan-section-body-deliveryFloor'],
      ['Hide Delivery Plan (Lock)', 'true', 'plan-section-body-deliveryLock'],
      ['Hide YD Plan', 'true', 'plan-section-body-yd'],
      ['Hide Knitting Plan', 'true', 'plan-section-body-knitting'],
      ['Hide Dyeing Plan', 'true', 'plan-section-body-dyeing'],
    ]);
    for (const [, , id] of toggles()) expect(document.getElementById(id as string)).not.toBeNull();
    expect(page.section('dyeing').querySelector('fieldset')?.id).toBe('plan-section-body-dyeing');
    await page.toggle('dyeing');
    expect(toggles()[5]).toEqual(['Unhide Dyeing Plan', 'false', null]);
  });

  it('storage that throws: Hide/Unhide still works for the page', async () => {
    const proto = Object.getPrototypeOf(localStorage);
    const original = { get: proto.getItem, set: proto.setItem };
    page = await openPage({ fixture: savedOrder(), dept: 'knitting', role: 'admin' });
    proto.getItem = function (key: string) {
      if (key === 'orderPage.hiddenSections') throw new Error('blocked');
      return original.get.call(this, key);
    };
    proto.setItem = function (key: string, value: string) {
      if (key === 'orderPage.hiddenSections') throw new Error('blocked');
      return original.set.call(this, key, value);
    };
    try {
      await page.reopen('knitting');
      await page.toggle('knitting');
      expect(page.section('knitting').querySelector('table')).toBeNull();
    } finally {
      proto.getItem = original.get;
      proto.setItem = original.set;
    }
  });
});

describe('not in the latest file, no items (plan D8)', () => {
  it('an added section not in its latest file: note, pill, View only for Admin too', async () => {
    page = await openPage({ fixture: notInLatest(twoRows(), ['dyeing']), dept: 'knitting', role: 'admin' });
    const note = 'This order is not in the latest Dyeing file, so it is not listed on the Dyeing Plan page.';
    expect(page.section('dyeing').querySelector('[data-note="not-in-latest"]')?.textContent).toBe(note);
    expect(page.pills('dyeing')).toEqual(['2 items', 'View only', 'Not in latest file']);
    expect(page.section('dyeing').querySelector('fieldset')?.disabled).toBe(true);
    expect(page.section('dyeing').querySelector('fieldset')?.getAttribute('title')).toBe(note);
    expect(page.section('knitting').querySelector('[data-note]')).toBeNull();
  });

  it('the route section not in its latest file: only the note, still editable', async () => {
    page = await openPage({ fixture: notInLatest(twoRows(), ['knitting']), dept: 'knitting', role: 'planner' });
    expect(page.section('knitting').querySelector('[data-note="not-in-latest"]')?.textContent).toBe(
      'This order is not in the latest Knitting file, so it is not listed on the Knitting Plan page.'
    );
    expect(page.pills('knitting')).toEqual(['2 items', 'Not in latest file']);
    expect(page.section('knitting').querySelector('fieldset')?.disabled).toBe(false);
  });

  it('an added section without items: note, its Order Status and Save are off; the route section keeps today', async () => {
    const f: Fixture = savedOrder();
    f.orders[0].dyeingItems = [];
    page = await openPage({ fixture: f, dept: 'knitting', role: 'admin' });
    const s = page.section('dyeing');
    expect(s.querySelector('[data-note="no-items"]')?.textContent).toBe('This order has no Dyeing items.');
    expect(isDisabled(s.querySelector('[data-field="orderStatus"]') as Element)).toBe(true);
    expect(isDisabled(s.querySelector('[data-action="save-section"]') as Element)).toBe(true);
    // Through the DOM (disabled attributes removed): the status does not change and its Save does nothing at all.
    s.querySelectorAll('[disabled]').forEach((el) => el.removeAttribute('disabled'));
    fireEvent.change(s.querySelector('[data-field="orderStatus"]') as Element, { target: { value: 'Completed' } });
    await page.settle();
    expect((s.querySelector('[data-field="orderStatus"]') as HTMLSelectElement).value).toBe('Pending');
    expect(page.saveDataButton().disabled).toBe(true);
    await page.click(s.querySelector('[data-action="save-section"]'));
    expect(page.toasts).toEqual([]);
    expect(page.savePlansRequests()).toEqual([]);
    // The dyeing page itself (route) keeps today's behaviour: no note, Save sends and shows today's toast.
    await page.reopen('dyeing');
    expect(page.section('dyeing').querySelector('[data-note]')).toBeNull();
    await page.saveSection('dyeing');
    expect(page.toasts).toContain('error: No fabric items to save! Please upload department data first.');
    expect(page.savePlansRequests()).toEqual([]);
  });
});
