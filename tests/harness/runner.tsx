import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import { MockServer, TEST_TOKEN, type LoggedRequest } from './mock-server';
import { resetHarnessState, type RouterCall } from './state';
import { diffStates, readPage, readToast, type PageState } from './snapshot';
import type { Fixture, Loose, RoleName, Scenario, ScriptedReply, Step } from './types';

/** Fake clock start: 2026-11-21 10:00 in Dhaka. After each step the clock moves on 4 s (the 3.8 s toast is gone). */
export const FIXED_NOW = new Date('2026-11-21T04:00:00.000Z');
const DEFAULT_GAP_MS = 4000;

export interface StepRecord {
  n: number;
  step: Step;
  /** An optional step whose field was missing or disabled (nothing was done). */
  skipped?: string;
  /** Load/reopen only: the first paint, before any request has answered. */
  initial?: PageState;
  events?: {
    toasts?: string[];
    confirms?: Array<{ message: string; answer: boolean | null }>;
    requests?: LoggedRequest[];
    router?: RouterCall[];
  };
  /** Full page state (first step) ... */
  state?: PageState;
  /** ... or the leaves that changed since the previous step. */
  changes?: Record<string, Loose>;
}

export interface Recording {
  scenario: string;
  fixture: string;
  dept: string;
  role: RoleName;
  orderNo: string;
  rules: string[];
  note?: string;
  steps: StepRecord[];
  harnessErrors?: string[];
}

/* ---------- logged-in users, stored the way LoginScreen.tsx stores them ---------- */
function login(username: string, role: string, permissions: Loose): Record<string, string> {
  const user = { id: `u-${username}`, username, role, status: 'active', permissions };
  return {
    token: TEST_TOKEN,
    user: JSON.stringify(user),
    username,
    role,
    permissions: JSON.stringify(permissions),
    status: 'active',
    sessionExpiresAt: '1795197600000',
  };
}

const PLANNER_PERMISSIONS = {
  buyers: { accessType: 'all' },
  menus: { orderManagement: { yd: true, knitting: true, dyeing: true, finishing: true, delivery: true } },
  actions: { saveYD: true, saveKnitting: true, saveDyeing: true, saveFinishing: true, saveDelivery: true },
};

export const ROLE_STORAGE: Record<RoleName, Record<string, string>> = {
  admin: login('admin', 'Admin', { buyers: { accessType: 'all' } }),
  planner: login('planner1', 'Planner', PLANNER_PERMISSIONS),
  approver: login('approver1', 'Approver', PLANNER_PERMISSIONS),
  viewer: login('viewer1', 'Viewer', { buyers: { accessType: 'all' }, menus: { orderManagement: { knitting: true } } }),
  // A token without any stored user or role.
  none: { token: TEST_TOKEN },
  // No user JSON; only the old single key, in lower case (readIsAdminRole's fallback path).
  lowerApprover: { token: TEST_TOKEN, userRole: 'approver' },
};

/* ---------- helpers ---------- */

async function settle(): Promise<void> {
  // setImmediate is not faked: each round lets every pending promise (mocked requests, state updates) run.
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      await vi.advanceTimersByTimeAsync(0);
    });
  }
}

// The universal order page (SPEC C2) shows several plan sections: a scenario edits the route department's section(s)
// ([data-route-section]); on the delivery page the Floor fields live in the Floor table, the others in the Lock table.
function findField(row: number, field: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
  return document.querySelector(`[data-route-section] [data-plan-table] [data-row="${row}"] [data-field="${field}"]`);
}

function buttonByText(text: string): HTMLButtonElement | null {
  return (Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement) || null;
}

/**
 * The button a scenario's `save` step clicks (SPEC section 5): the route section's own Save (`via: 'footer'`: the one
 * in its table card's footer). On the delivery page: Save Data when both Floor and Lock have unsaved changes, else the
 * Save of the group that has them, else Save Lock (a clean section's Save still sends, as today's Save did).
 */
