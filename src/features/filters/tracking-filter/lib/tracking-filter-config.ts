import type { DateField } from '@/features/filters/tracking-filter/types';

export const PVATF_CONFIGS: Record<string, { title: string }> = {
  yd: { title: 'YD Plan Tracking Filter' },
  knitting: { title: 'Knitting Plan Tracking Filter' },
  dyeing: { title: 'Dyeing Plan Tracking Filter' },
  delivery: { title: 'Delivery Plan Tracking Filter' },
  deliveryfloor: { title: 'Delivery Plan (Floor) Tracking Filter' },
};

export const DATE_FIELD_LABELS: Record<DateField, string> = {
  planStart: 'Plan Start Date',
  planEnd: 'Plan End Date',
  actualStart: 'Actual Start Date',
  actualEnd: 'Actual End Date',
};

/** Departments that show Unit / Process Name columns and the Unit filter. */
export function isUnitProcessDept(deptKey: string): boolean {
  return deptKey === 'dyeing' || deptKey === 'delivery' || deptKey === 'deliveryfloor';
}
