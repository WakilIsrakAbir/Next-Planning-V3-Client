// @vitest-environment-options {"url": "http://plan-check-list.test/planning/knitting/1001"}
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harnessState } from '../harness/state';
import { ADMIN, LIST_URL, PLANNER, PlanCheckListServer, SESSION_KEYS, STANDARD, signIn } from './mock-server';

// The shared Plan Check List module (src/features/management/lib/plan-check-list.ts): the one cached copy that the
// Plan Check List page and the order pages read, its requests and its sign-out rules.

const TOKEN = 'test-token';
const PAGE_HREF = 'http://plan-check-list.test/planning/knitting/1001';

type Data = typeof import('@/features/management/lib/plan-check-list');

async function freshData(): Promise<Data> {
  vi.resetModules();
  return import('@/features/management/lib/plan-check-list');
}

let server: PlanCheckListServer;
let location: { href: string; pathname: string };

beforeEach(() => {
  server = new PlanCheckListServer().install();
  signIn(TOKEN, ADMIN);
  server.addUser(TOKEN, ADMIN);
  location = { href: PAGE_HREF, pathname: '/planning/knitting/1001' };
  vi.stubGlobal('location', location);
});

afterEach(() => {
  harnessState().fetchHandler = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const names = (list: { items: Array<{ name: string }> } | null) => (list ? list.items.map((item) => item.name) : null);

describe('loadPlanCheckList and the shared copy', () => {
  it('GET with the bearer token and no-store; the answer becomes the shared copy and tells subscribers', async () => {
    const data = await freshData();
    const calls: Array<{ url: string; init: RequestInit }> = [];
    harnessState().fetchHandler = (input, init) => {
      calls.push({ url: String(input), init: init as RequestInit });
      return server.handle(input, init);
    };
    expect(data.getCachedPlanCheckList()).toBeNull();
    const told = vi.fn();
    const unsubscribe = data.subscribePlanCheckList(told);

    const list = await data.loadPlanCheckList();
    expect(calls).toEqual([
      { url: LIST_URL, init: { method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` }, body: undefined, cache: 'no-store' } },
    ]);
    expect(list).toEqual({
      items: STANDARD,
      version: 1,
      updatedBy: 'system',
      updatedAt: '2026-11-21T00:00:00.000Z',
      defaults: STANDARD,
      canEdit: true,
      usage: Object.fromEntries(STANDARD.map((item) => [item.id, 0])),
    });
    expect(data.getCachedPlanCheckList()).toBe(list);
    expect(told).toHaveBeenCalledTimes(1);
    unsubscribe();
    await data.loadPlanCheckList({ fresh: true });
    expect(told).toHaveBeenCalledTimes(1);
  });

  it('requests made while one runs share it; a copy younger than a minute is used as it is; fresh always asks', async () => {
    const data = await freshData();
    const [a, b] = await Promise.all([data.loadPlanCheckList(), data.loadPlanCheckList()]);
    expect(a).toBe(b);
    expect(server.requests()).toHaveLength(1);

    await data.loadPlanCheckList();
    expect(server.requests()).toHaveLength(1);
    await data.loadPlanCheckList({ fresh: true });
    expect(server.requests()).toHaveLength(2);

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + data.PLAN_CHECK_LIST_MAX_AGE_MS + 1);
    await data.loadPlanCheckList();
    expect(server.requests()).toHaveLength(3);
  });

  it('a read that a save overtook does not replace the newer saved copy', async () => {
    const data = await freshData();
    const first = await data.loadPlanCheckList();
    expect(first.version).toBe(1);

    // a background read leaves (it reads version 1), then the page saves version 2 before that read's answer arrives
    const release = server.holdNext();
    const slowRead = data.loadPlanCheckList({ fresh: true });
    const saved = await data.savePlanCheckList(
      STANDARD.map((item) => (item.id === 'cpb' ? { ...item, startDays: 13 } : item)),
      1
    );
    expect(saved.version).toBe(2);
    release();
    const read = await slowRead;
    expect(read).toBe(saved);
    expect(data.getCachedPlanCheckList()).toBe(saved);

    // a read that started after the save is taken as it is
    const later = await data.loadPlanCheckList({ fresh: true });
    expect(later.version).toBe(2);
    expect(data.getCachedPlanCheckList()).toBe(later);
  });

  it('savePlanCheckList sends {items, version} as JSON and replaces the shared copy with the stored list', async () => {
    const data = await freshData();
    await data.loadPlanCheckList();
    const calls: RequestInit[] = [];
    harnessState().fetchHandler = (input, init) => {
      calls.push(init as RequestInit);
      return server.handle(input, init);
    };
    const told = vi.fn();
    data.subscribePlanCheckList(told);
    const saved = await data.savePlanCheckList([{ name: ' New  one ', startDays: 2, endDays: 1, active: false }], 1);
    expect(calls).toEqual([
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ name: ' New  one ', startDays: 2, endDays: 1, active: false }], version: 1 }),
        cache: 'no-store',
      },
    ]);
    expect(saved.version).toBe(2);
    expect(saved.items).toEqual([{ id: expect.stringMatching(/^chk_[0-9a-f]{24}$/), name: 'New one', startDays: 2, endDays: 1, active: false }]);
    expect(data.getCachedPlanCheckList()).toBe(saved);
    expect(told).toHaveBeenCalledTimes(1);
  });
});

describe('errors and the sign-out rules', () => {
  async function failure(run: () => Promise<unknown>) {
    try {
      await run();
    } catch (err) {
      return err as { name: string; message: string; status: number; code: string };
    }
    throw new Error('expected the request to fail');
  }
  const signedIn = () => SESSION_KEYS.every((key) => localStorage.getItem(key) !== null);

  it('403 PERMISSION: the server message, code PERMISSION, still signed in; nothing replaces the shared copy', async () => {
    const data = await freshData();
    signIn(TOKEN, PLANNER);
    server.addUser(TOKEN, PLANNER);
    const list = await data.loadPlanCheckList();
    expect(list.canEdit).toBe(false);
    expect('usage' in list).toBe(false);
    const err = await failure(() => data.savePlanCheckList(STANDARD, 1));
    expect(err).toMatchObject({
      name: 'PlanCheckListError',
      status: 403,
      code: 'PERMISSION',
      message: 'Access forbidden: Plan Check List permission required.',
    });
    expect(err instanceof data.PlanCheckListError).toBe(true);
    expect(signedIn()).toBe(true);
    expect(location.href).toBe(PAGE_HREF);
    expect(data.getCachedPlanCheckList()).toBe(list);
  });

  it('401 (no token, a bad token, an expired session) signs out and opens /login?expired=true', async () => {
    for (const [prepare, status] of [
      [() => server.users.clear(), 401],
      [() => localStorage.removeItem('token'), 401],
    ] as Array<[() => void, number]>) {
      const data = await freshData();
      signIn(TOKEN, ADMIN);
      server.addUser(TOKEN, ADMIN);
      location.href = PAGE_HREF;
      prepare();
      const err = await failure(() => data.loadPlanCheckList());
      expect(err).toMatchObject({ status, code: 'SESSION', message: 'Your session has ended. Please log in again.' });
      expect(SESSION_KEYS.filter((key) => localStorage.getItem(key) !== null)).toEqual([]);
      expect(location.href).toBe('/login?expired=true');
    }
  });

  it('a 403 without code PERMISSION (inactive account) signs out', async () => {
    const data = await freshData();
    server.addUser(TOKEN, { ...ADMIN, status: 'inactive' });
    const err = await failure(() => data.savePlanCheckList(STANDARD, 1));
    expect(err).toMatchObject({ status: 403, code: 'SESSION' });
    expect(SESSION_KEYS.filter((key) => localStorage.getItem(key) !== null)).toEqual([]);
    expect(location.href).toBe('/login?expired=true');
  });

  it('400 and 409 carry the server code and message; 500, no network, an older server and a bad answer get clear text', async () => {
    const data = await freshData();
    await data.loadPlanCheckList();
    expect(await failure(() => data.savePlanCheckList([{ name: 'X', startDays: -1, endDays: 0, active: true }], 1))).toMatchObject({
      status: 400,
      code: 'INVALID',
      message: 'Row 1 (X): Start days must be a whole number from 0 to 365.',
    });
    server.saveDirectly(STANDARD.slice(0, 2), 'planner1');
    expect(await failure(() => data.savePlanCheckList(STANDARD, 1))).toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'The Plan Check List was changed by planner1 at 21-Nov-2026 06:01. Reload the page to see the latest values.',
    });
    server.scriptNext({ status: 500, json: { message: 'Could not save the Plan Check List.' } });
    expect(await failure(() => data.savePlanCheckList(STANDARD, 2))).toMatchObject({ status: 500, code: '', message: 'Could not save the Plan Check List.' });
    server.scriptNext({ status: 502, text: '<html>Bad gateway</html>' });
    expect(await failure(() => data.loadPlanCheckList({ fresh: true }))).toMatchObject({ status: 502, message: 'Server error 502.' });
    server.scriptNext({ networkError: true });
    expect(await failure(() => data.loadPlanCheckList({ fresh: true }))).toMatchObject({
      status: 0,
      code: 'NETWORK',
      message: 'Cannot reach the server (http://api.test). Check the connection and try again.',
    });
    server.scriptNext({ status: 404, text: '<!DOCTYPE html><html><body><pre>Cannot GET /api/plan-check-list</pre></body></html>' });
    expect(await failure(() => data.loadPlanCheckList({ fresh: true }))).toMatchObject({
      status: 404,
      code: 'NOT_DEPLOYED',
      message: 'This server does not have the Plan Check List yet. Deploy the updated Next Planning V3 server, then reload this page.',
    });
    server.scriptNext({ status: 200, json: { message: 'ok' } });
    expect(await failure(() => data.loadPlanCheckList({ fresh: true }))).toMatchObject({
      message: 'The server sent an unexpected answer for the Plan Check List.',
    });
    expect(location.href).toBe(PAGE_HREF);
    expect(signedIn()).toBe(true);
    // none of the failures replaced the shared copy
    expect(data.getCachedPlanCheckList()?.version).toBe(1);
  });
});

describe('usePlanCheckList (what order pages use)', () => {
  it('loads once, shows the shared copy, and draws again when the list is saved elsewhere in the tab', async () => {
    const data = await freshData();
    const seen: Array<string[] | null> = [];
    function OrderPageGuide() {
      const { list, error } = data.usePlanCheckList();
      seen.push(names(list));
      return (
        <div>
          <span data-testid="names">{list ? list.items.map((item) => `${item.name} ${item.startDays}/${item.endDays}`).join(', ') : 'none'}</span>
          <span data-testid="error">{error}</span>
        </div>
      );
    }
    const view = render(<OrderPageGuide />);
    expect(screen.getByTestId('names').textContent).toBe('none');
    await waitFor(() => expect(screen.getByTestId('names').textContent).toContain('Heatset 10/7'));
    expect(server.requests()).toHaveLength(1);

    // the Plan Check List page saves (in the same tab): the order page draws the new values without a request
    await act(async () => {
      await data.savePlanCheckList(
        STANDARD.map((item) => (item.id === 'heatset' ? { ...item, name: 'Heatset (HT)', startDays: 11 } : item)),
        1
      );
    });
    expect(screen.getByTestId('names').textContent).toContain('Heatset (HT) 11/7');
    expect(server.requests('GET')).toHaveLength(1);
    view.unmount();

    // a page opened within the minute uses the shared copy at once, without a request
    render(<OrderPageGuide />);
    expect(screen.getByTestId('names').textContent).toContain('Heatset (HT) 11/7');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(server.requests('GET')).toHaveLength(1);
    expect(seen[0]).toBeNull();
  });

  it('a failed load gives the error text (and no sign-out for a server error)', async () => {
    const data = await freshData();
    server.scriptNext({ status: 500, json: { message: 'Could not load the Plan Check List.' } });
    function Guide() {
      const { list, error } = data.usePlanCheckList();
      return <span data-testid="state">{list ? 'list' : `none: ${error}`}</span>;
    }
    render(<Guide />);
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('none: Could not load the Plan Check List.'));
    expect(location.href).toBe(PAGE_HREF);
  });
});
