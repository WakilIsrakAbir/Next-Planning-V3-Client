import type { Expectation, Scenario, Step } from '../harness/types';
import { T } from './scenarios/texts';

/*
 * The 61 rules of the order page (validation inventory, SCRATCH/wf/r2-validation-inventory.md) and how the golden
 * master covers them. tests/golden/RULES.md is generated from this file and the scenario list.
 */

export interface RuleInfo {
  id: string;
  what: string;
  /** Rules the client golden master cannot cover, with the reason. */
  uncovered?: string;
}

// The server rules (SRV-*) are server behaviour, outside the client harness: proving them belongs to the server tests
// (SPEC S1 golden test of save-dates). Each reason says how much of the rule the mocked server (tests/harness/mock-server.ts)
// copies, so nobody mistakes the mock for a proof.
const SERVER_TESTS = 'Proving it belongs to the server tests (SPEC S1).';
const SRV_REASONS: Record<string, string> = {
  'SRV-01': `Server behaviour. The mocked server copies only the two 401 answers (no token; any token other than the test token). Expired sessions, deleted users, inactive accounts (403), \`?token=\` and the 60 s user cache are not modelled. ${SERVER_TESTS}`,
  'SRV-02': `Server behaviour. The mocked server has no buyer filter at all, which matches what the real server does for details and save, but that is not proven here. ${SERVER_TESTS}`,
  'SRV-03': `Server behaviour. The mocked save stores whatever the page sends, as the real server does, so the harness relies on it without proving it. ${SERVER_TESTS}`,
  'SRV-04': `Server behaviour. Ported in the mocked server: \`$set\` of the department array and status, and an upsert with the schema defaults. ${SERVER_TESTS}`,
  'SRV-05': `Server behaviour. Ported in the mocked server (recalcSingleOrder writes \`Order.<dept>PlanStatus\`), but the order page never shows that status. ${SERVER_TESTS}`,
  'SRV-06': `Server behaviour, not modelled: the mocked server has no cache, so every request reads the latest saved data. ${SERVER_TESTS}`,
  'SRV-07': `Server behaviour, not modelled: the mocked server has no rate limit and no body-size limit. ${SERVER_TESTS}`,
  'SRV-08': `Server behaviour. The mocked server answers a save with the real 200 shape \`{message, data}\`; it never produces the 500 error itself (knitting/save17-server-errors scripts the error replies to test the page's handling, SAVE-17). ${SERVER_TESTS}`,
};

