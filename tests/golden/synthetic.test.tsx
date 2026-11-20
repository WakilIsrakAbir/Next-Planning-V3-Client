import { loadSyntheticFixture, TESTS_DIR } from '../harness/fixtures';
import { goldenSuite } from './golden-suite';
import { syntheticScenarios } from './scenarios';

// Golden master of today's order page on the committed synthetic fixtures (tests/fixtures/synthetic/).
goldenSuite('order page golden master (synthetic fixtures)', syntheticScenarios, loadSyntheticFixture, `${TESTS_DIR}golden/synthetic`);
