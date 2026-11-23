import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as guide from '@/features/planning/guide/lib/plan-guide';

/*
 * Parity of the client's Planning Guide rules (src/features/planning/lib/plan-guide.ts) with the server's
 * (Next Planning V3 Server, src/utils/plan-guide-dates.ts): tests/fixtures/plan-guide-vectors.json holds thousands of
 * generated inputs with the outputs the SERVER's functions gave (tests/tools/build-plan-guide-vectors.mjs), and the
 * client copy must give exactly the same output for every one of them, in three time zones.
 */

type Vectors = {
  source: { file: string; blob: string; lastCommit: string };
  counts: Record<string, number>;
  constants: { GUIDE_ROWS: string[]; GUIDE_DATE_KEYS: string[]; TNA_KEYS: string[] };
  toIsoDay: unknown[][];
  addDaysIso: unknown[][];
  computeLead: unknown[][];
  computeGuideDefaults: unknown[][];
  guideRowsChanged: unknown[][];
};

const SPECIAL: Record<string, unknown> = { undefined, NaN, Infinity, '-Infinity': -Infinity, '-0': -0 };

/** Undoes the generator's encoding: {"$": name} for undefined, NaN, ±Infinity and -0, {"$date": iso} for a Date. */
function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    const record = value as Record<string, unknown>;
    if (keys.length === 1 && keys[0] === '$') {
      const name = String(record.$);
      if (!(name in SPECIAL)) throw new Error(`Unknown special value ${name}`);
      return SPECIAL[name];
    }
    if (keys.length === 1 && keys[0] === '$date') return new Date(String(record.$date));
    return Object.fromEntries(keys.map((key) => [key, decode(record[key])]));
  }
  return value;
}

// Vitest runs from the project root (vitest.config.ts); import.meta.url is not a file: URL under jsdom.
const vectors = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'plan-guide-vectors.json'), 'utf8')) as Vectors;

type Run = (input: unknown[]) => unknown;
const SECTIONS: Array<{ name: keyof Vectors & string; inputs: number; run: Run }> = [
  { name: 'toIsoDay', inputs: 1, run: ([value]) => [guide.toIsoDay(value), guide.isIsoDay(value)] },
  { name: 'addDaysIso', inputs: 2, run: ([iso, days]) => guide.addDaysIso(iso as string, days as number) },
  { name: 'computeLead', inputs: 2, run: ([checks, yesIds]) => guide.computeLead(checks as guide.PlanCheck[], yesIds as string[]) },
  {
    name: 'computeGuideDefaults',
    inputs: 2,
    run: ([order, lead]) => guide.computeGuideDefaults(order as Record<string, unknown>, lead as guide.GuideLead),
  },
  {
    name: 'guideRowsChanged',
    inputs: 2,
    run: ([stored, live]) => guide.guideRowsChanged(stored as guide.GuideDates, live as guide.GuideDates),
  },
];

/** Every vector of a section whose client output differs from the server's (at most 5, with the input). */
function mismatches(section: (typeof SECTIONS)[number]): string[] {
  const found: string[] = [];
  for (const row of vectors[section.name] as unknown[][]) {
    const decoded = decode(row) as unknown[];
    const input = decoded.slice(0, section.inputs);
    // toIsoDay rows hold two outputs (toIsoDay and isIsoDay of the same input).
    const expected = section.name === 'toIsoDay' ? decoded.slice(1) : decoded[section.inputs];
    const actual = section.run(input);
    if (!isDeepStrictEqual(actual, expected)) {
      found.push(`${JSON.stringify(row.slice(0, section.inputs))}: server ${JSON.stringify(expected)}, client ${JSON.stringify(actual)}`);
      if (found.length >= 5) break;
    }
  }
  return found;
}

describe('the vectors file', () => {
  it('comes from the server file and has every section in full', () => {
    expect(vectors.source.file).toBe('src/utils/plan-guide-dates.ts');
    expect(vectors.source.blob).toMatch(/^[0-9a-f]{40}$/);
    for (const section of SECTIONS) {
      expect(vectors[section.name], section.name).toHaveLength(vectors.counts[section.name]);
    }
    expect(vectors.toIsoDay.length).toBeGreaterThan(1000);
    expect(vectors.addDaysIso.length).toBeGreaterThan(1000);
    expect(vectors.computeLead.length).toBeGreaterThan(300);
    expect(vectors.computeGuideDefaults.length).toBeGreaterThan(250);
    expect(vectors.guideRowsChanged.length).toBeGreaterThan(250);
  });

  it('has the same rows, date cells and T&A fields as the server', () => {
    expect([...guide.GUIDE_ROWS]).toEqual(vectors.constants.GUIDE_ROWS);
    expect([...guide.GUIDE_DATE_KEYS]).toEqual(vectors.constants.GUIDE_DATE_KEYS);
    expect([...guide.TNA_KEYS]).toEqual(vectors.constants.TNA_KEYS);
  });

  it('decodes the special values', () => {
    expect(decode([{ $: 'undefined' }, { $: 'NaN' }, { $: 'Infinity' }, { $: '-Infinity' }, { $: '-0' }])).toEqual([
      undefined,
      Number.NaN,
      Infinity,
      -Infinity,
      -0,
    ]);
    expect(Object.is(decode({ $: '-0' }), -0)).toBe(true);
    expect(decode({ $date: '2026-10-02T00:00:00.000Z' })).toEqual(new Date('2026-10-02T00:00:00.000Z'));
    expect(decode({ a: [{ $: 'undefined' }], b: 'x' })).toEqual({ a: [undefined], b: 'x' });
  });
});

const ZONES: { tz: string; offsets: [number, number] }[] = [
  { tz: 'UTC', offsets: [0, 0] },
  { tz: 'Asia/Dhaka', offsets: [-360, -360] },
  { tz: 'America/New_York', offsets: [300, 240] }, // daylight saving in July
];

describe.each(ZONES)('the client gives the server outputs for every vector with TZ=$tz', ({ tz, offsets }) => {
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

  it.each(SECTIONS.map((section) => [section.name, section] as const))('%s', (_name, section) => {
    expect(mismatches(section)).toEqual([]);
  });
});