export const RULES: RuleInfo[] = [
  { id: 'GATE-01', what: 'Dyeing inputs locked until Unit and Process Name are set' },
  { id: 'GATE-02', what: 'Dyeing locked while the saved Knitting plan type is blank (non-admin, no saved dyeing plan)' },
  { id: 'GATE-03', what: 'Delivery (Floor and main) locked while the saved Dyeing plan type is blank (non-admin)' },
  { id: 'GATE-04', what: 'Delivery main inputs locked while the saved Dyeing start is missing (everyone)' },
  { id: 'GATE-05', what: 'Confirm rows locked for non-admins (live value; never on YD, Finishing or Delivery Floor)' },
  { id: 'GATE-06', what: 'General Information and upstream plan columns are read-only' },
  { id: 'GATE-07', what: 'Save buttons disabled only while saving; any role saves; Back/Cancel leave without asking' },
  { id: 'GATE-08', what: 'Date input min attributes (picker limit only)' },
  { id: 'CAS-01', what: 'Row 1 changes are copied into every row' },
  { id: 'AUTO-01', what: 'Knitting Yarn Date pushes Start/End forward' },
  { id: 'AUTO-02', what: 'Clearing a Knitting Yarn Date drops Confirm' },
  { id: 'AUTO-03', what: 'A Start change moves an earlier End up to it' },
  { id: 'AUTO-04', what: 'YD Floor dates follow Start/End minus 4 days' },
  { id: 'AUTO-05', what: 'A date change that breaks the plan-type rules clears the plan type' },
  { id: 'AUTO-06', what: 'Row 1 plan type copied to the rows where it is valid' },
  { id: 'AUTO-07', what: 'Delivery Floor defaults from the saved Dyeing plan (+7 days, Tentative)' },
  { id: 'AUTO-08', what: 'YD Floor defaults (plan dates minus 4 days) on load' },
  { id: 'AUTO-09', what: 'Unit / Process Name defaults, dropdown lists and their copy into itemData' },
  { id: 'AUTO-10', what: 'YD Barrier / Workable Qty. kept as typed, per row' },
  { id: 'CHG-01', what: 'Start after End refused on change' },
  { id: 'CHG-02', what: 'End before Start refused on change' },
  { id: 'CHG-03', what: 'Dyeing dates refused while the Knitting plan is blank' },
  { id: 'CHG-04', what: 'Dyeing Start before Knitting Start refused' },
  { id: 'CHG-05', what: 'Dyeing End before Knitting End refused' },
  { id: 'CHG-06', what: 'Plan type needs both dates' },
  { id: 'CHG-07', what: 'Knitting Confirm needs a Yarn Date' },
  { id: 'CHG-08', what: 'Dyeing plan type refused while the Knitting plan is blank' },
  { id: 'CHG-09', what: 'Dyeing Confirm refused while Knitting is Tentative' },
  { id: 'CHG-10', what: "Dyeing Confirm refused while Final Confirmation is 'No'" },
  { id: 'CHG-11', what: 'Delivery Confirm refused while Dyeing is Tentative or blank' },
  { id: 'SAVE-00', what: 'No rows: nothing to save' },
  { id: 'SAVE-01', what: 'Only Admin may change a saved Confirm (exact itemId)' },
  { id: 'SAVE-02', what: 'Non-admin may not change a row whose next department is Confirm (exact itemId)' },
  { id: 'SAVE-03', what: 'End before Start refused at save' },
  { id: 'SAVE-04', what: 'Floor End before Floor Start refused at save' },
  { id: 'SAVE-05', what: 'Plan type without both dates refused at save' },
  { id: 'SAVE-06', what: 'Knitting Confirm without Yarn Date refused at save' },
  { id: 'SAVE-07', what: 'Knitting Start before Yarn Date refused at save' },
  { id: 'SAVE-08', what: 'Dyeing input with a blank Knitting type refused at save' },
  { id: 'SAVE-09', what: 'Dyeing Start before Knitting Start refused at save' },
  { id: 'SAVE-10', what: 'Dyeing End before Knitting End refused at save' },
  { id: 'SAVE-11', what: 'Delivery input with a blank Dyeing type refused at save' },
  { id: 'SAVE-12', what: 'Delivery input with a missing Dyeing start refused at save' },
  { id: 'SAVE-13', what: 'Delivery Start before Dyeing Start refused at save' },
  { id: 'SAVE-14', what: 'Delivery End before Dyeing End refused at save' },
  { id: 'SAVE-15', what: 'Completed asks for confirmation; Cancel restores the saved status' },
  { id: 'SAVE-16', what: 'Request body of the save' },
  { id: 'SAVE-17', what: 'Save response handling (success toast and refetch, error toasts)' },
  { id: 'SRV-01', what: 'Login token required (401/403)', uncovered: SRV_REASONS['SRV-01'] },
  { id: 'SRV-02', what: 'Buyer scope not applied to details or save', uncovered: SRV_REASONS['SRV-02'] },
  { id: 'SRV-03', what: 'The server checks no plan rule', uncovered: SRV_REASONS['SRV-03'] },
  { id: 'SRV-04', what: 'save-dates replaces the department array ($set, upsert)', uncovered: SRV_REASONS['SRV-04'] },
  { id: 'SRV-05', what: 'Plan status recalculated after a save', uncovered: SRV_REASONS['SRV-05'] },
  { id: 'SRV-06', what: 'Server caches cleared after a save (per instance)', uncovered: SRV_REASONS['SRV-06'] },
  { id: 'SRV-07', what: 'Rate limit and body size limit', uncovered: SRV_REASONS['SRV-07'] },
  { id: 'SRV-08', what: 'save-dates response and error shape', uncovered: SRV_REASONS['SRV-08'] },
  { id: 'MATCH-01', what: 'itemId = Excel itemId, else the generated id per department' },
  { id: 'MATCH-02', what: 'Saved-row lookup fallbacks (generated id, trailing _ / _n/a, colour, YDB)' },
  { id: 'MATCH-03', what: 'Upstream Knitting / Dyeing row for a Dyeing / Delivery row' },
  { id: 'MATCH-04', what: 'SAVE-01 and SAVE-02 use the exact itemId only' },
  { id: 'STAT-01', what: 'Order Status select (per department, sent with every save, Completed not locked)' },
];

