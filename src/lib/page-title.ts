import { DEPARTMENTS, PLAN_LIST_TITLES } from './constants';

/** Browser-tab titles. The root layout appends " | Textile Planning Solution" to every page title. */
const DEPT_SHORT: Record<string, string> = {
  yd: 'YD',
  knitting: 'Knitting',
  dyeing: 'Dyeing',
  finishing: 'Finishing',
  delivery: 'Delivery',
  deliveryfloor: 'Delivery (Floor)',
  deliverylock: 'Delivery (Lock)',
};

/** "Knitting", "Delivery (Floor)" ... */
export const deptShortName = (dept: string): string => DEPT_SHORT[dept] ?? dept;

/** "Knitting Plan", "Delivery Plan (Floor)" ... */
export const deptPlanName = (dept: string): string =>
  DEPARTMENTS[dept]?.name ?? PLAN_LIST_TITLES[dept] ?? `${deptShortName(dept)} Plan`;
