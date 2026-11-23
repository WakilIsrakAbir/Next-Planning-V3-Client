import type { AnchorHTMLAttributes } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harnessState, resetHarnessState } from '../harness/state';
import { signIn, type MockUser } from '../plan-check-list/mock-server';

// US-12: the compact Order Management header (12.6), the Delivery Floor / Lock report menus (12.4) and the PPI Style
// column and search (12.5).

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

// "Auto" rows need a measured table area, which jsdom does not have: ten rows.
vi.mock('@/lib/use-fit-rows', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/use-fit-rows')>()),
  useFitRows: () => ({ rows: 10, rowHeight: 41 }),
}));

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  harnessState().fetchHandler = null;
  sessionStorage.clear();
});

describe('12.6 compact header on the Order Management pages', () => {
  async function renderHeader(pathname: string) {
    harnessState().pathname = pathname;
    vi.resetModules();
    const { default: Header } = await import('@/components/layout/Header');
    return render(<Header onToggleSidebar={() => {}} isSidebarOpen />);
  }

  it('compactMenuName: the list and order pages of /planning only', async () => {
    const { compactMenuName } = await import('@/components/layout/Header');
    expect(compactMenuName('/planning/knitting')).toBe('Knitting Plan');
    expect(compactMenuName('/planning/knitting/272147')).toBe('Knitting Plan');
    expect(compactMenuName('/planning/deliveryfloor')).toBe('Delivery Plan (Floor)');
    expect(compactMenuName('/planning/deliverylock/1')).toBe('Delivery Plan (Lock)');
    expect(compactMenuName('/planning/yd')).toBe('YD Plan');
    expect(compactMenuName('/dashboard')).toBeNull();
    expect(compactMenuName('/reports/knitting')).toBeNull();
    expect(compactMenuName('/tracking/knitting')).toBeNull();
  });

  it('the menu tab closes to the dashboard; Full toggles the browser full-screen mode', async () => {
    const view = await renderHeader('/planning/knitting/272147');
    const header = view.container.querySelector('[data-compact-header]') as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.textContent).not.toContain('Planning & Operations Control Suite');
    expect(header.textContent).not.toContain('Shift Reset');
    expect(within(header).getByRole('button', { name: 'Toggle Sidebar' })).toBeTruthy();
    expect(within(header).getByRole('button', { name: 'Toggle Theme' })).toBeTruthy();
    const tab = header.querySelector('[data-menu-tab]') as HTMLElement;
    expect(tab.textContent).toBe('Knitting Plan');
    expect(within(tab).getByRole('link', { name: 'Close Knitting Plan' }).getAttribute('href')).toBe('/dashboard');

    let fullElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullElement });
    const request = vi.fn(async () => {
      fullElement = document.documentElement;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    const exit = vi.fn(async () => {
      fullElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    document.documentElement.requestFullscreen = request;
    document.exitFullscreen = exit;
    try {
      const full = header.querySelector('[data-action="fullscreen"]') as HTMLButtonElement;
      expect(full.textContent).toBe('Full');
      await act(async () => {
        fireEvent.click(full);
      });
      expect(request).toHaveBeenCalledTimes(1);
      expect(full.textContent).toBe('Exit Full');
      expect(full.getAttribute('aria-pressed')).toBe('true');
      await act(async () => {
        fireEvent.click(full);
      });
      expect(exit).toHaveBeenCalledTimes(1);
      expect(full.textContent).toBe('Full');
    } finally {
      delete (document as unknown as { fullscreenElement?: unknown }).fullscreenElement;
      view.unmount();
    }
  });

  it('every other page keeps today\'s header', async () => {
    const view = await renderHeader('/dashboard');
    expect(view.container.querySelector('[data-compact-header]')).toBeNull();
    expect(view.container.textContent).toContain('Planning & Operations Control Suite');
    expect(view.container.textContent).toContain('Shift Reset');
    view.unmount();
  });
});

describe('12.4 Report menu: Updated Delivery Plan (Floor) and (Lock) Reports', () => {
  async function reportLinks(user: MockUser): Promise<Array<[string, string | null]>> {
    signIn('test-token', user);
    harnessState().pathname = '/dashboard';
    harnessState().fetchHandler = async () => json({});
    vi.resetModules();
    const { default: Sidebar } = await import('@/components/layout/Sidebar');
    const view = render(<Sidebar isOpen onToggle={() => {}} onCloseMobile={() => {}} />);
    await screen.findByText(user.username);
    const groupButton = screen.queryByRole('button', { name: 'Report' });
    if (!groupButton) {
      view.unmount();
      return [];
    }
    if (!within(groupButton.parentElement as HTMLElement).queryByText(/Updated/)) fireEvent.click(groupButton);
    const entries = Array.from((groupButton.parentElement as HTMLElement).querySelectorAll('a'))
      .map((el): [string, string | null] => [(el.textContent || '').trim(), el.getAttribute('href')])
      .filter(([, href]) => Boolean(href && /^\/reports\/(yd|knitting|dyeing|finishing|delivery)/.test(href)));
    view.unmount();
    return entries;
  }

  it('Floor above Lock in the Delivery position; the old Updated Delivery Report item is gone', async () => {
    const links = await reportLinks({ username: 'admin', role: 'Admin', permissions: {} });
    expect(links).toEqual([
      ['Updated YD Report', '/reports/yd'],
      ['Updated Knitting Report', '/reports/knitting'],
      ['Updated Dyeing Report', '/reports/dyeing'],
      ['Updated Finishing Report', '/reports/finishing'],
      ['Updated Delivery Plan (Floor) Report', '/reports/deliveryfloor'],
      ['Updated Delivery Plan (Lock) Report', '/reports/deliverylock'],
    ]);
  });

  it('a user without the new keys falls back to `delivery`; a set key wins', async () => {
    const rep = (reports: Record<string, boolean>): MockUser => ({ username: 'planner1', role: 'Planner', permissions: { menus: { reports } } });
    const delivery = async (u: MockUser) => (await reportLinks(u)).map(([, href]) => href).filter((h) => h?.includes('delivery'));
    expect(await delivery(rep({ delivery: true }))).toEqual(['/reports/deliveryfloor', '/reports/deliverylock']);
    expect(await delivery(rep({ knitting: true }))).toEqual([]);
    expect(await delivery(rep({ delivery: true, deliveryLock: false }))).toEqual(['/reports/deliveryfloor']);
    expect(await delivery(rep({ delivery: false, deliveryFloor: true }))).toEqual(['/reports/deliveryfloor']);
  });
});

describe('12.5 Planning & Production Info: Style column and search', () => {
  const requests: string[] = [];

  beforeEach(() => {
    requests.length = 0;
    resetHarnessState({}, '/reports/planning-prod-info');
    signIn('test-token', { username: 'planner1', role: 'Planner', permissions: {} });
    harnessState().fetchHandler = async (input: unknown) => {
      const url = String(input);
      requests.push(url);
      const q = new URL(url).searchParams;
      const style = (q.get('style') || '').toLowerCase();
      const orders = [
        { _id: '1', orderNo: 'PPI-1', buyer: 'Alpha', bookingDate: '2026-10-01', style: 'POLO-22', status: 'Running' },
        { _id: '2', orderNo: 'PPI-2', buyer: 'Beta', bookingDate: '2026-10-02', status: 'Running' },
      ].filter((o) => !style || (o.style || '').toLowerCase().includes(style));
      return json({ orders, total: orders.length, totalPages: 1 });
    };
  });

  async function openPPI() {
    vi.resetModules();
    const { default: Screen } = await import('@/features/planning-prod-info/components/PlanningProdInfoScreen');
    await act(async () => {
      render(<Screen />);
    });
    await screen.findByText('PPI-1');
  }

  it('the order table shows Style instead of Status', async () => {
    await openPPI();
    const heads = Array.from(document.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    expect(heads).toEqual(['View', 'Booking No. / Order No.', 'Buyer Name', 'Booking Date', 'Style']);
    const row = (no: string) => Array.from(screen.getByText(no).closest('tr')!.querySelectorAll('td')).map((td) => td.textContent?.trim());
    expect(row('PPI-1').slice(1)).toEqual(['PPI-1', 'Alpha', expect.any(String), 'POLO-22']);
    expect(row('PPI-2').at(-1)).toBe('—');
    expect(screen.queryByText('Running')).toBeNull();
  });

  it('searches by Booking / Order No. and by Style (style= only when filled)', async () => {
    await openPPI();
    expect(new URL(requests[0]).searchParams.has('style')).toBe(false);
    fireEvent.change(screen.getByLabelText('Search Style'), { target: { value: 'polo' } });
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Search Style'), { key: 'Enter' });
    });
    await act(async () => {});
    const q = new URL(requests.at(-1)!).searchParams;
    expect([q.get('style'), q.get('search'), q.get('page')]).toEqual(['polo', '', '1']);
    expect(screen.queryByText('PPI-2')).toBeNull();
    expect(screen.getByText('PPI-1')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Search Booking / Order No.'), { target: { value: 'PPI-1' } });
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Search Booking / Order No.'), { key: 'Enter' });
    });
    const both = new URL(requests.at(-1)!).searchParams;
    expect([both.get('search'), both.get('style')]).toEqual(['PPI-1', 'polo']);
  });
});
