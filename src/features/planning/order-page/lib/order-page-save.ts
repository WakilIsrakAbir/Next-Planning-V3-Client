import { API_BASE } from '@/lib/constants';
import { createDeptPlanLogic } from '@/features/planning/lib/dept-plan-logic';
import { formatPlanPayload, type Loose } from '@/features/planning/lib/order-plan-logic';
import { extrasPayload, type PlanExtras } from '@/features/planning/order-page/lib/plan-extras';
import { PLAN_DEPTS, type GroupKey } from '@/features/planning/order-page/lib/order-page-model';

/*
 * Saving from the universal order page: one POST /api/orders/save-plans for every department of the save.
 *
 * The rules are today's, unchanged: each department runs its own validateForSave() and confirmCompletion() from
 * createDeptPlanLogic. Save Data behaves like a series of today's single saves made downstream-first:
 * - the checks run delivery -> finishing -> dyeing -> knitting -> yd and stop at the first failure (nothing is sent);
 * - every check reads the SAVED plan, except the downstream-Confirm check (SAVE-02): a department's validator gets a
 *   plan in which the downstream departments of the same save are replaced by the rows this save writes for them
 *   (what the saved plan would be after their own single saves). The validators are not changed for it;
 * - then the Completed prompts run once per department in pipeline order; Cancel aborts the whole save.
 */

/** One department of a save: the rows and status it sends. */
export interface PlanSaveEntry {
  dept: string;
  /** The field groups saved (delivery: 'floor' and/or 'lock'). */
  groups: GroupKey[];
  rows: Loose[];
  status: string;
}

/** An extra save step of Save Data after the plans (C4 adds the Planning Guide). */
export interface SaveExtra {
  key: string;
  label: string;
  isDirty: boolean;
  save: () => Promise<void>;
}

const pipelineIndex = (dept: string): number => {
  const i = (PLAN_DEPTS as readonly string[]).indexOf(dept);
  return i === -1 ? PLAN_DEPTS.length : i;
};

export const inPipelineOrder = <T extends { dept: string }>(entries: T[]): T[] =>
  [...entries].sort((a, b) => pipelineIndex(a.dept) - pipelineIndex(b.dept));

export const downstreamFirst = <T extends { dept: string }>(entries: T[]): T[] => inPipelineOrder(entries).reverse();

/**
 * The plan `dept`'s validator reads: the saved plan, with every department of the same save that is downstream of
 * `dept` replaced by the rows the save stores for it (formatPlanPayload, as save-plans stores them).
 */
export function planDataForValidation(planData: Loose, dept: string, entries: PlanSaveEntry[]): Loose {
  const downstream = entries.filter((e) => e.dept !== dept && pipelineIndex(e.dept) > pipelineIndex(dept));
  if (downstream.length === 0) return planData;
  const overlay: Record<string, Loose> = { ...(planData || {}) };
  downstream.forEach((e) => {
    overlay[e.dept] = formatPlanPayload(e.dept, e.rows);
  });
  return overlay;
}

interface CheckContext {
  orderNo: string;
  order: Loose;
  /** The saved plan. */
  planData: Loose;
  isAdmin: boolean;
  showToast: (message: string, type?: 'error' | 'success') => void;
}

const noop = () => {};

/** Runs each department's unchanged validateForSave, downstream first. Returns the first failing entry, or null. */
export function findFailingEntry(entries: PlanSaveEntry[], ctx: CheckContext): PlanSaveEntry | null {
  for (const entry of downstreamFirst(entries)) {
    const logic = createDeptPlanLogic({
      dept: entry.dept,
      orderNo: ctx.orderNo,
      order: ctx.order,
      planData: planDataForValidation(ctx.planData, entry.dept, entries),
      planItems: entry.rows,
      setPlanItems: noop,
      orderStatus: entry.status,
      setOrderStatus: noop,
      isAdmin: ctx.isAdmin,
      showToast: ctx.showToast,
    });
    if (!logic.validateForSave()) return entry;
  }
  return null;
}

/**
 * Today's Completed prompt for each department of the save, in pipeline order. Cancel restores that department's
 * saved status (`restoreStatus`) and returns false: nothing is saved.
 * `storedPlan` (a "Save mine anyway" rebased on a fresh read): the plan whose stored status the prompt compares with,
 * so it asks only when the user changed the status to Completed, never for a Completed status someone else stored.
 */
