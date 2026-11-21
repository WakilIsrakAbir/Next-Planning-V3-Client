import type { Loose } from './types';

// State of the running scenario, kept on globalThis: every scenario re-imports the page with fresh modules
// (vi.resetModules), while the next/navigation mock and the fetch guard (tests/setup/setup.ts) must reach it.

export interface RouterCall {
  fn: string;
  args: Loose[];
}

export interface HarnessState {
  params: Record<string, string>;
  pathname: string;
  router: Record<'push' | 'replace' | 'back' | 'forward' | 'refresh' | 'prefetch', (...args: Loose[]) => void>;
  routerCalls: RouterCall[];
  fetchHandler: ((input: unknown, init: unknown) => Promise<Loose>) | null;
}

const KEY = '__OPS_GOLDEN_HARNESS__';

function createRouter(calls: RouterCall[]): HarnessState['router'] {
  const record =
    (fn: string) =>
    (...args: Loose[]) => {
      calls.push({ fn, args });
    };
  return {
    push: record('push'),
    replace: record('replace'),
    back: record('back'),
    forward: record('forward'),
    refresh: record('refresh'),
    prefetch: record('prefetch'),
  };
}

export function harnessState(): HarnessState {
  const g = globalThis as unknown as Record<string, HarnessState | undefined>;
  if (!g[KEY]) {
    const routerCalls: RouterCall[] = [];
    g[KEY] = { params: {}, pathname: '/', router: createRouter(routerCalls), routerCalls, fetchHandler: null };
  }
  return g[KEY] as HarnessState;
}

/** Starts a scenario: new params, a new (stable for the scenario) router, no fetch handler yet. */
export function resetHarnessState(params: Record<string, string>, pathname: string): HarnessState {
  const state = harnessState();
  const routerCalls: RouterCall[] = [];
  state.params = params;
  state.pathname = pathname;
  state.routerCalls = routerCalls;
  state.router = createRouter(routerCalls);
  state.fetchHandler = null;
  return state;
}
