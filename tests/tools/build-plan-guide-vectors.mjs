// Writes tests/fixtures/plan-guide-vectors.json: inputs and the outputs the SERVER's own Planning Guide functions
// (Next Planning V3 Server, src/utils/plan-guide-dates.ts) give for them. tests/plan-guide/plan-guide-vectors.test.ts
// then requires the client copy (src/features/planning/lib/plan-guide.ts) to give exactly the same outputs.
//
// Run from the client repo root, after a change to the server file:
//   node tests/tools/build-plan-guide-vectors.mjs ["<path of the Next Planning V3 Server repo>"]
// The server path defaults to the sibling folder "../Next Planning V3 Server". Node 24 imports the server's .ts file
// directly (built-in type stripping); nothing in the server repo is written, and no database is used.
//
// Every input is generated here from a fixed seed (synthetic, no real data), so running it again gives the same file.
// The server file must be committed: the JSON records its git blob and the last commit that changed it.
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SERVER_FILE = 'src/utils/plan-guide-dates.ts';
const OUT = join(process.cwd(), 'tests', 'fixtures', 'plan-guide-vectors.json');
const SEED = 20261121;

const serverDir = resolve(process.argv[2] || join(process.cwd(), '..', 'Next Planning V3 Server'));
const serverFile = join(serverDir, SERVER_FILE);
if (!existsSync(serverFile)) {
  console.error(`Server file not found: ${serverFile}\nPass the server repo path: node tests/tools/build-plan-guide-vectors.mjs "<server repo>"`);
  process.exit(1);
}

const git = (...args) => execFileSync('git', ['-C', serverDir, ...args], { encoding: 'utf8' }).trim();
const blob = git('hash-object', SERVER_FILE);
const lastCommit = git('log', '-1', '--format=%H', '--', SERVER_FILE);
if (git('rev-parse', `HEAD:${SERVER_FILE}`) !== blob) {
  console.error(`${SERVER_FILE} has uncommitted changes in ${serverDir}. Commit them first, so the vectors name the code they come from.`);
  process.exit(1);
}

const server = await import(pathToFileURL(serverFile).href);

/* ---------- JSON encoding of values JSON cannot hold (the test decodes them the same way) ---------- */
// undefined, NaN, ±Infinity and -0 become {"$": "<name>"}; a Date becomes {"$date": "<ISO time>"}.
function encode(value) {
  if (value === undefined) return { $: 'undefined' };
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { $: 'NaN' };
    if (value === Infinity) return { $: 'Infinity' };
    if (value === -Infinity) return { $: '-Infinity' };
    if (Object.is(value, -0)) return { $: '-0' };
    return value;
  }
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}