function saveButtonFor(dept: string, via: 'header' | 'footer' | undefined): HTMLButtonElement | null {
  if (dept === 'delivery') {
    const dirty = (key: string) => document.querySelector(`[data-plan-section="${key}"] [data-pill="unsaved"]`) !== null;
    const floorDirty = dirty('deliveryFloor');
    const lockDirty = dirty('deliveryLock');
    if (floorDirty && lockDirty) return document.querySelector('[data-action="save-data"]');
    const key = floorDirty ? 'deliveryFloor' : 'deliveryLock';
    return document.querySelector(`[data-plan-section="${key}"] [data-action="save-section"]`);
  }
  if (via === 'footer') {
    const footerSaves = document.querySelectorAll('[data-route-section] [data-plan-table]');
    const card = footerSaves[0]?.closest('.overflow-hidden');
    return (card?.lastElementChild?.querySelector('[data-action="save"]') as HTMLButtonElement | null) ?? null;
  }
  return document.querySelector('[data-route-section] [data-action="save-section"]');
}

/**
 * Requests as today's page sent them (SPEC C2 item 10 and section 5): a save-plans request with one department is
 * recorded as the save-dates request it replaces ({orderNo, department, fabricItems, orderStatus} = plans[0]; `base`
 * is not part of it), and `fresh=1`, which detail reads carry for 2 minutes after a save, is dropped from the URL.
 */
export function legacyRequest(r: LoggedRequest): LoggedRequest {
  if (r.method === 'POST' && r.url === '/api/orders/save-plans' && Array.isArray(r.body?.plans) && r.body.plans.length === 1) {
    const plan = r.body.plans[0];
    const body: Loose = { orderNo: r.body.orderNo, department: plan.department, fabricItems: plan.fabricItems };
    if (plan.orderStatus !== undefined) body.orderStatus = plan.orderStatus;
    return { method: r.method, url: '/api/orders/save-dates', auth: r.auth, body };
  }
  if (r.method === 'GET' && /[?&]fresh=1(&|$)/.test(r.url)) {
    const url = r.url.replace(/([?&])fresh=1(&|$)/, (_m, sep: string, after: string) => (after ? sep : '')).replace(/[?&]$/, '');
    return { ...r, url };
  }
  return r;
}

/**
 * The Checkpoint & Planning Guide card reads the Plan Check List (GET /api/plan-check-list) when it opens. That read is
 * not part of today's page, as the C2 chrome is not: the recordings leave it out. Nothing else is left out: golden
 * scenarios never edit or save the guide, so a PUT plan-guide (or any other request) in a scenario stays visible.
 */
export function isPlanningGuideRequest(r: LoggedRequest): boolean {
  return r.method === 'GET' && r.url.split('?')[0] === '/api/plan-check-list';
}

/*
 * C2b (SPEC C2 item 8): Back, the arrow and the card's Cancel ask before leaving unsaved work, with the shared guard's
 * prompt "Unsaved changes in: <sections>. Leave without saving?" (src/lib/unsaved-changes.ts). Today's page left
 * without asking (knitting/gate07-back-discards-edits). A scenario's `back` step is the user leaving the page, so during
 * that step the runner answers OK to that prompt and keeps it out of the recording; the navigation is recorded as
 * before. The prompts answered this way are listed in `leavePromptsAnswered` (never recorded), so a test can check that
 * they were asked.
 */
const LEAVE_PROMPT = /^Unsaved changes in: .+\. Leave without saving\?$/;
export const leavePromptsAnswered: string[] = [];

/* ---------- the runner ---------- */

