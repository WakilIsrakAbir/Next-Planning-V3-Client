import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import { MockServer, TEST_TOKEN, type FakeResponse } from '../harness/mock-server';
import { FIXED_NOW, ROLE_STORAGE } from '../harness/runner';
import { readToast } from '../harness/snapshot';
import { resetHarnessState } from '../harness/state';
import type { Fixture, Loose, RoleName } from '../harness/types';
import { GuideServer } from '../plan-guide/guide-server';
import { STANDARD, type Item, type MockUser } from '../plan-check-list/mock-server';

/*
 * The universal order page with its Checkpoint & Planning Guide card (SPEC C34-int), on one in-memory server:
 * - orders, plans, save-plans, dropdowns: tests/harness/mock-server.ts (the port of the plan server);
 * - GET /api/plan-check-list and PUT /api/orders/:orderNo/plan-guide: tests/plan-guide/guide-server.ts (the port of
 *   the Plan Check List and guide services);
 * - GET /api/orders/:orderNo answers the plan server's details with the stored guide (`guide`), as the real
 *   getOrderDetails does. A scripted detail reply keeps its own `guide` (null is replaced by the stored one).
 * The guide's T&A snapshot is taken from the Order as the plan server holds it at the moment of the PUT.
 */

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const USERS: Partial<Record<RoleName, MockUser>> = {
  admin: { username: 'admin', role: 'Admin', permissions: {} },
  planner: { username: 'planner1', role: 'Planner', permissions: {} },
};

export class GuidePageServer {
  readonly plans: MockServer;
  readonly guides: GuideServer;
  /** Every request in order: "METHOD /path?query". */
  readonly log: string[] = [];

  constructor(fixture: Fixture, options: { list?: Item[]; user: MockUser }) {
    this.plans = new MockServer(fixture);
    this.guides = new GuideServer({ list: options.list ?? STANDARD });
    this.guides.addUser(TEST_TOKEN, options.user);
    for (const order of this.plans.db.orders) this.guides.addOrder(order);
  }

  /** The Order (T&A fields) as the plan server holds it; tests change it to play a General upload. */
  order(orderNo: string): Loose {
    return this.plans.db.orders.find((o) => o.orderNo === orderNo);
  }

  fetch = async (input: unknown, init: unknown): Promise<Loose> => {
    const url = new URL(String(input));
    const method = (((init || {}) as { method?: string }).method || 'GET').toUpperCase();
    this.log.push(`${method} ${url.pathname}${url.search}`);
    if (url.pathname.startsWith('/api/plan-check-list')) return this.guides.handle(input, init);
    const guideMatch = /^\/api\/orders\/([^/]+)\/plan-guide$/.exec(url.pathname);
    if (guideMatch) {
      const order = this.order(decodeURIComponent(guideMatch[1]));
      if (order) this.guides.addOrder(order);
      return this.guides.handle(input, init);
    }
    const response = (await this.plans.fetch(input, init)) as FakeResponse;
    if (method !== 'GET' || !/^\/api\/orders\/[^/]+$/.test(url.pathname) || !response.ok) return response;
    const body = await response.json();
    if (body && typeof body === 'object' && body.guide === null) {
      const stored = this.guides.guides.get(decodeURIComponent(url.pathname.slice('/api/orders/'.length)));
      body.guide = stored ? clone(stored) : null;
    }
    const text = JSON.stringify(body);
    return { ok: response.ok, status: response.status, json: async () => JSON.parse(text), text: async () => text };
  };

  /** Requests whose "METHOD /path" starts with `prefix`. */
  requests(prefix: string): string[] {
    return this.log.filter((line) => line.startsWith(prefix));
  }
}

type PageModules = {
  cache: typeof import('@/features/planning/lib/planning-cache');
  guard: typeof import('@/lib/unsaved-changes');
};

export interface GuidePage {
  server: GuidePageServer;
  modules: PageModules;
  orderNo: string;
  /** Every toast seen since the page opened, "<type>: <text>" (the page's toasts come first in the DOM). */
  toasts: string[];
  confirms: string[];
  answer: (...answers: boolean[]) => void;
  errors: string[];
  settle: () => Promise<void>;
  wait: (ms: number) => Promise<void>;
  section: (key: string) => HTMLElement;
  field: (key: string, row: number, name: string) => HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  set: (key: string, row: number, name: string, value: string) => Promise<void>;
  saveSection: (key: string) => Promise<void>;
  saveData: () => Promise<void>;
  saveDataButton: () => HTMLButtonElement;
  pills: (key: string) => string[];
  click: (el: Element | null) => Promise<void>;
  /** The Checkpoint & Planning Guide card. */
  card: () => HTMLElement;
  cardInput: (label: string) => HTMLInputElement;
  cardSelect: (name: string) => HTMLSelectElement;
  setYes: (name: string, yes: boolean) => Promise<void>;
  setCardDate: (label: string, value: string) => Promise<void>;
  saveGuide: () => Promise<void>;
  cardPills: () => string[];
  /** Opens `dept`'s page of the same order (warm caches, same server). */
  reopen: (dept?: string) => Promise<void>;
  close: () => void;
}

