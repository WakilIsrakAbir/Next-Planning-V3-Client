import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  GUIDE_DATE_KEYS,
  addDaysIso,
  computeGuideDefaults,
  computeLead,
  guideRowsChanged,
  isIsoDay,
  toIsoDay,
  type PlanCheck,
} from '@/features/planning/guide/lib/plan-guide';

/*
 * The client's Planning Guide rules (src/features/planning/lib/plan-guide.ts, SPEC D10 / D11 / C4): strict date
 * parsing, calendar-day shifts, the lead rule (per-column maxima) and the default dates. Every case runs under three
 * time zones; the process time zone is switched at run time and each block first proves the switch took effect.
 */

const ZONES: { tz: string; offsets: [number, number] }[] = [
  { tz: 'UTC', offsets: [0, 0] },
  { tz: 'Asia/Dhaka', offsets: [-360, -360] },
  { tz: 'America/New_York', offsets: [300, 240] }, // daylight saving in July
];

/** The standard Plan Check List (SPEC D9). */
const D9: PlanCheck[] = [
  { id: 'heatset', name: 'Heatset', startDays: 10, endDays: 7, active: true },
  { id: 'peach_brush', name: 'Peach/brush', startDays: 0, endDays: 0, active: true },
  { id: 'cpb', name: 'CPB', startDays: 12, endDays: 9, active: true },
  { id: 'singeing', name: 'Singeing', startDays: 7, endDays: 7, active: true },
  { id: 'subcontract', name: 'Subcontract', startDays: 0, endDays: 0, active: true },
  { id: 'yd_pre', name: 'YD Pre', startDays: 6, endDays: 4, active: true },
  { id: 'yd_post', name: 'YD Post', startDays: 6, endDays: 4, active: true },
  { id: 'mercerized', name: 'Mercerized', startDays: 11, endDays: 9, active: true },
  { id: 'semibleach', name: 'Semibleach', startDays: 6, endDays: 5, active: true },
];
const crit = (id: string, name: string, startDays: number, endDays: number, active = true): PlanCheck => ({ id, name, startDays, endDays, active });

/** The user's example order: T&A Knitting 2 to 21 October 2026. */
const ORDER = {
  yarnDate: '2026-09-28',
  knitStart: '2026-10-02',
  knitEnd: '2026-10-21',
  dyeStart: '2026-10-15',
  dyeEnd: '2026-10-30',
  deliStart: '2026-11-02',
  deliEnd: '2026-11-12',
};