/** Notes on covered rules: branches that cannot be reached from the UI, and which scenario covers which branch. */
export const RULE_NOTES: Record<string, string> = {
  'GATE-03':
    "A saved Delivery plan keeps the row editable for non-admins, and any ONE of Floor plan type, Floor start, plan type or start counts as saved: `delivery/gate03-saved-plan-exemption` (deli-saved-plan) saves each of the four alone on its own row, next to a row without a saved plan. A Dyeing plan type of '-' counts as blank (`delivery/legacy-dash-dyeing-plan`).",
  'GATE-04': "A Dyeing start of '-' counts as missing (`delivery/legacy-dash-dyeing-plan`, row 1, Admin).",
  'GATE-06':
    "The YD 'Knit Plan' columns show the same blank mark for a blank, '-' or 'N/A' T&A Knit date (formatExcelDate), so the '-' / 'N/A' filter in ydKnitPlan has no visible effect today.",
  'CHG-07': "A Yarn Date of '-' or 'N/A' (saved by older code) counts as none (`knitting/chg07-legacy-yarn-placeholders`).",
  'AUTO-10':
    "Older saves: a top-level barrierQty is shown and copied into itemData at save; a saved itemData without 'Barrier Qty.' leaves the input empty while the save still sends the Excel value (`yd/auto10-legacy-barrier-qty`). A saved 'Workable Qty.' of 0 or '' (no top-level workableQty) is shown, and the save copies it into itemData over the Excel value (`yd/auto10-legacy-workable-qty`).",
  'MATCH-01':
    "The `item_${idx}` fallback is unreachable: generateItemId always returns a non-empty id (getColData returns '' for missing columns, so even an empty row gives '<order>_..._'). The 'N/A' parts are unreachable for the same reason. A Dyeing / Finishing Process Name of '-' counts as empty in the id (`finishing/match01-dash-process-name`).",
  'SAVE-01':
    'The save stops at the first failing row: in `knitting/save01-first-failure-wins` later rows fail other checks too, and a non-admin sees only the SAVE-01 toast.',
  'SAVE-02':
    "Fires only when an Excel row carries its own itemId equal to the next department's saved row (knit-match for Knitting -> Dyeing, dye-match for Dyeing -> Delivery); with generated ids the departments never share ids. The Dyeing check reads the Delivery main plan type, not the Floor plan type, and the exact itemId only (dye-match rows 2 and 3). A change of the plan type alone is enough (`dyeing/save02-plan-type-only`).",
  'SAVE-03':
    'Within a row too, the save stops at the first failing check: in `knitting/save03-first-failure-wins` the row also fails SAVE-07, and only the SAVE-03 toast shows.',
  'SAVE-04':
    'Applies to every department, not only YD / Delivery Floor: a knitting row saved with floor dates is checked (and sent) although the knitting table has no floor inputs (knit-floor-legacy).',
  'SAVE-06':
    "A saved Yarn Date of '-' or 'N/A' counts as none (`knitting/save06-legacy-yarn-placeholders`): each placeholder is the only failing row of one save (Admin fixes the '-' row first, the Planner the 'N/A' row).",
  'SAVE-08':
    "Dyeing input is a Start, an End or a plan type, each counting alone: the Start alone refuses the save in `dyeing/save08-ladder-then-saved` (row 4), the End alone in `dyeing/save08-end-date-alone`. A plan type alone cannot get this far (SAVE-05 runs first). A Knitting plan type of '-' counts as blank.",
  'SAVE-11':
    'Delivery input is a Start, an End, a Floor start or a Floor end, each counting alone; a Floor plan type does not count, and a plan type alone cannot get this far (SAVE-05 runs first). The Floor start alone refuses the save in `delivery/save11-12-then-saved` and `delivery/gate03-saved-plan-exemption`; the Floor end, End and Start alone in `delivery/save11-floor-end-alone`, `delivery/save11-end-date-alone` and `delivery/save11-start-date-alone`.',
  'SAVE-12':
    "A Dyeing start of '-' counts as missing (`delivery/save12-legacy-dash-dyeing-start`; the Dyeing plan type is set there, so SAVE-11 passes).",
  'SAVE-15':
    "Cancel returns the select to the department's SAVED status: `save15-cancel-restores-saved-status` (status-saved) proves it for every department on saved statuses other than 'On Process', after another value was picked. generic-rules and knitting/save15 start from 'On Process', which V2's reset to 'On Process' would also give. Without any saved status (an order never planned, no OrderDate) Cancel returns to 'On Process': `save15-cancel-never-saved` (no-saved-plan, every department). The save checks run BEFORE the prompt: `save15-checks-before-completed-prompt` (every department) shows a failing check's toast, no prompt (an unscripted prompt is a harness error), no request, and the select keeping Completed.",
};

