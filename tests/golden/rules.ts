import type { Scenario } from '../harness/types';

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

const SERVER_ONLY =
  'Server behaviour, outside the client harness. The mocked server ports it so the page sees the real answers, but proving it belongs to the server tests (SPEC S1 golden test of save-dates).';

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
  { id: 'SRV-01', what: 'Login token required (401/403)', uncovered: SERVER_ONLY },
  { id: 'SRV-02', what: 'Buyer scope not applied to details or save', uncovered: SERVER_ONLY },
  { id: 'SRV-03', what: 'The server checks no plan rule', uncovered: SERVER_ONLY },
  { id: 'SRV-04', what: 'save-dates replaces the department array ($set, upsert)', uncovered: SERVER_ONLY },
  { id: 'SRV-05', what: 'Plan status recalculated after a save', uncovered: SERVER_ONLY },
  { id: 'SRV-06', what: 'Server caches cleared after a save (per instance)', uncovered: SERVER_ONLY },
  { id: 'SRV-07', what: 'Rate limit and body size limit', uncovered: SERVER_ONLY },
  { id: 'SRV-08', what: 'save-dates response and error shape', uncovered: SERVER_ONLY },
  { id: 'MATCH-01', what: 'itemId = Excel itemId, else the generated id per department' },
  { id: 'MATCH-02', what: 'Saved-row lookup fallbacks (generated id, trailing _ / _n/a, colour, YDB)' },
  { id: 'MATCH-03', what: 'Upstream Knitting / Dyeing row for a Dyeing / Delivery row' },
  { id: 'MATCH-04', what: 'SAVE-01 and SAVE-02 use the exact itemId only' },
  { id: 'STAT-01', what: 'Order Status select (per department, sent with every save, Completed not locked)' },
];

/** Notes on covered rules with a branch that cannot be reached from the UI. */
export const RULE_NOTES: Record<string, string> = {
  'MATCH-01':
    "The `item_${idx}` fallback is unreachable: generateItemId always returns a non-empty id (getColData returns '' for missing columns, so even an empty row gives '<order>_..._'). The 'N/A' parts are unreachable for the same reason.",
  'SAVE-02':
    'Fires only when an Excel row carries its own itemId equal to the next department\'s saved row (knit-match); with generated ids the departments never share ids.',
  'SAVE-04':
    'Applies to every department, not only YD / Delivery Floor: a knitting row saved with floor dates is checked (and sent) although the knitting table has no floor inputs (knit-floor-legacy).',
};

export const IN_SCOPE = RULES.filter((r) => !r.uncovered).map((r) => r.id);

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
