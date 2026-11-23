import type { PPIOrder, PPIPlanData } from '@/features/reports/planning-prod-info/lib/ppi-utils';

export interface PPIListResult {
  orders: PPIOrder[];
  total: number;
  totalPages: number;
}

export interface PPIDetail {
  order: PPIOrder | null;
  planData: PPIPlanData | null;
}

export interface PPIToastState {
  type: 'success' | 'error';
  message: string;
}