export const IN_SCOPE = RULES.filter((r) => !r.uncovered).map((r) => r.id);

/* ---------- evidence: a scenario that names a toast, confirm or request rule must expect what proves it ---------- */

type StepTest = (step: Step) => boolean;
const setOf =
  (...fields: string[]): StepTest =>
  (s) =>
    s.do === 'set' && fields.includes(s.field);
const onEdit: StepTest = (s) => s.do === 'set' || s.do === 'type';
const onSave: StepTest = (s) => s.do === 'save';
const onSaveOrRelease: StepTest = (s) => s.do === 'save' || s.do === 'release';
const onStart = setOf('startDate');
const onEnd = setOf('endDate');
const onDate = setOf('startDate', 'endDate');
const onTypeOrDate = setOf('planType', 'startDate', 'endDate');
const is =
  (...texts: string[]) =>
  (t: string) =>
    texts.includes(t);

interface Evidence {
  /** The kind of step the expectation must belong to. */
  on: StepTest;
  /** A `toast` expectation whose text passes this test ... */
  toast?: (text: string, sc: Scenario) => boolean;
  /** ... or a `confirm` expectation whose text passes this test ... */
  confirm?: (text: string) => boolean;
  /** ... or any `body` expectation (the request body is checked) ... */
  body?: true;
  /** ... or, for SAVE-01/02, `saved: true`: the rule shown NOT firing (Admin exemption, exact-itemId lookup). */
  orSaved?: true;
  what: string;
}

/**
 * What proves each rule that shows itself as a toast, a confirm or a request. The golden suite checks every
 * expectation against the recording on every run, so a claim backed by an expectation is backed by the recording.
 */
