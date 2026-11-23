import { firstTruthy, toText } from '@/features/reports/planning-prod-info/lib/ppi-utils';

/** Display text of the first truthy value (JS `a || b || c`). */
export const sv = (...values: unknown[]) => toText(firstTruthy(...values));

export const hasValue = (v: unknown) => v !== undefined && v !== null && v !== '';
