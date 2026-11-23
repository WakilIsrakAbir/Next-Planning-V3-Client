import type { TrackingEdit, TrackingOrder } from '@/features/tracking/tracking/types';

export const cachedTrackingOrders: Record<
  string,
  {
    orders: TrackingOrder[];
    total: number;
    totalPages: number;
    buyers: string[];
    initialEdits: Record<string, TrackingEdit>;
  }
> = {};
// Rows per page of the last list request, so a revisit can show that cached first page before "Auto" has measured the table
export const lastListRequest = { limit: 10 };

// Cache key of one tracking list page (the same format when reading and storing).
export function trackingCacheKey(
  dept: string,
  tab: string,
  buyer: string,
  page: number,
  limit: number,
  search: string,
  sMin: string,
  sMax: string,
  eMin: string,
  eMax: string
): string {
  return `${dept}_${tab}_${buyer}_${page}_${limit}_${search}_${sMin}_${sMax}_${eMin}_${eMax}`;
}
