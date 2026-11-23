// Module-level SWR Cache for instant tab switching (0ms perceived latency)
export const cachedProductInfo = {
  data: new Map<string, { orders: any[]; total: number; totalPages: number }>(),
  details: new Map<string, any>(),
};
// Rows per page of the last list request, so a revisit can show that cached first page before "Auto" has measured the table
export const lastListRequest = { limit: 10 };
