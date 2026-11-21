import type { Scenario } from '../../harness/types';
import { commonScenarios } from './common';
import { deliveryScenarios } from './delivery';
import { dyeingScenarios } from './dyeing';
import { finishingScenarios } from './finishing';
import { knittingScenarios } from './knitting';
import { ydScenarios } from './yd';

/** Every synthetic scenario (recordings committed under tests/golden/synthetic/<id>.json). */
export const syntheticScenarios: Scenario[] = [
  ...ydScenarios,
  ...knittingScenarios,
  ...dyeingScenarios,
  ...finishingScenarios,
  ...deliveryScenarios,
  ...commonScenarios,
];

const seen = new Set<string>();
for (const sc of syntheticScenarios) {
  if (seen.has(sc.id)) throw new Error(`Duplicate scenario id ${sc.id}`);
  seen.add(sc.id);
}
