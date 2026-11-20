import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkExpectations } from '../harness/expect';
import { runScenario } from '../harness/runner';
import { formatJson } from '../harness/snapshot';
import type { Fixture, Scenario } from '../harness/types';

/** GOLDEN_RECORD=1 writes the recordings; otherwise (the default) every run must match them exactly. */
export const RECORD = process.env.GOLDEN_RECORD === '1';

export function recordingPath(dir: string, id: string): string {
  return join(dir, `${id}.json`);
}

/**
 * One test per scenario: run it on today's page, check its expectations, then record or compare the JSON.
 * Compare mode fails on any difference (whole file, byte for byte after CRLF -> LF).
 */
export function goldenSuite(title: string, scenarios: Scenario[], loadFixture: (name: string) => Fixture, dir: string): void {
  describe(title, () => {
    for (const sc of scenarios) {
      it(sc.id, async () => {
        const recording = await runScenario(sc, loadFixture(sc.fixture));
        expect(recording.harnessErrors ?? [], 'harness errors').toEqual([]);
        expect(checkExpectations(recording, sc), 'scenario expectations').toEqual([]);

        const text = formatJson(recording) + '\n';
        const file = recordingPath(dir, sc.id);
        if (RECORD) {
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, text);
          return;
        }
        if (!existsSync(file)) throw new Error(`No recording ${file}. Record it from today's code with GOLDEN_RECORD=1.`);
        const stored = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
        if (text !== stored) {
          expect(JSON.parse(text)).toEqual(JSON.parse(stored));
          expect(text).toBe(stored);
        }
      });
    }

    it('has no recordings without a scenario', () => {
      if (RECORD || !existsSync(dir)) return;
      const ids = new Set(scenarios.map((s) => s.id));
      const files: string[] = [];
      const walk = (d: string) => {
        for (const name of readdirSync(d)) {
          const p = join(d, name);
          if (statSync(p).isDirectory()) walk(p);
          else if (name.endsWith('.json')) files.push(relative(dir, p).replace(/\\/g, '/').replace(/\.json$/, ''));
        }
      };
      walk(dir);
      expect(files.filter((f) => !ids.has(f))).toEqual([]);
    });
  });
}
