import { describe, it } from 'vitest';
import { hasLocalFixtures, listLocalFixtures, loadLocalFixture, LOCAL_DIR } from '../harness/fixtures';
import { goldenSuite } from './golden-suite';
import { localScenarios } from './local-scripts';

// Golden master on real orders from the LOCAL test database. Fixtures and recordings live in tests/golden/local/
// (gitignored); without them (e.g. a fresh clone) this file only reports how to create them.
if (hasLocalFixtures()) {
  goldenSuite('order page golden master (local real data)', localScenarios(listLocalFixtures()), loadLocalFixture, `${LOCAL_DIR}recordings`);
} else {
  describe.skip('order page golden master (local real data)', () => {
    it('needs tests/golden/local/fixtures: run node tests/tools/extract-local-fixtures.mjs against the local test database', () => {});
  });
}
