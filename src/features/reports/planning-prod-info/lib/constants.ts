import type { PPIListResult } from '@/features/reports/planning-prod-info/types';

export const EMPTY_LIST: PPIListResult = { orders: [], total: 0, totalPages: 1 };

// Typing pause before the search box text is sent (Enter searches immediately)
export const SEARCH_DEBOUNCE_MS = 350;

// Natural height of a list row (view button + status badge + padding); "Auto" stretches rows slightly to fill the table area.
export const ROW_HEIGHT = 41;

// Report zoom (old setReportZoom / fitReportToScreen): 30%..150% in 10% steps; the sheet is max-w-6xl.
export const REPORT_MAX_WIDTH = 1152;
export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 1.5;
export const ZOOM_STEP = 0.1;
