import { calcOTTStatus } from '@/lib/date-utils';
import type { Loose } from '@/features/planning/lib/order-plan-logic';

/*
 * US-11 (TASK-11.6): the OTT board of one order ("OTT Board — Same Booking Status"), shown from the Plan Vs Actual
 * Tracking lists. Pure: it reads the order detail (GET /api/orders/:orderNo) and returns the six cards.
 *
 * - Plan: the earliest start and the latest end of the saved plan rows (Delivery Floor: floorStartDate / floorEndDate;
 *   Delivery Lock: startDate / endDate of the delivery rows).
 * - Actual, Reason, Dept: planData.<dept>Actual.{actualStart, actualEnd, failReason, relatedDept}; Floor and Lock both
 *   read deliveryActual, as tracking does.
 * - Yarn: one line. Plan = the earliest Yarn Date of the knitting rows (else the order's T&A Yarn date); Actual = the
 *   latest Actual Yarn Date in planExtras.knitting.
 * - Pass / Fail / — is calcOTTStatus (actual <= plan Pass, later Fail, no actual and plan already past Fail).
 */

export type OttStatus = 'Pass' | 'Fail' | '—';

export interface OttLine {
  label: 'Start' | 'End' | 'Yarn';
  /** YYYY-MM-DD or ''. */
  plan: string;
  /** YYYY-MM-DD or ''. */
  actual: string;
  status: OttStatus;
  reason: string;
  dept: string;
}

export interface OttCard {
  key: 'yarn' | 'yd' | 'knitting' | 'dyeing' | 'deliveryFloor' | 'deliveryLock';
  title: string;
  lines: OttLine[];
  /** Neither plan dates nor actuals: the card shows "No booking data". */
  noData: boolean;
}

/** The tracking departments whose lists have the OTT board button. */
export const OTT_BOARD_DEPTS = ['yd', 'knitting', 'dyeing', 'delivery', 'deliveryfloor'];

const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A stored date as YYYY-MM-DD ('' when blank or not a date). Excel serials (T&A fields) are read as dates too. */
export function toDay(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' || (typeof value === 'string' && /^\d{5}(\.\d+)?$/.test(value.trim()))) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 20000 || n > 80000) return '';
    const d = new Date(Math.round((n - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(value).trim();
  if (!s || s === '-' || s === '—' || s === 'N/A') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    // A full ISO time is a moment: its local day. A plain date is that day.
    if (s.length > 10 && s.includes('T')) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? `${m[1]}-${m[2]}-${m[3]}` : localDay(d);
    }
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : localDay(d);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "dd Mmm yy" (e.g. "05 Oct 26"), or "—". */
export function formatOttDate(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
  if (!m) return '—';
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1].slice(2)}`;
}

const earliest = (days: string[]) => days.filter(Boolean).sort()[0] || '';
const latest = (days: string[]) => days.filter(Boolean).sort().pop() || '';
const rowsOf = (planData: Loose, dept: string): Loose[] => (Array.isArray(planData?.[dept]) ? planData[dept] : []);
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : String(v));

function line(label: OttLine['label'], plan: string, actual: string, reason = '', dept = ''): OttLine {
  const status = calcOTTStatus(plan || undefined, actual || undefined);
  return { label, plan, actual, status, reason: status === 'Fail' ? reason : '', dept: status === 'Fail' ? dept : '' };
}

function deptCard(key: OttCard['key'], title: string, rows: Loose[], startKey: string, endKey: string, actual: Loose): OttCard {
  const planStart = earliest(rows.map((r) => toDay(r?.[startKey] || (startKey === 'startDate' ? r?.planStart : undefined))));
  const planEnd = latest(rows.map((r) => toDay(r?.[endKey] || (endKey === 'endDate' ? r?.planEnd : undefined))));
  const a = actual && typeof actual === 'object' ? actual : {};
  const actualStart = toDay(a.actualStart);
  const actualEnd = toDay(a.actualEnd);
  const reason = text(a.failReason);
  const dept = text(a.relatedDept);
  return {
    key,
    title,
    lines: [line('Start', planStart, actualStart, reason, dept), line('End', planEnd, actualEnd, reason, dept)],
    noData: !planStart && !planEnd && !actualStart && !actualEnd,
  };
}

/** The six cards of an order's OTT board, from its detail answer (`order` and `planData`). */
export function buildOttBoard(order: Loose, planData: Loose): OttCard[] {
  const pd = planData && typeof planData === 'object' ? planData : {};
  const knitRows = rowsOf(pd, 'knitting');
  const deliveryRows = rowsOf(pd, 'delivery');

  const yarnPlan = earliest(knitRows.map((r) => toDay(r?.yarnDate))) || toDay(order?.yarnDate);
  const extras = pd.planExtras?.knitting;
  const yarnActual = latest(
    extras && typeof extras === 'object' ? Object.values(extras).map((e: Loose) => toDay(e?.actualYarnDate)) : []
  );
  const yarn: OttCard = { key: 'yarn', title: 'Yarn', lines: [line('Yarn', yarnPlan, yarnActual)], noData: !yarnPlan && !yarnActual };

  return [
    yarn,
    deptCard('yd', 'YD', rowsOf(pd, 'yd'), 'startDate', 'endDate', pd.ydActual),
    deptCard('knitting', 'Knitting', knitRows, 'startDate', 'endDate', pd.knittingActual),
    deptCard('dyeing', 'Dyeing', rowsOf(pd, 'dyeing'), 'startDate', 'endDate', pd.dyeingActual),
    deptCard('deliveryFloor', 'Delivery Floor', deliveryRows, 'floorStartDate', 'floorEndDate', pd.deliveryActual),
    deptCard('deliveryLock', 'Delivery Lock', deliveryRows, 'startDate', 'endDate', pd.deliveryActual),
  ];
}
