import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import { MockServer, type LoggedRequest } from '../harness/mock-server';
import { FIXED_NOW, ROLE_STORAGE } from '../harness/runner';
import { readToast } from '../harness/snapshot';
import { resetHarnessState } from '../harness/state';
import type { Fixture, Loose, RoleName } from '../harness/types';

/*
 * A small driver for the universal order page's own tests (tests/c2): it opens the page on the mocked server, lets a
 * test act on any section and reads what the page shows. Same set-up as the golden runner (fake clock, stored login,
 * scripted window.confirm, fresh modules per page), but free-form.
 */

export interface PageDriver {
  server: MockServer;
  /** Every toast seen since the page opened, "<type>: <text>". */
  toasts: string[];
  /** Every window.confirm message, in order. */
  confirms: string[];
  /** Answers for the next window.confirm calls (an unscripted confirm answers false and is recorded in `errors`). */
  answer: (...answers: boolean[]) => void;
  errors: string[];
  settle: () => Promise<void>;
  /** Advances the fake clock. */
  wait: (ms: number) => Promise<void>;
  section: (key: string) => HTMLElement;
  field: (key: string, row: number, name: string) => HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  set: (key: string, row: number, name: string, value: string) => Promise<void>;
  setStatus: (key: string, value: string) => Promise<void>;
  /** The General Information Order Status select. */
  generalStatus: () => HTMLSelectElement;
  click: (el: Element | null) => Promise<void>;
  saveSection: (key: string) => Promise<void>;
  saveData: () => Promise<void>;
  discard: (key: string) => Promise<void>;
  toggle: (key: string) => Promise<void>;
  pills: (key: string) => string[];
  saveDataButton: () => HTMLButtonElement;
  /** POST save-plans requests sent so far. */
  savePlansRequests: () => LoggedRequest[];
  /** Unmounts the page and opens `dept`'s page of the same order (warm caches, same server). */
  reopen: (dept?: string) => Promise<void>;
  close: () => void;
}

export async function openPage(opts: { fixture: Fixture; dept: string; role: RoleName; orderNo?: string }): Promise<PageDriver> {
  vi.useFakeTimers({ now: FIXED_NOW, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  localStorage.clear();
  sessionStorage.clear();
  const orderNo = opts.orderNo ?? opts.fixture.orderNo;
  let harness = resetHarnessState({ dept: opts.dept, orderNo }, `/planning/${opts.dept}/${encodeURIComponent(orderNo)}`);
  const server = new MockServer(opts.fixture);
  harness.fetchHandler = server.fetch;
  Object.entries(ROLE_STORAGE[opts.role]).forEach(([k, v]) => localStorage.setItem(k, v));
  Object.defineProperty(window.history, 'length', { configurable: true, get: () => 1 });

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
  const { default: OrderPlanningScreen } = await import('@/features/planning/components/OrderPlanningScreen');
  let mounted = render(<OrderPlanningScreen />);

  const settle = async () => {
    for (let i = 0; i < 4; i++) {
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

  const driver: PageDriver = {
    server,
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
    setStatus: async (key, value) => {
      const el = section(key).querySelector('[data-field="orderStatus"]');
      if (!el) throw new Error(`no Order Status in ${key}`);
      fireEvent.change(el, { target: { value } });
      await settle();
    },
    generalStatus: () => document.querySelector('[data-general-info] [data-field="orderStatus"]') as HTMLSelectElement,
    click,
    saveSection: (key) => click(section(key).querySelector('[data-action="save-section"]')),
    saveData: () => click(document.querySelector('[data-action="save-data"]')),
    discard: (key) => click(section(key).querySelector('[data-action="discard"]')),
    toggle: (key) => click(section(key).querySelector('[data-action="toggle-section"]')),
    pills: (key) => Array.from(section(key).querySelectorAll('[data-pill]')).map((p) => p.textContent?.trim() || ''),
    saveDataButton: () => document.querySelector('[data-action="save-data"]') as HTMLButtonElement,
    savePlansRequests: () => server.log.filter((r) => r.method === 'POST' && r.url === '/api/orders/save-plans'),
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
  return driver;
}

/** The rows of one plan table as the user sees them: each row's field values (and disabled state). */
export function tableValues(root: HTMLElement): Array<Record<string, string>> {
  return Array.from(root.querySelectorAll('[data-plan-table] tbody > tr[data-row]')).map((tr) => {
    const out: Record<string, string> = {};
    tr.querySelectorAll('[data-field]').forEach((el) => {
      out[el.getAttribute('data-field') as string] = (el as HTMLInputElement).value;
    });
    return out;
  });
}

/** A deep copy with every `updatedAt` / `createdAt` removed (to compare stored documents). */
export function withoutTimes(value: Loose): Loose {
  return JSON.parse(JSON.stringify(value, (k, v) => (k === 'updatedAt' || k === 'createdAt' ? undefined : v)));
}