describe.each(ZONES)('the Planning Guide helpers with TZ=$tz', ({ tz, offsets }) => {
  let original: string | undefined;
  beforeAll(() => {
    original = process.env.TZ;
    process.env.TZ = tz;
  });
  afterAll(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it('runs in that time zone', () => {
    expect([new Date(2026, 0, 15).getTimezoneOffset(), new Date(2026, 6, 15).getTimezoneOffset()]).toEqual(offsets);
  });

  it('addDaysIso adds calendar days (SPEC cases, month and year ends, leap years)', () => {
    expect(addDaysIso('2026-10-02', 10)).toBe('2026-10-12');
    expect(addDaysIso('2026-10-21', 7)).toBe('2026-10-28');
    expect(addDaysIso('2026-12-28', 10)).toBe('2027-01-07');
    expect(addDaysIso('2028-02-25', 5)).toBe('2028-03-01');
    expect(addDaysIso('2026-02-25', 5)).toBe('2026-03-02');
    expect(addDaysIso('2026-10-12', 0)).toBe('2026-10-12');
    expect(addDaysIso('2026-01-05', -7)).toBe('2025-12-29');
  });

  it('addDaysIso is not moved by daylight-saving changes', () => {
    expect(addDaysIso('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDaysIso('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDaysIso('2026-03-01', 10)).toBe('2026-03-11');
    expect(addDaysIso('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysIso('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDaysIso('2026-10-25', 12)).toBe('2026-11-06');
  });

  it("never shifts a value that is not a date ('TBA', '-', '2026-02-30', ...)", () => {
    for (const bad of ['', 'TBA', '-', 'N/A', '2026-02-30', '46297', '10/02/2026', ' 2026-10-02']) {
      expect(addDaysIso(bad, 10), bad).toBe('');
    }
    expect(addDaysIso('2026-10-02', Number.NaN)).toBe('2026-10-02');
  });

  it("toIsoDay keeps real 'YYYY-MM-DD' days only", () => {
    expect(toIsoDay('2026-10-02')).toBe('2026-10-02');
    expect(toIsoDay('2028-02-29')).toBe('2028-02-29');
    expect(toIsoDay('2026-02-30')).toBe('');
    expect(toIsoDay('2026-02-29')).toBe('');
    expect(toIsoDay('2026-13-01')).toBe('');
    for (const bad of ['', '-', 'N/A', 'TBA', '—', '10/02/2026', '02-Oct-2026', '2026-10-02T00:00:00Z', ' 2026-10-02']) {
      expect(toIsoDay(bad), bad).toBe('');
    }
    for (const bad of [null, undefined, true, {}, [], new Date('2026-10-02')]) {
      expect(toIsoDay(bad)).toBe('');
    }
    expect(isIsoDay('2026-10-02')).toBe(true);
    expect(isIsoDay('2026-02-30')).toBe(false);
    expect(isIsoDay('46297')).toBe(false);
  });

  it('toIsoDay converts Excel serials above 25000 and below 70000, as the uploads do', () => {
    expect(toIsoDay(46297)).toBe('2026-10-02');
    expect(toIsoDay('46297')).toBe('2026-10-02');
    expect(toIsoDay(46297.75)).toBe('2026-10-02');
    expect(toIsoDay(45658)).toBe('2025-01-01');
    expect(toIsoDay(25001)).toBe('1968-06-12');
    expect(toIsoDay(69999)).toBe('2091-08-24');
    for (const bad of [25000, 70000, '25000', '70000', 24999, 70001, 45, '45', Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(toIsoDay(bad), String(bad)).toBe('');
    }
  });

  it("gives the user's example: T&A 2026-10-02..2026-10-21 + Heatset (10/7) = 2026-10-12..2026-10-28", () => {
    const lead = computeLead(D9, ['heatset']);
    expect(lead).toEqual({
      startDays: 10,
      endDays: 7,
      startFrom: ['Heatset'],
      endFrom: ['Heatset'],
      startFromIds: ['heatset'],
      endFromIds: ['heatset'],
    });
    expect(computeGuideDefaults(ORDER, lead)).toEqual({
      ydStart: '2026-09-28',
      ydEnd: '',
      knitStart: '2026-10-12',
      knitEnd: '2026-10-28',
      dyeStart: '2026-10-15',
      dyeEnd: '2026-10-30',
      floorStart: '2026-11-02',
      floorEnd: '2026-11-12',
      lockStart: '',
      lockEnd: '',
    });
  });

  it('computeGuideDefaults leaves invalid T&A blank and unshifted, and reads Excel serials', () => {
    const dates = computeGuideDefaults({ ...ORDER, knitStart: 'TBA', knitEnd: '-', dyeStart: 46297, deliEnd: 'N/A' }, { startDays: 10, endDays: 7 });
    expect(dates.knitStart).toBe('');
    expect(dates.knitEnd).toBe('');
    expect(dates.dyeStart).toBe('2026-10-02');
    expect(dates.floorEnd).toBe('');
    expect(computeGuideDefaults(null)).toEqual(Object.fromEntries(GUIDE_DATE_KEYS.map((key) => [key, ''])));
  });
});

describe('computeLead: per-column maxima of the Yes AND Active criteria (SPEC D10)', () => {
  it('no Yes criteria: 0/0 with no holders', () => {
    expect(computeLead(D9, [])).toEqual({ startDays: 0, endDays: 0, startFrom: [], endFrom: [], startFromIds: [], endFromIds: [] });
    expect(computeLead(null, ['heatset'])).toMatchObject({ startDays: 0, endDays: 0 });
  });

  it('A 10/3 + B 8/7 gives +10 / +7: start from A, end from B (never the single largest criterion)', () => {
    const lead = computeLead([crit('a', 'A', 10, 3), crit('b', 'B', 8, 7)], ['a', 'b']);
    expect(lead).toEqual({ startDays: 10, endDays: 7, startFrom: ['A'], endFrom: ['B'], startFromIds: ['a'], endFromIds: ['b'] });
  });

  it('Heatset 10/7 + CPB 12/9 gives 12/9; ties name every holder in Plan Check List order', () => {
    expect(computeLead(D9, ['heatset', 'cpb'])).toMatchObject({ startDays: 12, endDays: 9, startFrom: ['CPB'], endFrom: ['CPB'] });
    expect(computeLead(D9, ['singeing', 'heatset'])).toEqual({
      startDays: 10,
      endDays: 7,
      startFrom: ['Heatset'],
      endFrom: ['Heatset', 'Singeing'],
      startFromIds: ['heatset'],
      endFromIds: ['heatset', 'singeing'],
    });
  });

  it('inactive and unknown ids are ignored', () => {
    const list = [crit('a', 'A', 20, 20, false), crit('b', 'B', 5, 2)];
    expect(computeLead(list, ['a', 'b', 'gone'])).toEqual({
      startDays: 5,
      endDays: 2,
      startFrom: ['B'],
      endFrom: ['B'],
      startFromIds: ['b'],
      endFromIds: ['b'],
    });
  });
});

describe('guideRowsChanged', () => {
  it('names the rows whose Start or End differs, in guide order', () => {
    const stored = computeGuideDefaults(ORDER, { startDays: 10, endDays: 7 });
    expect(guideRowsChanged(stored, stored)).toEqual([]);
    expect(guideRowsChanged(stored, computeGuideDefaults(ORDER, { startDays: 12, endDays: 7 }))).toEqual(['knit']);
    expect(guideRowsChanged({ ...stored, lockEnd: '2026-11-20', ydStart: '' }, stored)).toEqual(['yd', 'lock']);
    expect(guideRowsChanged(null, { lockStart: '' })).toEqual([]);
  });
});