export const EVIDENCE: Record<string, Evidence> = {
  'CHG-01': { on: onStart, toast: is(T.startAfterEnd), what: 'its toast after a Start change' },
  'CHG-02': { on: onEnd, toast: is(T.startAfterEnd), what: 'its toast after an End change' },
  'CHG-03': { on: onDate, toast: is(T.knitBlank), what: 'its toast after a date change' },
  'CHG-04': { on: onStart, toast: is(T.dyeStartBeforeKnit), what: 'its toast after a Start change' },
  'CHG-05': { on: onEnd, toast: is(T.dyeEndBeforeKnit), what: 'its toast after an End change' },
  'CHG-06': { on: onEdit, toast: is(T.datesRequired), what: 'its toast after an edit' },
  'CHG-07': { on: onTypeOrDate, toast: is(T.yarnForConfirm), what: 'its toast after a plan type or date change (a Yarn Date change raising the same text is AUTO-02)' },
  'CHG-08': { on: setOf('planType'), toast: is(T.knitBlank), what: 'its toast after a plan type change' },
  'CHG-09': { on: onTypeOrDate, toast: is(T.knitTentative), what: 'its toast after a plan type or date change' },
  'CHG-10': { on: onTypeOrDate, toast: is(T.finalConfNo), what: 'its toast after a plan type or date change' },
  'CHG-11': { on: onTypeOrDate, toast: is(T.dyeTentativeOrBlank), what: 'its toast after a plan type or date change' },
  'SAVE-00': { on: onSave, toast: is(T.noItems), what: 'its toast after a save' },
  'SAVE-01': { on: onSave, toast: is(T.adminOnlyConfirm), orSaved: true, what: 'its toast after a save, or a save that goes through' },
  'SAVE-02': { on: onSave, toast: (t, sc) => t === T.nextConfirmed(sc.dept), orSaved: true, what: 'its toast after a save, or a save that goes through' },
  'SAVE-03': { on: onSave, toast: is(T.endBeforeStart), what: 'its toast after a save' },
  'SAVE-04': { on: onSave, toast: is(T.endBeforeStart), what: 'its toast after a save' },
  'SAVE-05': { on: onSave, toast: is(T.typeWithoutDates), what: 'its toast after a save' },
  'SAVE-06': { on: onSave, toast: is(T.saveYarnForConfirm), what: 'its toast after a save' },
  'SAVE-07': { on: onSave, toast: is(T.saveStartBeforeYarn), what: 'its toast after a save' },
  'SAVE-08': { on: onSave, toast: is(T.saveKnitTypeMandatory), what: 'its toast after a save' },
  'SAVE-09': { on: onSave, toast: is(T.saveDyeStartBeforeKnit), what: 'its toast after a save' },
  'SAVE-10': { on: onSave, toast: is(T.saveDyeEndBeforeKnit), what: 'its toast after a save' },
  'SAVE-11': { on: onSave, toast: is(T.saveDyeTypeMandatory), what: 'its toast after a save' },
  'SAVE-12': { on: onSave, toast: is(T.saveDyeMissing), what: 'its toast after a save' },
  'SAVE-13': { on: onSave, toast: is(T.saveDeliStartBeforeDye), what: 'its toast after a save' },
  'SAVE-14': { on: onSave, toast: is(T.saveDeliEndBeforeDye), what: 'its toast after a save' },
  'SAVE-15': { on: onSave, confirm: (t) => /^Are you sure you want to mark order '.*' as Completed\?/.test(t), what: 'the Completed confirm after a save' },
  'SAVE-16': { on: onSave, body: true, what: 'a request body after a save' },
  'SAVE-17': {
    on: onSaveOrRelease,
    toast: (t) => t !== T.noItems && !t.startsWith('Save failed:'),
    what: 'the toast of a save response (success, server or network error)',
  },
};

/** Why `sc` names `rule` without an expectation that proves it; null when it has one or the rule has no EVIDENCE entry. */
export function missingEvidence(sc: Scenario, rule: string): string | null {
  const ev = EVIDENCE[rule];
  if (!ev) return null;
  const proves = (e: Expectation): boolean => {
    const step = sc.steps[e.step - 1];
    if (!step || !ev.on(step)) return false;
    if ('toast' in e) return Boolean(ev.toast?.(e.toast, sc));
    if ('confirm' in e) return Boolean(ev.confirm?.(e.confirm));
    if ('body' in e) return Boolean(ev.body);
    if ('saved' in e) return Boolean(ev.orSaved) && e.saved === true;
    return false;
  };
  return (sc.expect ?? []).some(proves) ? null : `${sc.id}: ${rule} needs an expectation of ${ev.what}`;
}

