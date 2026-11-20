import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TESTS_DIR } from '../harness/fixtures';
import { RECORD } from './golden-suite';
import { LOCAL_SCRIPTS } from './local-scripts';
import { buildRulesMarkdown, IN_SCOPE, RULES } from './rules';
import { syntheticScenarios } from './scenarios';

const RULES_MD = `${TESTS_DIR}golden/RULES.md`;

describe('rule map', () => {
  it('knows every rule id a scenario names', () => {
    const known = new Set(RULES.map((r) => r.id));
    const unknown = syntheticScenarios.flatMap((s) => s.rules.filter((r) => !known.has(r)).map((r) => `${s.id}: ${r}`));
    expect(unknown).toEqual([]);
  });

  it('lists all 61 rules once', () => {
    expect(RULES.length).toBe(61);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(61);
  });

  it('has a scenario for every rule in scope of the client harness', () => {
    const covered = new Set(syntheticScenarios.flatMap((s) => s.rules));
    expect(IN_SCOPE.filter((id) => !covered.has(id))).toEqual([]);
  });

  it('tests/golden/RULES.md is up to date', () => {
    const md = buildRulesMarkdown(syntheticScenarios, LOCAL_SCRIPTS);
    if (RECORD) {
      writeFileSync(RULES_MD, md);
      return;
    }
    expect(readFileSync(RULES_MD, 'utf8').replace(/\r\n/g, '\n')).toBe(md);
  });
});
