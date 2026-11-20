import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Fixture } from './types';

// Vitest runs from the project root (vitest.config.ts); import.meta.url is not a file: URL under jsdom.
export const TESTS_DIR = join(process.cwd(), 'tests') + '/';
if (!existsSync(`${TESTS_DIR}harness/fixtures.ts`)) throw new Error(`Run the tests from the project root (looked in ${TESTS_DIR}).`);
export const SYNTHETIC_DIR = `${TESTS_DIR}fixtures/synthetic/`;
/** Real-data fixtures and recordings: extracted from the LOCAL test database, never committed (.gitignore). */
export const LOCAL_DIR = `${TESTS_DIR}golden/local/`;
export const LOCAL_FIXTURE_DIR = `${LOCAL_DIR}fixtures/`;

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

let defaultDropdowns: Fixture['dropdownmasters'] | null = null;

/** tests/fixtures/synthetic/<name>.json; without its own dropdownmasters it uses _dropdowns.json. */
export function loadSyntheticFixture(name: string): Fixture {
  const data = readJson(`${SYNTHETIC_DIR}${name}.json`);
  if (!defaultDropdowns) defaultDropdowns = readJson(`${SYNTHETIC_DIR}_dropdowns.json`).dropdownmasters;
  return {
    name,
    about: data.about,
    orderNo: data.orderNo,
    orders: data.orders || [],
    orderDates: data.orderDates || [],
    dropdownmasters: data.dropdownmasters || defaultDropdowns || [],
  };
}

export function listSyntheticFixtures(): string[] {
  return readdirSync(SYNTHETIC_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

export function hasLocalFixtures(): boolean {
  return existsSync(`${LOCAL_FIXTURE_DIR}index.json`);
}

/** The index written by tests/tools/extract-local-fixtures.mjs: [{name, dept, orderNo, tags}] */
export function listLocalFixtures(): Array<{ name: string; dept: string; orderNo: string; tags: string[] }> {
  return readJson(`${LOCAL_FIXTURE_DIR}index.json`).fixtures;
}

export function loadLocalFixture(name: string): Fixture {
  const data = readJson(`${LOCAL_FIXTURE_DIR}${name}.json`);
  const dropdowns = readJson(`${LOCAL_FIXTURE_DIR}_dropdowns.json`).dropdownmasters;
  return {
    name: `local/${name}`,
    orderNo: data.orderNo,
    orders: data.orders || [],
    orderDates: data.orderDates || [],
    dropdownmasters: dropdowns,
  };
}
