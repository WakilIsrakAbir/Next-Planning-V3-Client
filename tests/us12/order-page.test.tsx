import { afterEach, describe, expect, it } from 'vitest';
import { openPage, type PageDriver } from '../c2/driver';
import { savedOrder, twoRows } from '../c2/fixtures';
import type { Loose } from '../harness/types';
import { orderHasYdItems, sectionsFor, showsSection } from '@/features/planning/lib/order-page-model';

// US-12 on the order page: the YD section on the other department pages (12.1), the Dyeing Process Name select
// (12.2) and the strip's "Department Fabric Items" subheader with the Row 1 hint (12.3).

let page: PageDriver | null = null;
afterEach(() => {
  page?.close();
  page = null;
});

const sectionKeys = () => Array.from(document.querySelectorAll('[data-plan-section]')).map((s) => s.getAttribute('data-plan-section'));
const viewOnly = (p: PageDriver, key: string) => Boolean(p.section(key).querySelector('[data-pill="view-only"]'));
const lastSave = (p: PageDriver) => p.savePlansRequests().at(-1) as Loose;
const options = (el: Element) => Array.from((el as HTMLSelectElement).options).map((o) => o.value);
const PROCESSES = ['', 'Solid', 'Dyeing Wash', 'HTR', 'Pluvia', 'SB', 'WH', 'DF', 'Process-X'];

function withoutYd(): ReturnType<typeof savedOrder> {
  const f = savedOrder();
  (f.orders[0] as Loose).ydItems = [];
  return f;
}

describe('12.1 the YD section on the Knitting, Dyeing and Delivery pages', () => {
  it('section order: route section(s), then YD, Knitting, Dyeing, Delivery Floor, Delivery Lock', () => {
    const view = (route: string) => sectionsFor(route).map((s) => `${s.key}${s.isRoute ? '*' : ''}`);
    expect(view('knitting')).toEqual(['knitting*', 'yd', 'dyeing', 'deliveryFloor', 'deliveryLock']);
    expect(view('dyeing')).toEqual(['dyeing*', 'yd', 'knitting', 'deliveryFloor', 'deliveryLock']);
    expect(view('delivery')).toEqual(['deliveryFloor*', 'deliveryLock*', 'yd', 'knitting', 'dyeing']);
    expect(view('deliveryfloor')).toEqual(['deliveryFloor*', 'yd', 'knitting', 'dyeing', 'deliveryLock']);
    expect(view('deliverylock')).toEqual(['deliveryLock*', 'yd', 'knitting', 'dyeing', 'deliveryFloor']);
    // The YD page itself and the Finishing page are unchanged.
    expect(view('yd')).toEqual(['yd*', 'knitting', 'dyeing', 'deliveryFloor', 'deliveryLock']);
    expect(view('finishing')).toEqual(['finishing*', 'knitting', 'dyeing', 'deliveryFloor', 'deliveryLock']);
  });

  it('is shown only when the order has YD items (deptFlags, else order.ydItems)', () => {
    const yd = sectionsFor('knitting').find((s) => s.key === 'yd')!;
    const ydRoute = sectionsFor('yd')[0];
    expect(orderHasYdItems({ ydItems: [{}] }, { yd: { inLatestFile: true, hasItems: false } })).toBe(false);
    expect(orderHasYdItems({}, { yd: { inLatestFile: true, hasItems: true } })).toBe(true);
    expect(orderHasYdItems({ ydItems: [{}] }, null)).toBe(true);
    expect(orderHasYdItems({ ydItems: [] }, null)).toBe(false);
    expect(showsSection(yd, { ydItems: [] }, null)).toBe(false);
    expect(showsSection(yd, { ydItems: [{}] }, null)).toBe(true);
    // The route's own YD section always shows; other sections are not affected.
    expect(showsSection(ydRoute, {}, { yd: { inLatestFile: true, hasItems: false } })).toBe(true);
    expect(sectionsFor('knitting').filter((s) => s.key !== 'yd').every((s) => showsSection(s, {}, null))).toBe(true);
  });

  for (const dept of ['knitting', 'dyeing', 'delivery', 'deliveryfloor', 'deliverylock']) {
    it(`${dept} page: a planner sees the YD section View only`, async () => {
      page = await openPage({ fixture: savedOrder(), dept, role: 'planner' });
      expect(sectionKeys()).toContain('yd');
      expect(page.section('yd').hasAttribute('data-route-section')).toBe(false);
      expect(viewOnly(page, 'yd')).toBe(true);
      expect(page.section('yd').querySelector('fieldset')?.disabled).toBe(true);
      expect(page.section('yd').querySelector('[data-action="save-section"]')).toBeNull();
      expect(page.section('yd').querySelectorAll('[data-plan-table="yd"] tbody tr[data-row]').length).toBe(1);
    });
  }

  it('an Admin may edit and save the YD section from the Knitting page (department yd only)', async () => {
    page = await openPage({ fixture: savedOrder(), dept: 'knitting', role: 'admin' });
    expect(viewOnly(page, 'yd')).toBe(false);
    expect(page.section('yd').querySelector('fieldset')?.disabled).toBe(false);
    await page.saveSection('yd');
    expect(lastSave(page).body.plans.map((p: Loose) => p.department)).toEqual(['yd']);
  });

  it('an order without YD items shows no YD section, and nothing else changes', async () => {
    page = await openPage({ fixture: withoutYd(), dept: 'knitting', role: 'admin' });
    expect(sectionKeys()).toEqual(['knitting', 'dyeing', 'deliveryFloor', 'deliveryLock']);
    expect(page.saveDataButton().disabled).toBe(true);
    page.close();
    page = await openPage({ fixture: withoutYd(), dept: 'delivery', role: 'planner' });
    expect(sectionKeys()).toEqual(['deliveryFloor', 'deliveryLock', 'knitting', 'dyeing']);
  });
});

