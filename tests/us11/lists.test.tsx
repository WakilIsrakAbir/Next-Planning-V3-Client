import type { AnchorHTMLAttributes } from 'react';
import { Suspense } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harnessState, resetHarnessState } from '../harness/state';
import { signIn, type MockUser } from '../plan-check-list/mock-server';

// US-11: the Delivery Plan (Floor) / (Lock) menus and permissions, their list pages, and the search across all lists.

vi.mock('next/link', async () => {
  const React = await import('react');
  type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate?: unknown; prefetch?: unknown };
  function Link({ href, children, onNavigate, prefetch, ...rest }: LinkProps) {
    void onNavigate;
    void prefetch;
    return React.createElement('a', { ...rest, href }, children);
  }
  return { default: Link, useLinkStatus: () => ({ pending: false }) };
});

afterEach(() => {
  harnessState().fetchHandler = null;
  sessionStorage.clear();
});

describe('Sidebar: Order Management delivery items', () => {
  async function orderManagementLinks(user: MockUser): Promise<Array<[string, string | null]>> {
    signIn('test-token', user);
    harnessState().fetchHandler = async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    vi.resetModules();
    const { default: Sidebar } = await import('@/components/layout/Sidebar');
    const view = render(<Sidebar isOpen onToggle={() => {}} onCloseMobile={() => {}} />);
    await screen.findByText(user.username);
    const groupButton = screen.queryByRole('button', { name: 'Order Management' });
    if (!groupButton) {
      view.unmount();
      return [];
    }
    if (!within(groupButton.parentElement as HTMLElement).queryByText(/Plan/)) fireEvent.click(groupButton);
    const group = groupButton.parentElement as HTMLElement;
    const entries = Array.from(group.querySelectorAll('a'))
      .map((el): [string, string | null] => [(el.textContent || '').trim(), el.getAttribute('href')])
      .filter(([, href]) => Boolean(href && href.startsWith('/planning/')));
    view.unmount();
    return entries;
  }

  beforeEach(() => {
    harnessState().pathname = '/dashboard';
  });

  it('Floor above Lock in the Delivery position; the old Delivery Plan item is gone', async () => {
    const links = await orderManagementLinks({ username: 'admin', role: 'Admin', permissions: {} });
    expect(links.map(([, href]) => href)).toEqual([
      '/planning/yd',
      '/planning/knitting',
      '/planning/dyeing',
      '/planning/finishing',
      '/planning/deliveryfloor',
      '/planning/deliverylock',
    ]);
    expect(links.slice(4).map(([label]) => label)).toEqual(['Delivery Plan (Floor)', 'Delivery Plan (Lock)']);
  });

  it('a user without the new keys falls back to `delivery`; a set key wins', async () => {
    const om = (orderManagement: Record<string, boolean>): MockUser => ({ username: 'planner1', role: 'Planner', permissions: { menus: { orderManagement } } });
    const delivery = async (u: MockUser) => (await orderManagementLinks(u)).map(([, href]) => href).filter((h) => h?.includes('delivery'));
    expect(await delivery(om({ delivery: true }))).toEqual(['/planning/deliveryfloor', '/planning/deliverylock']);
    expect(await delivery(om({ knitting: true }))).toEqual([]);
    expect(await delivery(om({ delivery: true, deliveryFloor: false }))).toEqual(['/planning/deliverylock']);
    expect(await delivery(om({ delivery: false, deliveryLock: true }))).toEqual(['/planning/deliverylock']);
  });
});

describe('list pages: Floor / Lock titles and the search across all lists', () => {
  type Req = { url: string };
  const requests: Req[] = [];

  async function openList(dept: string) {
    requests.length = 0;
    resetHarnessState({ dept }, `/planning/${dept}`);
    signIn('test-token', { username: 'planner1', role: 'Planner', permissions: {} });
    sessionStorage.setItem(
      `dept_state_v2_${dept}`,
      JSON.stringify({ page: 1, limit: 10, activeTab: 'Pending', activeBuyer: '', globalSearch: '', colSearchOrder: '', colSearchDate: '', colSearchBuyer: '', colSearchStatus: '' })
    );
    harnessState().fetchHandler = async (input: unknown) => {
      const url = String(input);
      requests.push({ url });
      const q = new URL(url).searchParams;
      const all = q.get('scope') === 'all';
      const orders = all
        ? [
            { _id: '1', orderNo: 'B-100', buyer: 'X', [`${dept}PlanStatus`]: 'Confirm', status: 'Running' },
            { _id: '2', orderNo: 'B-101', buyer: 'Y', [`${dept}PlanStatus`]: 'Completed', status: 'Running' },
          ]
        : [{ _id: '3', orderNo: 'P-1', buyer: 'Z', status: 'Running' }];
      return new Response(JSON.stringify({ orders, total: orders.length, totalPages: 1, buyers: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    vi.resetModules();
    const { default: Screen } = await import('@/features/planning/components/DepartmentPlanningScreen');
    const params = Promise.resolve({ dept });
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <Screen params={params} />
        </Suspense>
      );
    });
    await screen.findByText('P-1');
  }

  it('Delivery Plan (Floor) and (Lock) titles; rows open the split order pages', async () => {
    await openList('deliveryfloor');
    expect(document.querySelector('[data-page-title]')?.textContent).toBe('Delivery Plan (Floor)');
    expect(requests[0].url).toContain('/api/orders?dept=deliveryfloor&status=Pending');
    expect(screen.getByText('P-1').closest('a')?.getAttribute('href')).toBe('/planning/deliveryfloor/P-1');
  });

  it('a submitted search asks every list (scope=all) and shows each order\'s list; clearing it returns to the tabs', async () => {
    await openList('deliverylock');
    expect(document.querySelector('[data-page-title]')?.textContent).toBe('Delivery Plan (Lock)');
    fireEvent.change(screen.getByPlaceholderText('Search Booking No...'), { target: { value: 'B-1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    });
    await screen.findByText('B-100');
    const search = new URL(requests.at(-1)!.url).searchParams;
    expect([search.get('scope'), search.get('search'), search.get('dept')]).toEqual(['all', 'B-1', 'deliverylock']);
    expect(Array.from(document.querySelectorAll('[data-list-badge]')).map((b) => b.textContent)).toEqual(['Confirm List', 'Completed List']);
    expect(screen.getByText('B-101').closest('a')?.getAttribute('href')).toBe('/planning/deliverylock/B-101');
    // No tab is marked while the search runs across all lists.
    expect(screen.getByRole('button', { name: 'Pending List' }).className).not.toContain('bg-[#313644]');

    await act(async () => {
      fireEvent.click(screen.getByTitle('Clear search'));
    });
    await screen.findByText('P-1');
    expect(new URL(requests.at(-1)!.url).searchParams.get('scope')).toBeNull();
    expect(document.querySelectorAll('[data-list-badge]').length).toBe(0);
    expect(screen.getByRole('button', { name: 'Pending List' }).className).toContain('bg-[#313644]');
  });
});