/* ---------- a seeded random source (mulberry32) ---------- */
let state = SEED >>> 0;
function random() {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (list) => list[int(0, list.length - 1)];
const chance = (p) => random() < p;
const pad = (n, width) => String(n).padStart(width, '0');

function randomIsoDay(fromYear = 1900, toYear = 2200) {
  const year = int(fromYear, toYear);
  const month = int(1, 12);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(int(1, days), 2)}`;
}
// Mostly real days; also day 0, day 29-31 of short months and months 0 and 13.
const randomIsoLike = () => `${pad(int(1890, 2210), 4)}-${pad(int(0, 13), 2)}-${pad(int(0, 32), 2)}`;
function randomSerial() {
  const whole = int(24990, 70010);
  const kind = int(0, 3);
  if (kind === 0) return whole;
  if (kind === 1) return whole + 0.5;
  if (kind === 2) return whole + int(1, 999999) / 1000000;
  return whole + pick([0.25, 0.75, 0.999, 0.0001]);
}
const JUNK_CHARS = '0123456789-/. :TZabNA';
const randomJunk = () => Array.from({ length: int(1, 12) }, () => pick(JUNK_CHARS)).join('');

/* ---------- inputs ---------- */
const DATE_TEXT = [
  '', ' ', '-', '—', 'N/A', 'n/a', 'TBA', 'TBC', 'undefined', 'null', 'NaN', 'Infinity', '-Infinity',
  '2026-10-02', '2026-10-21', '2026-02-28', '2026-02-29', '2028-02-29', '2100-02-29', '2000-02-29', '1900-02-29',
  '0000-01-01', '0001-01-01', '0099-12-31', '0100-01-01', '1969-12-31', '1970-01-01', '9999-12-31',
  '2026-13-01', '2026-00-10', '2026-10-00', '2026-10-32', '2026-04-31', '2026-06-31', '2026-09-31', '2026-11-31',
  '2026-1-2', '2026-01-2', '26-10-02', '+2026-10-02', '2026-10-02 ', ' 2026-10-02', '2026-10-02\n',
  '2026-10-02T00:00:00Z', '2026-10-02T00:00:00.000Z', '2026/10/02', '10/02/2026', '02-Oct-2026', '2-Oct-26',
  'Oct 2, 2026', '20261002', '２０２６-１０-０２', '٢٠٢٦-١٠-٠٢',
  '46297', '46297.0', '46297.5', '46297.75', '46297.99999', '046297', '+46297', '-46297', '46297e0', '4.6297e4',
  '0x B4E9', '25000', '25000.0', '25000.0001', '25001', '25569', '69999', '69999.999', '70000', '70000.0', '70001',
  '24999', '1', '0', '45', '100000', '1e5', '.5', '5.', '46297.', ' 46297', '46297 ', '46,297', '45658',
];
const SPECIAL_NUMBERS = [
  0, -0, 1, 45, 24999, 24999.99, 25000, 25000.25, 25000.5, 25001, 25569, 45658, 46297, 46297.25, 46297.5, 46297.75,
  46297.99999, 69999, 69999.5, 69999.99, 70000, 70000.01, 70001, -46297, NaN, Infinity, -Infinity,
  Number.MAX_VALUE, Number.MIN_VALUE, Number.EPSILON, Number.MAX_SAFE_INTEGER,
];
const OTHER_VALUES = [null, undefined, true, false, {}, [], ['2026-10-02'], { value: '2026-10-02' }, new Date('2026-10-02T00:00:00.000Z')];

function dayInputs() {
  const inputs = [...DATE_TEXT, ...SPECIAL_NUMBERS, ...OTHER_VALUES];
  for (let i = 0; i < 400; i++) inputs.push(randomIsoDay(1800, 2300));
  for (let i = 0; i < 250; i++) inputs.push(randomIsoLike());
  for (let i = 0; i < 300; i++) inputs.push(randomSerial());
  for (let i = 0; i < 200; i++) inputs.push(String(randomSerial()));
  for (let i = 0; i < 120; i++) inputs.push(randomJunk());
  return inputs;
}

const SHIFT_DAYS = [
  0, -0, 1, -1, 5, 7, 10, 12, 30, 31, 365, 366, -365, 1000, -1000, 2.7, -2.7, 0.5, -0.5, NaN, Infinity, -Infinity,
  1e7, -1e7, 1e9, Number.MAX_SAFE_INTEGER, '5', null, undefined, true,
];
const SHIFT_DAYS_FROM = [
  '2026-10-02', '2026-10-21', '2026-12-28', '2028-02-25', '2026-02-25', '2026-03-07', '2026-03-08', '2026-03-28',
  '2026-03-29', '2026-10-24', '2026-10-25', '2026-10-31', '2026-11-01', '2028-02-29', '2100-02-28', '1970-01-01',
  '0100-01-01', '9999-12-31', '', 'TBA', '-', '2026-02-30', '46297', ' 2026-10-02', '0000-01-01', '0099-12-31',
];

function shiftInputs() {
  const inputs = [];
  for (const from of SHIFT_DAYS_FROM) for (const days of SHIFT_DAYS) inputs.push([from, days]);
  for (let i = 0; i < 900; i++) {
    const days = chance(0.85) ? int(-800, 800) : pick([int(-20, 20) + pick([0.1, 0.5, 0.9, -0.5]), pick(SHIFT_DAYS)]);
    inputs.push([chance(0.92) ? randomIsoDay() : pick([randomIsoLike(), randomJunk(), String(randomSerial())]), days]);
  }
  return inputs;
}

const D9 = [
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
const crit = (id, startDays, endDays, active = true, name = id.toUpperCase()) => ({ id, name, startDays, endDays, active });
const ID_POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'heatset', 'cpb', 'singeing', 'chk_0001', 'chk_0002', 'x y', '', 'A'];
const NAME_POOL = ['A', 'B', 'Heatset', 'CPB', 'Peach/brush', 'Singeing', 'New one', '', 'a  b'];
const ODD_DAYS = [-3, 2.9, -0.5, '10', '', null, undefined, NaN, Infinity, -Infinity, 400, 1e9, true];
const ODD_ACTIVE = ['true', 1, 'yes', null, undefined];

function leadInputs() {
  const inputs = [
    [null, null], [undefined, undefined], [[], []], [D9, null], [null, ['heatset']], [D9, 'heatset'], [{}, ['heatset']],
    [D9, []], [D9, ['heatset']], [D9, ['heatset', 'cpb']], [D9, ['cpb', 'heatset']], [D9, ['heatset', 'singeing']],
    [D9, ['peach_brush']], [D9, ['peach_brush', 'subcontract']], [D9, ['yd_pre', 'yd_post']], [D9, ['semibleach', 'singeing']],
    [D9, D9.map((c) => c.id)], [D9, ['heatset', 'heatset']], [D9, ['nope', 'heatset']], [D9, ['nope']],
    [[crit('a', 10, 3, true, 'A'), crit('b', 8, 7, true, 'B')], ['a', 'b']],
    [[crit('a', 10, 3, true, 'A'), crit('b', 8, 7, true, 'B')], ['b', 'a']],
    [[crit('a', 10, 3, true, 'A'), crit('b', 8, 7, false, 'B')], ['a', 'b']],
    [[crit('a', 10, 3, false, 'A'), crit('b', 8, 7, true, 'B')], ['a', 'b']],
    [[crit('a', 10, 7), crit('b', 10, 7), crit('c', 10, 7)], ['c', 'a', 'b']],
    [[crit('a', 5, 5), crit('a', 9, 1)], ['a']],
    [[null, crit('a', 4, 2), 7, 'a', crit('b', 6, 6)], ['a', 'b']],
    [[crit('a', 0, 0), crit('b', 0, 0)], ['a', 'b']],
    [[{ id: 'a', name: 5, startDays: 3, endDays: 2, active: true }, { id: 'b', startDays: 3, endDays: 2, active: true }], ['a', 'b']],
    [[{ id: 7, name: 'Seven', startDays: 3, endDays: 2, active: true }], [7]],
  ];
  for (const odd of ODD_DAYS) inputs.push([[crit('a', odd, 4), crit('b', 2, odd)], ['a', 'b']]);
  for (const odd of ODD_ACTIVE) inputs.push([[crit('a', 9, 9, odd), crit('b', 3, 3)], ['a', 'b']]);
  for (let i = 0; i < 300; i++) {
    const checks = Array.from({ length: int(0, 8) }, () => {
      if (chance(0.03)) return pick([null, 'a', 3]);
      return {
        id: pick(ID_POOL),
        name: chance(0.97) ? pick(NAME_POOL) : pick([undefined, null, 4]),
        startDays: chance(0.92) ? int(0, 15) : pick(ODD_DAYS),
        endDays: chance(0.92) ? int(0, 15) : pick(ODD_DAYS),
        active: chance(0.8) ? true : chance(0.7) ? false : pick(ODD_ACTIVE),
      };
    });
    // Mostly ids of the list itself, so most cases have Yes criteria; some unknown ids and repeats.
    const listIds = checks.filter((check) => check && typeof check === 'object').map((check) => check.id);
    const yes = Array.from({ length: int(0, 6) }, () =>
      listIds.length > 0 && chance(0.75) ? pick(listIds) : chance(0.8) ? pick(ID_POOL) : pick(['zz', 'unknown'])
    );
    inputs.push([checks, chance(0.04) ? pick([null, undefined, 'a']) : yes]);
  }
  return inputs;
}

const TNA_KEYS = ['yarnDate', 'knitStart', 'knitEnd', 'dyeStart', 'dyeEnd', 'deliStart', 'deliEnd'];
const EXAMPLE = {
  yarnDate: '2026-09-28',
  knitStart: '2026-10-02',
  knitEnd: '2026-10-21',
  dyeStart: '2026-10-15',
  dyeEnd: '2026-10-30',
  deliStart: '2026-11-02',
  deliEnd: '2026-11-12',
};
function randomTnaValue() {
  const kind = int(0, 9);
  if (kind <= 3) return randomIsoDay(2024, 2029);
  if (kind === 4) return Math.round(randomSerial());
  if (kind === 5) return String(Math.round(randomSerial()));
  if (kind === 6) return pick(['', '-', 'N/A', 'TBA', '—', '10/02/2026', '2026-02-30']);
  if (kind === 7) return pick([null, undefined, 46297.75, '46297.5']);
  if (kind === 8) return randomIsoLike();
  return randomJunk();
}
function randomLead() {
  const kind = int(0, 9);
  if (kind === 0) return pick([null, undefined, {}]);
  if (kind === 1) return { startDays: pick(ODD_DAYS), endDays: pick(ODD_DAYS) };
  if (kind === 2) return { startDays: int(0, 15) };
  return { startDays: int(0, 15), endDays: int(0, 15) };
}

function defaultsInputs() {
  const inputs = [
    [EXAMPLE, { startDays: 10, endDays: 7 }],
    [EXAMPLE, server.computeLead(D9, ['heatset'])],
    [EXAMPLE, server.computeLead(D9, ['heatset', 'cpb'])],
    [EXAMPLE, { startDays: 0, endDays: 0 }],
    [EXAMPLE, null],
    [EXAMPLE, undefined],
    [EXAMPLE, {}],
    [{ ...EXAMPLE, knitStart: '2026-10-02', knitEnd: '2026-10-03' }, { startDays: 10, endDays: 7 }],
    [{ ...EXAMPLE, knitStart: 'TBA', knitEnd: '-' }, { startDays: 10, endDays: 7 }],
    [{ ...EXAMPLE, knitStart: 46297, knitEnd: '46316' }, { startDays: 10, endDays: 7 }],
    [{ ...EXAMPLE, knitStart: '2026-12-28' }, { startDays: 10, endDays: 7 }],
    [null, { startDays: 10, endDays: 7 }],
    [undefined, undefined],
    [{}, { startDays: 5, endDays: 5 }],
    [Object.fromEntries(TNA_KEYS.map((key) => [key, 'N/A'])), { startDays: 3, endDays: 3 }],
  ];
  for (const odd of ODD_DAYS) inputs.push([EXAMPLE, { startDays: odd, endDays: odd }]);
  for (let i = 0; i < 250; i++) {
    const order = {};
    for (const key of TNA_KEYS) if (chance(0.9)) order[key] = randomTnaValue();
    if (chance(0.1)) order.orderNo = `V3T-${int(1, 999)}`;
    inputs.push([order, randomLead()]);
  }
  return inputs;
}

const DATE_KEYS = ['ydStart', 'ydEnd', 'knitStart', 'knitEnd', 'dyeStart', 'dyeEnd', 'floorStart', 'floorEnd', 'lockStart', 'lockEnd'];
function randomDates() {
  return Object.fromEntries(DATE_KEYS.map((key) => [key, chance(0.75) ? randomIsoDay(2026, 2027) : '']));
}
function mutate(dates) {
  const copy = { ...dates };
  for (const key of DATE_KEYS) {
    if (!chance(0.12)) continue;
    const kind = int(0, 5);
    if (kind === 0) copy[key] = randomIsoDay(2026, 2027);
    else if (kind === 1) copy[key] = '';
    else if (kind === 2) delete copy[key];
    else if (kind === 3) copy[key] = pick([null, undefined, 46297, 0]);
    else if (kind === 4) copy[key] = server.addDaysIso(copy[key] || '2026-10-02', int(-3, 3));
    else copy[key] = ` ${copy[key] || ''}`;
  }
  return copy;
}

function rowsInputs() {
  const base = server.computeGuideDefaults(EXAMPLE, { startDays: 10, endDays: 7 });
  const inputs = [
    [null, null], [undefined, undefined], [{}, {}], [base, base], [base, null], [null, base], [{}, base],
    [base, { ...base }], [base, server.computeGuideDefaults(EXAMPLE, { startDays: 12, endDays: 9 })],
    [base, server.computeGuideDefaults(EXAMPLE, { startDays: 10, endDays: 9 })],
    [base, server.computeGuideDefaults({ ...EXAMPLE, yarnDate: '2026-09-29' }, { startDays: 10, endDays: 7 })],
    [{ ...base, lockStart: '2026-11-20' }, base],
    [{ ...base, ydEnd: '2026-10-01' }, base],
    [{ ...base, floorEnd: 46297 }, { ...base, floorEnd: '' }],
    [{ ...base, dyeStart: null }, { ...base, dyeStart: '' }],
    [{ ...base, dyeStart: undefined }, { ...base, dyeStart: '' }],
  ];
  for (const key of DATE_KEYS) {
    inputs.push([base, { ...base, [key]: '' }]);
    const without = { ...base };
    delete without[key];
    inputs.push([without, base]);
  }
  for (let i = 0; i < 250; i++) {
    const dates = randomDates();
    inputs.push(chance(0.5) ? [dates, mutate(dates)] : [mutate(dates), dates]);
  }
  return inputs;
}

/* ---------- run the server's functions ---------- */
const toIsoDay = dayInputs().map((value) => [value, server.toIsoDay(value), server.isIsoDay(value)]);
const addDaysIso = shiftInputs().map(([iso, days]) => [iso, days, server.addDaysIso(iso, days)]);
const computeLead = leadInputs().map(([checks, yesIds]) => [checks, yesIds, server.computeLead(checks, yesIds)]);
const computeGuideDefaults = defaultsInputs().map(([order, lead]) => [order, lead, server.computeGuideDefaults(order, lead)]);
const guideRowsChanged = rowsInputs().map(([stored, live]) => [stored, live, server.guideRowsChanged(stored, live)]);

const sections = { toIsoDay, addDaysIso, computeLead, computeGuideDefaults, guideRowsChanged };
const head = {
  about:
    'Inputs and the outputs of the Next Planning V3 Server functions in src/utils/plan-guide-dates.ts. Generated by ' +
    'tests/tools/build-plan-guide-vectors.mjs (synthetic inputs, fixed seed); checked against the client copy by ' +
    'tests/plan-guide/plan-guide-vectors.test.ts. Rows: toIsoDay [value, toIsoDay, isIsoDay]; addDaysIso [iso, days, ' +
    'result]; computeLead [checks, yesIds, lead]; computeGuideDefaults [order, lead, dates]; guideRowsChanged ' +
    '[stored, live, rows]. {"$": name} stands for undefined, NaN, Infinity, -Infinity or -0, and {"$date": iso} for a Date.',
  source: { repo: 'Next Planning V3 Server', file: SERVER_FILE, blob, lastCommit },
  seed: SEED,
  counts: Object.fromEntries(Object.entries(sections).map(([name, rows]) => [name, rows.length])),
  constants: { GUIDE_ROWS: server.GUIDE_ROWS, GUIDE_DATE_KEYS: server.GUIDE_DATE_KEYS, TNA_KEYS: server.TNA_KEYS },
};

// One vector per line, so a change shows up as a readable diff.
const lines = ['{'];
for (const [key, value] of Object.entries(head)) lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
const names = Object.keys(sections);
names.forEach((name, index) => {
  lines.push(`  ${JSON.stringify(name)}: [`);
  const rows = sections[name].map((row) => `    ${JSON.stringify(encode(row))}`);
  lines.push(rows.join(',\n'));
  lines.push(index === names.length - 1 ? '  ]' : '  ],');
});
lines.push('}');
writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(`Wrote ${OUT}`);
console.log(`From ${SERVER_FILE} blob ${blob} (last commit ${lastCommit.slice(0, 7)}): ${JSON.stringify(head.counts)}`);