describe('12.2 Dyeing Process Name is a select of the Dropdown Master Setup Dyeing Processes', () => {
  it('offers the PROCESS list; a stored value outside the list stays as an extra option and is saved unchanged', async () => {
    const f = twoRows();
    const dye = (f.orderDates[0] as Loose).dyeing;
    dye[1].processName = 'Old Process';
    dye[1].itemData = { ...dye[1].itemData, ProcessName: 'Old Process', 'Process Name': 'Old Process' };
    page = await openPage({ fixture: f, dept: 'dyeing', role: 'planner' });
    const red = page.field('dyeing', 0, 'processName');
    expect(red.tagName).toBe('SELECT');
    expect(options(red)).toEqual(PROCESSES);
    const blue = page.field('dyeing', 1, 'processName');
    expect(blue.value).toBe('Old Process');
    expect(options(blue)).toEqual(['', 'Old Process', ...PROCESSES.slice(1)]);
    expect(document.querySelector('datalist')).toBeNull();

    // Saved as it is, the stored value is kept.
    await page.saveSection('dyeing');
    const rows = lastSave(page).body.plans[0].fabricItems as Loose[];
    expect(rows.map((r) => r.processName)).toEqual(['Solid', 'Old Process']);
    // A list value can be chosen (today's handleUnitProcessChange; Row 1 still auto-fills the rows below).
    await page.set('dyeing', 1, 'processName', 'Pluvia');
    expect(page.field('dyeing', 1, 'processName').value).toBe('Pluvia');
    expect(page.field('dyeing', 0, 'processName').value).toBe('Solid');
  });
});

describe('12.3 the strip shows "Department Fabric Items" and the Row 1 hint', () => {
  it('no header row in the table card; the subheader, items pill and hint are in the strip', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'dyeing', role: 'planner' });
    const strip = page.section('dyeing').querySelector('[data-c2-chrome]') as HTMLElement;
    const text = (strip.textContent || '').replace(/\s+/g, ' ');
    expect(text).toContain('Dyeing PlanDepartment Fabric Items2 items');
    expect(strip.querySelector('[data-hint="row1"]')?.textContent).toBe('Row 1 changes auto-fill all items below');
    // The card starts with its table: the yellow "Department Fabric Items (n)" row is gone.
    const card = page.section('dyeing').querySelector('[data-plan-table]')!.closest('.overflow-hidden') as HTMLElement;
    expect(card.firstElementChild?.querySelector('table')).not.toBeNull();
    expect(page.section('dyeing').querySelector('fieldset')?.textContent).not.toContain('Department Fabric Items');
    // A View only section has the subheader but no hint.
    const knitStrip = page.section('knitting').querySelector('[data-c2-chrome]') as HTMLElement;
    expect(knitStrip.querySelector('[data-subheader]')?.textContent).toBe('Department Fabric Items');
    expect(knitStrip.querySelector('[data-hint="row1"]')).toBeNull();
  });
});