/** RULES.md, built from the rule list and the scenarios. */
export function buildRulesMarkdown(scenarios: Scenario[], localScripts: Array<{ name: string; about: string }>): string {
  const byRule = new Map<string, Map<string, string[]>>();
  for (const sc of scenarios) {
    const [dept, name] = sc.id.split('/');
    for (const rule of sc.rules) {
      if (!byRule.has(rule)) byRule.set(rule, new Map());
      const key = `${dept}/${name}`;
      const roles = byRule.get(rule)!;
      roles.set(key, [...(roles.get(key) || []), sc.role]);
    }
  }
  const covered = RULES.filter((r) => byRule.has(r.id));
  const lines: string[] = [];
  lines.push('# Order page golden master: rule map');
  lines.push('');
  lines.push('Generated by `tests/golden/rules.test.ts` from `tests/golden/rules.ts` and the scenario list. Do not edit by hand:');
  lines.push('`GOLDEN_RECORD=1 npm test` rewrites it, and `npm test` fails when it is out of date.');
  lines.push('');
  lines.push('- `npm test` runs every scenario on the current code and compares it with the recordings (any difference fails).');
  lines.push('- `GOLDEN_RECORD=1 npm test` re-records. Only re-record from code whose behaviour is accepted as the new truth.');
  lines.push('- Synthetic fixtures: `tests/fixtures/synthetic/` (built by `node tests/tools/build-synthetic-fixtures.mjs`), recordings in `tests/golden/synthetic/`.');
  lines.push('- Real-data fixtures and recordings: `tests/golden/local/` (local only, never committed), extracted from the local test database with');
  lines.push('  `node tests/tools/extract-local-fixtures.mjs` (refuses any server other than `mongodb://127.0.0.1:27099`).');
  lines.push('- Recording format: per step, `events` (toasts that reached the screen, `window.confirm` texts and answers, requests with');
  lines.push('  their bodies, router calls); step 1 holds the full page `state` (every row and `data-field`: value, disabled, title, min,');
  lines.push('  options), later steps hold only the leaves that changed (`changes`). `expandStates()` in `tests/harness/snapshot.ts`');
  lines.push('  rebuilds the full state of every step.');
  lines.push('- A scenario that lists a rule shown by a toast, a confirm or a request (CHG-01..11, SAVE-00..17) must have an');
  lines.push('  expectation that proves it on a step of the right kind (`EVIDENCE` in `tests/golden/rules.ts`; `npm test` checks it).');
  lines.push('  SAVE-01 and SAVE-02 may instead be shown not firing, by a save that goes through (Admin exemption, exact-itemId lookup).');
  lines.push('- Any `console.error` or `console.warn` during a test fails it (`tests/setup/setup.ts`): React reports missing keys, act()');
  lines.push("  problems and hook-order changes there. The one line allowed is the page's own log of a failed order load.");
  lines.push('- Node: jsdom 30 needs Node `^22.22.2 || ^24.15.0 || >=26` (the recordings were made on 24.21.0). `knitting/save17-server-errors`');
  lines.push("  records V8's JSON parse error text (Node 18 words it differently); `tests/setup/setup.ts` refuses to run when it differs.");
  lines.push('- Install: `vitest` is an optional peer of `better-auth` (a production dependency), so npm marks vitest, vite, jsdom and');
  lines.push('  their dependencies `devOptional`, and `npm ci --omit=dev` still installs them. They are never loaded by the app; do not');
  lines.push("  add `--omit=optional` to drop them, which also drops Next's SWC and sharp's platform binaries. A plain `npm ci` /");
  lines.push('  `npm install` and the app bundle are not affected.');
  lines.push('');
  lines.push(`Coverage: **${covered.length} of ${RULES.length}** rules have at least one synthetic scenario (${IN_SCOPE.length} rules are in scope for the client harness).`);
  lines.push('');
  lines.push('| Rule | What | Departments | Scenarios (roles) |');
  lines.push('|---|---|---|---|');
  for (const r of RULES) {
    const scs = byRule.get(r.id);
    if (!scs) continue;
    const depts = [...new Set([...scs.keys()].map((k) => k.split('/')[0]))].join(', ');
    const list = [...scs.entries()].map(([k, roles]) => `\`${k}\` (${roles.join(', ')})`).join('<br>');
    lines.push(`| ${r.id} | ${r.what}${RULE_NOTES[r.id] ? ` *Note: ${RULE_NOTES[r.id]}*` : ''} | ${depts} | ${list} |`);
  }
  lines.push('');
  lines.push('## Not covered');
  lines.push('');
  lines.push('| Rule | What | Why |');
  lines.push('|---|---|---|');
  for (const r of RULES) {
    if (byRule.has(r.id)) continue;
    lines.push(`| ${r.id} | ${r.what} | ${r.uncovered || 'NO SCENARIO YET'} |`);
  }
  lines.push('');
  lines.push('## Recorded behaviour without a rule id');
  lines.push('');
  for (const sc of scenarios.filter((s) => s.rules.length === 0)) {
    lines.push(`- \`${sc.id}\`: ${sc.note || ''}`);
  }
  lines.push('');
  lines.push('## Real-data scripts (local only)');
  lines.push('');
  lines.push('Run on every fixture in `tests/golden/local/fixtures/` for Admin and Planner; recordings in `tests/golden/local/recordings/`.');
  lines.push('');
  for (const s of localScripts) lines.push(`- \`${s.name}\`: ${s.about}`);
  lines.push('');
  return lines.join('\n');
}