export async function runScenario(sc: Scenario, fixture: Fixture): Promise<Recording> {
  const errors: string[] = [];
  vi.useFakeTimers({ now: FIXED_NOW, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  localStorage.clear();
  sessionStorage.clear();

  const orderNo = sc.orderNo ?? fixture.orderNo;
  const harness = resetHarnessState({ dept: sc.dept, orderNo }, `/planning/${sc.dept}/${encodeURIComponent(orderNo)}`);
  const server = new MockServer(fixture);
  harness.fetchHandler = server.fetch;
  Object.entries(ROLE_STORAGE[sc.role]).forEach(([k, v]) => localStorage.setItem(k, v));

  // handleBack: router.back() when window.history.length > 1, else router.push('/planning/<dept>').
  const historyLength = sc.historyLength ?? 1;
  Object.defineProperty(window.history, 'length', { configurable: true, get: () => historyLength });

  const confirmAnswers: boolean[] = [];
  const confirmLog: Array<{ message: string; answer: boolean | null }> = [];
  const originalConfirm = window.confirm;
  let leaving = false;
  leavePromptsAnswered.length = 0;
  window.confirm = (message?: string) => {
    if (leaving && LEAVE_PROMPT.test(String(message))) {
      leavePromptsAnswered.push(String(message));
      return true;
    }
    const answer = confirmAnswers.shift();
    if (answer === undefined) {
      errors.push(`Unscripted window.confirm: ${message}`);
      confirmLog.push({ message: String(message), answer: null });
      return false;
    }
    confirmLog.push({ message: String(message), answer });
    return answer;
  };

  // Every scenario starts from fresh modules: empty client caches, as on a first visit.
  vi.resetModules();
  const { default: OrderPlanningScreen } = await import('@/features/planning/components/OrderPlanningScreen');

  // Every toast that reaches the screen during a step, in order ("<type>: <text>").
  let toastsSeen: string[] = [];
  let lastToast = '';
  const checkToast = () => {
    const t = readToast(document.body);
    const key = t ? `${t.type}: ${t.text}` : '';
    if (key && key !== lastToast) toastsSeen.push(key);
    lastToast = key;
  };
  const observer = new MutationObserver(checkToast);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });

  const steps: StepRecord[] = [];
  let mounted: ReturnType<typeof render> | null = null;
  let prev: PageState | null = null;

  const scriptLoad = (s: { replyDetail?: ScriptedReply; replyDropdowns?: ScriptedReply }) => {
    if (s.replyDetail) server.scriptNext('detail', s.replyDetail);
    if (s.replyDropdowns) server.scriptNext('dropdowns', s.replyDropdowns);
  };

  try {
    for (let i = 0; i < sc.steps.length; i++) {
      const step = sc.steps[i];
      const rec: StepRecord = { n: i + 1, step };
      const logStart = server.log.length;
      const routerStart = harness.routerCalls.length;
      const confirmStart = confirmLog.length;
      toastsSeen = [];
      checkToast();
      toastsSeen = [];

      try {
        switch (step.do) {
          case 'load': {
            if (mounted) throw new Error('load: the page is already mounted');
            scriptLoad(step as Loose);
            mounted = render(<OrderPlanningScreen />);
            rec.initial = readPage(document.body);
            break;
          }
          case 'reopen': {
            if (!mounted) throw new Error('reopen: nothing mounted');
            mounted.unmount();
            scriptLoad(step);
            mounted = render(<OrderPlanningScreen />);
            rec.initial = readPage(document.body);
            break;
          }
          case 'set': {
            const el = findField(step.row, step.field);
            const problem = !el
              ? `no field "${step.field}" in row ${step.row}`
              : (el as HTMLInputElement).disabled
                ? `"${step.field}" in row ${step.row} is disabled`
                : null;
            if (problem && step.optional) {
              rec.skipped = problem;
              break;
            }
            if (problem || !el) throw new Error(`set: ${problem}`);
            fireEvent.change(el, { target: { value: step.value } });
            break;
          }
          case 'type': {
            // One change per character, as a keyboard produces (the page reacts to onChange only).
            // user-event is not used: RTL's asyncWrapper waits on a setTimeout that Vitest's fake timers never run.
            for (const ch of step.text) {
              const el = findField(step.row, step.field);
              if (!el) throw new Error(`type: no field "${step.field}" in row ${step.row}`);
              if ((el as HTMLInputElement).disabled) throw new Error(`type: "${step.field}" in row ${step.row} is disabled`);
              fireEvent.change(el, { target: { value: el.value + ch } });
            }
            break;
          }
          case 'status': {
            // The General Information select: the route department's Order Status (SPEC section 5).
            const el = document.querySelector('[data-general-info] [data-field="orderStatus"]') as HTMLSelectElement | null;
            if (!el) throw new Error('status: no Order Status select');
            fireEvent.change(el, { target: { value: step.value } });
            break;
          }
          case 'save': {
            (step.confirm || []).forEach((a) => confirmAnswers.push(a));
            if (step.reply) server.scriptNext('saveDates', step.reply);
            const btn = saveButtonFor(sc.dept, step.via);
            if (!btn) throw new Error('save: no save button');
            if (btn.disabled) throw new Error('save: the save button is disabled');
            fireEvent.click(btn);
            break;
          }
          case 'back': {
            const btn =
              step.via === 'header'
                ? buttonByText('Back')
                : step.via === 'footer'
                  ? buttonByText('Cancel')
                  : (document.querySelector('button[title="Go Back"]') as HTMLButtonElement | null);
            if (!btn) throw new Error('back: button not found');
            leaving = true;
            try {
              fireEvent.click(btn);
            } finally {
              leaving = false;
            }
            break;
          }
          case 'release': {
            if (server.heldCount === 0) throw new Error('release: no held reply');
            server.releaseHeld();
            break;
          }
          case 'wait': {
            await act(async () => {
              await vi.advanceTimersByTimeAsync(step.ms);
            });
            break;
          }
          default:
            throw new Error(`unknown step ${JSON.stringify(step)}`);
        }
      } catch (err) {
        errors.push(`step ${i + 1} (${step.do}): ${(err as Error).message}`);
      }

      await settle();
      checkToast();
      observer.takeRecords();

      if (confirmAnswers.length > 0) {
        errors.push(`step ${i + 1}: ${confirmAnswers.length} scripted confirm answer(s) not used`);
        confirmAnswers.length = 0;
      }
      // A scripted reply belongs to its own step: one left over (e.g. the save was refused before its request)
      // would otherwise answer a later request.
      const pending = server.pendingScripts();
      if (pending.length > 0) {
        errors.push(`step ${i + 1}: scripted server replies not used: ${pending.join(', ')}`);
      }

      const events: NonNullable<StepRecord['events']> = {};
      if (toastsSeen.length) events.toasts = toastsSeen;
      const confirms = confirmLog.slice(confirmStart);
      if (confirms.length) events.confirms = confirms;
      const requests = server.log
        .slice(logStart)
        .filter((r) => !isPlanningGuideRequest(r))
        .map(legacyRequest);
      if (requests.length) events.requests = requests;
      const router = harness.routerCalls.slice(routerStart);
      if (router.length) events.router = router;
      if (Object.keys(events).length) rec.events = events;

      const page = readPage(document.body);
      if (prev === null) rec.state = page;
      else rec.changes = diffStates(prev, page);
      prev = page;
      steps.push(rec);

      // Time passes before the next action, so the 3.8 s toast of this step is gone by then.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEFAULT_GAP_MS);
      });
    }
    const pending = server.pendingScripts();
    if (pending.length > 0) errors.push(`scripted server replies never used: ${pending.join(', ')}`);
    if (server.heldCount > 0) errors.push(`${server.heldCount} held reply(ies) never released`);
  } finally {
    observer.disconnect();
    cleanup();
    window.confirm = originalConfirm;
    delete (window.history as unknown as { length?: number }).length;
    harness.fetchHandler = null;
    vi.useRealTimers();
  }

  const recording: Recording = {
    scenario: sc.id,
    fixture: sc.fixture,
    dept: sc.dept,
    role: sc.role,
    orderNo,
    rules: sc.rules,
    note: sc.note,
    steps,
  };
  if (errors.length) recording.harnessErrors = errors;
  return recording;
}
