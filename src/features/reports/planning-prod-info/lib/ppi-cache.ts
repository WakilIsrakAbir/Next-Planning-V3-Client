import type { PPIDetail, PPIListResult } from '@/features/reports/planning-prod-info/types';

// Module-level SWR Cache for instant tab switching (0ms perceived latency)
export const cachedPPI = {
  data: new Map<string, PPIListResult>(),
  details: new Map<string, PPIDetail>(),
};