export function confirmCompletions(
  entries: PlanSaveEntry[],
  ctx: CheckContext & { restoreStatus: (dept: string, status: string) => void; storedPlan?: (dept: string) => Loose }
): boolean {
  for (const entry of inPipelineOrder(entries)) {
    const logic = createDeptPlanLogic({
      dept: entry.dept,
      orderNo: ctx.orderNo,
      order: ctx.order,
      planData: ctx.storedPlan ? ctx.storedPlan(entry.dept) : ctx.planData,
      planItems: entry.rows,
      setPlanItems: noop,
      orderStatus: entry.status,
      setOrderStatus: (value) => {
        ctx.restoreStatus(entry.dept, typeof value === 'function' ? value(entry.status) : value);
      },
      isAdmin: ctx.isAdmin,
      showToast: ctx.showToast,
    });
    if (!logic.confirmCompletion()) return false;
  }
  return true;
}

export interface SavePlansBody {
  orderNo: string;
  /** `extras` (US-11): Knitting and Dyeing only, the full map of the saved rows' extra dates (planExtras.<dept>). */
  plans: Array<{ department: string; fabricItems: Loose[]; orderStatus: string; extras?: PlanExtras }>;
  base?: Record<string, string>;
}

/** The save-plans body: the departments in pipeline order, with the base fingerprint of each one that has one. */
export function buildSavePlansBody(orderNo: string, entries: PlanSaveEntry[], fingerprints: Partial<Record<string, string>>): SavePlansBody {
  const ordered = inPipelineOrder(entries);
  const body: SavePlansBody = {
    orderNo,
    plans: ordered.map((e) => {
      const plan: SavePlansBody['plans'][number] = { department: e.dept, fabricItems: formatPlanPayload(e.dept, e.rows), orderStatus: e.status };
      const extras = extrasPayload(e.dept, e.rows);
      if (extras) plan.extras = extras;
      return plan;
    }),
  };
  const base: Record<string, string> = {};
  ordered.forEach((e) => {
    const fp = fingerprints[e.dept];
    if (typeof fp === 'string' && fp) base[e.dept] = fp;
  });
  if (Object.keys(base).length > 0) body.base = base;
  return body;
}

export interface SavePlansResult {
  message?: string;
  planData: Loose;
  planStatuses?: Record<string, string>;
  statusSynced?: boolean;
  fingerprints?: Partial<Record<string, string>>;
}

/** Shown when the server has no save-plans route yet (an older server answers Express's 404 page). */
export const SAVE_PLANS_MISSING_MESSAGE = 'Deploy the updated Next Planning V3 server to save from this page.';

/** A save-plans answer that is not OK: its message is the toast text; a 409 also names the changed departments. */
export class SavePlansError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly departments?: string[];

  constructor(message: string, status: number, code?: string, departments?: string[]) {
    super(message);
    this.name = 'SavePlansError';
    this.status = status;
    this.code = code;
    this.departments = departments;
  }

  /** Plan D7: someone else changed these departments after the page read them (S1: 409 CONFLICT). */
  get conflictDepartments(): string[] | null {
    return this.status === 409 && this.code === 'CONFLICT' && Array.isArray(this.departments) ? this.departments : null;
  }
}

/**
 * POST /api/orders/save-plans. Throws an Error whose message is the toast text: the server's message (400, 404 with a
 * message, 409, 500; as a SavePlansError), today's fallback text, the JSON parse error of a non-JSON reply, or the
 * network error.
 */
export async function postSavePlans(body: SavePlansBody): Promise<SavePlansResult> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/api/orders/save-plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 404) {
      let message = '';
      try {
        const data = await res.json();
        message = data && typeof data.message === 'string' ? data.message : '';
      } catch {
        message = '';
      }
      throw new SavePlansError(message || SAVE_PLANS_MISSING_MESSAGE, 404);
    }
    const errorData = await res.json();
    throw new SavePlansError(errorData.message || 'Failed to save planning schedule.', res.status, errorData.code, errorData.departments);
  }
  return (await res.json()) as SavePlansResult;
}