export async function openGuidePage(opts: {
  fixture: Fixture;
  dept: string;
  role?: RoleName;
  orderNo?: string;
  list?: Item[];
  /** Runs before the page is rendered (e.g. to script the first replies). */
  before?: (server: GuidePageServer) => void;
}): Promise<GuidePage> {
  const role = opts.role ?? 'admin';
  vi.useFakeTimers({ now: FIXED_NOW, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  localStorage.clear();
  sessionStorage.clear();
  const orderNo = opts.orderNo ?? opts.fixture.orderNo;
  const server = new GuidePageServer(opts.fixture, { list: opts.list, user: USERS[role] as MockUser });
  let harness = resetHarnessState({ dept: opts.dept, orderNo }, `/planning/${opts.dept}/${encodeURIComponent(orderNo)}`);
  harness.fetchHandler = server.fetch;
  Object.entries(ROLE_STORAGE[role]).forEach(([k, v]) => localStorage.setItem(k, v));
  Object.defineProperty(window.history, 'length', { configurable: true, get: () => 1 });
  opts.before?.(server);

  const errors: string[] = [];
  const confirms: string[] = [];
  const answers: boolean[] = [];
  const originalConfirm = window.confirm;
  window.confirm = (message?: string) => {
    confirms.push(String(message));
    const a = answers.shift();
    if (a === undefined) {
      errors.push(`Unscripted window.confirm: ${message}`);
      return false;
    }
    return a;
  };

  const toasts: string[] = [];
  let last = '';
  const observer = new MutationObserver(() => {
    const t = readToast(document.body);
    const key = t ? `${t.type}: ${t.text}` : '';
    if (key && key !== last) toasts.push(key);
    last = key;
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });

  vi.resetModules();
  const OrderPlanningScreen = (await import('@/features/planning/components/OrderPlanningScreen')).default;
  const modules: PageModules = {
    cache: await import('@/features/planning/lib/planning-cache'),
    guard: await import('@/lib/unsaved-changes'),
  };
  let mounted = render(<OrderPlanningScreen />);

  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await new Promise<void>((resolve) => setImmediate(resolve));
        await vi.advanceTimersByTimeAsync(0);
      });
    }
    observer.takeRecords();
  };
  await settle();

  const section = (key: string) => {
    const el = document.querySelector(`[data-plan-section="${key}"]`) as HTMLElement | null;
    if (!el) throw new Error(`no section ${key}`);
    return el;
  };
  const field = (key: string, row: number, name: string) => {
    const el = section(key).querySelector(`[data-plan-table] [data-row="${row}"] [data-field="${name}"]`);
    if (!el) throw new Error(`no field ${name} in row ${row} of ${key}`);
    return el as HTMLInputElement;
  };
  const click = async (el: Element | null) => {
    if (!el) throw new Error('click: no element');
    fireEvent.click(el);
    await settle();
  };
  const card = () => {
    const el = document.querySelector('[data-planning-guide]') as HTMLElement | null;
    if (!el) throw new Error('no Planning Guide card');
    return el;
  };
  const cardInput = (label: string) => {
    const el = card().querySelector(`input[aria-label="${label}"]`) as HTMLInputElement | null;
    if (!el) throw new Error(`no guide input ${label}`);
    return el;
  };
  const cardSelect = (name: string) => {
    const el = card().querySelector(`select[aria-label="${name}: Yes or No"]`) as HTMLSelectElement | null;
    if (!el) throw new Error(`no guide select ${name}`);
    return el;
  };

  return {
    server,
    modules,
    orderNo,
    toasts,
    confirms,
    errors,
    answer: (...a) => answers.push(...a),
    settle,
    wait: async (ms) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    },
    section,
    field,
    set: async (key, row, name, value) => {
      fireEvent.change(field(key, row, name), { target: { value } });
      await settle();
    },
    saveSection: (key) => click(section(key).querySelector('[data-action="save-section"]')),
    saveData: () => click(document.querySelector('[data-action="save-data"]')),
    saveDataButton: () => document.querySelector('[data-action="save-data"]') as HTMLButtonElement,
    pills: (key) => Array.from(section(key).querySelectorAll('[data-pill]')).map((p) => p.textContent?.trim() || ''),
    click,
    card,
    cardInput,
    cardSelect,
    setYes: async (name, yes) => {
      fireEvent.change(cardSelect(name), { target: { value: yes ? 'Yes' : 'No' } });
      await settle();
    },
    setCardDate: async (label, value) => {
      fireEvent.change(cardInput(label), { target: { value } });
      await settle();
    },
    saveGuide: () => click(card().querySelector('[data-action="save-guide"]')),
    cardPills: () => Array.from(card().querySelectorAll('[data-pill]')).map((p) => p.textContent?.trim() || ''),
    reopen: async (dept) => {
      mounted.unmount();
      if (dept) {
        harness = resetHarnessState({ dept, orderNo }, `/planning/${dept}/${encodeURIComponent(orderNo)}`);
        harness.fetchHandler = server.fetch;
      }
      mounted = render(<OrderPlanningScreen />);
      await settle();
    },
    close: () => {
      observer.disconnect();
      cleanup();
      window.confirm = originalConfirm;
      delete (window.history as unknown as { length?: number }).length;
      harness.fetchHandler = null;
      vi.useRealTimers();
    },
  };
}
