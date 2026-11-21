import { loadSyntheticFixture } from '../harness/fixtures';
import type { Fixture, Loose } from '../harness/types';

/*
 * Fixtures of the universal order page's tests, built from the committed synthetic fixture status-saved (SYN-S1:
 * every department saved, one Red row each, statuses YD Confirm, Knitting Tentative, Dyeing Pending, Finishing
 * Confirm, Delivery Tentative). `twoRows` adds a Blue row to Knitting, Dyeing and Delivery:
 *   knitting  Red  saved Tentative 10-05..10-15 (Yarn 10-01)   Blue saved Tentative 10-06..10-16 (Yarn 10-01)
 *   dyeing    Red  saved Tentative 10-16..10-25 EFL/Solid      Blue saved Tentative 10-17..10-26 EFL/Solid
 *   delivery  Red  saved Tentative 10-26..11-05, Floor 10-23..11-01 Tentative
 *             Blue not saved: Floor defaults from Dyeing + 7 days (10-24..11-02, Tentative)
 */

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function savedOrder(): Fixture {
  return clone(loadSyntheticFixture('status-saved'));
}

export function twoRows(): Fixture {
  const f = savedOrder();
  const order: Loose = f.orders[0];
  const plan: Loose = f.orderDates[0];
  order.knittingItems.push({ ...order.knittingItems[0], Color: 'Blue', FabricConstruction: 'Rib', GSM: 180 });
  order.dyeingItems.push({ ...order.dyeingItems[0], Color: 'Blue' });
  order.deliveryItems.push({ ...order.deliveryItems[0], Color: 'Blue', FabricConstruction: 'Rib', GSM: 180 });
  plan.knitting.push({
    itemId: 'syn-s1_blue_rib_180',
    itemData: { Color: 'Blue', FabricConstruction: 'Rib' },
    startDate: '2026-10-06',
    endDate: '2026-10-16',
    planType: 'Tentative',
    limitation: '',
    remarks: '',
    yarnDate: '2026-10-01',
  });
  plan.dyeing.push({
    itemId: 'syn-s1_blue_solid',
    itemData: { Color: 'Blue', Unit: 'EFL', ProcessName: 'Solid', 'Process Name': 'Solid' },
    startDate: '2026-10-17',
    endDate: '2026-10-26',
    planType: 'Tentative',
    limitation: '',
    remarks: '',
  });
  return f;
}

/** The order is missing from these departments' latest files. */
export function notInLatest(fixture: Fixture, depts: string[]): Fixture {
  const f = clone(fixture);
  f.deptValidOrders = {};
  depts.forEach((d) => {
    (f.deptValidOrders as Record<string, string[]>)[d] = ['OTHER-ORDER'];
  });
  return f;
}
