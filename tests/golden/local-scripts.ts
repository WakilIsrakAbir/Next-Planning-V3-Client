import type { RoleName, Scenario, Step } from '../harness/types';

/*
 * Scripts run on every real-data fixture (tests/golden/local/fixtures/, extracted from the local test database).
 * They are generic: steps that do not apply (a disabled field, a missing row) are skipped and recorded as such,
 * so the same script works on any order. Their recordings stay local (tests/golden/local/recordings/).
 */
export const LOCAL_SCRIPTS: Array<{ name: string; about: string; steps: Step[] }> = [
  {
    name: 'load',
    about: 'Open the page (rows, locks, defaults, upstream columns, General card).',
    steps: [{ do: 'load' }],
  },
  {
    name: 'save-as-is',
    about: 'Open the page and save without editing (what a plain save sends, or which check refuses it).',
    steps: [{ do: 'load' }, { do: 'save' }],
  },
  {
    name: 'edit-and-save',
    about: "Row 1 End 2026-12-31 and plan type Tentative (both copied down where the rules allow), row 2 remarks 'golden-check', then save.",
    steps: [
      { do: 'load' },
      { do: 'set', row: 0, field: 'endDate', value: '2026-12-31', optional: true },
      { do: 'set', row: 0, field: 'planType', value: 'Tentative', optional: true },
      { do: 'set', row: 1, field: 'remarks', value: 'golden-check', optional: true },
      { do: 'save' },
    ],
  },
];

const ROLES: RoleName[] = ['admin', 'planner'];

export function localScenarios(fixtures: Array<{ name: string; dept: string; orderNo: string }>): Scenario[] {
  const out: Scenario[] = [];
  for (const f of fixtures) {
    for (const script of LOCAL_SCRIPTS) {
      for (const role of ROLES) {
        out.push({ id: `${f.name}/${script.name}/${role}`, fixture: f.name, dept: f.dept, role, rules: [], steps: script.steps });
      }
    }
  }
  return out;
}
