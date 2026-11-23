import type { AnchorHTMLAttributes } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { harnessState } from '../harness/state';
import {
  batchCanOpenRoute,
  batchPathFromRoute,
  batchRouteFromPath,
  batchRouteInfo,
  isBatchPath,
} from '@/features/batch/lib/batch-navigation';
import { setupRedirects } from '../../next.config';

// Data Management > Setup pages under one parent route, /management/setup/<page> (Dropdown Master Setup and the
// three Batch Setup pages), the old /batch/setup/<panel> redirects and the Sidebar links.

vi.mock('next/link', async () => {
  const React = await import('react');
  type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate?: unknown };
  function Link({ href, children, onNavigate, ...rest }: LinkProps) {
    void onNavigate;
    return React.createElement('a', { ...rest, href }, children);
  }
  return { default: Link, useLinkStatus: () => ({ pending: false }) };
});
vi.mock('@/features/planning/lib/planning-cache', () => ({ prefetchOrderManagement: () => {} }));

const NEW_PATHS: Array<[string, string, string]> = [
  ['setup/dyeing', '/management/setup/dyeing-mc', 'Dyeing MC'],
  ['setup/flat', '/management/setup/flat-allowance', 'Flat Allowance'],
  ['setup/unit', '/management/setup/unit', 'Unit Setup'],
];

afterEach(() => {
  localStorage.clear();
});

describe('Batch Setup routes <-> paths', () => {
  it.each(NEW_PATHS)('%s <-> %s', (route, path, title) => {
    expect(batchPathFromRoute(route)).toBe(path);
    expect(batchRouteFromPath(path)).toBe(route);
    expect(batchRouteFromPath(path + '/')).toBe(route);
    expect(isBatchPath(path)).toBe(true);
    expect(batchRouteInfo(route)?.title).toBe(title);
  });

  it('keeps the permission keys of the Setup routes', () => {
    expect(batchRouteInfo('setup/dyeing')).toMatchObject({ group: 'dataManagement', key: 'dyeingMc' });
    expect(batchRouteInfo('setup/flat')).toMatchObject({ group: 'dataManagement', key: 'flatAllowance' });
    expect(batchRouteInfo('setup/unit')).toMatchObject({ group: 'dataManagement', key: 'unitSetup' });
    localStorage.setItem('user', JSON.stringify({ role: 'Planner', permissions: { menus: { dataManagement: { flatAllowance: true } } } }));
    expect(batchCanOpenRoute('setup/flat')).toBe(true);
    expect(batchCanOpenRoute('setup/dyeing')).toBe(false);
  });

  it('Dropdown Master Setup and other paths are not Batch pages; the other Batch routes are unchanged', () => {
    expect(isBatchPath('/management/setup/dropdowns')).toBe(false);
    expect(isBatchPath('/management/setup')).toBe(false);
    expect(isBatchPath('/management/setup/dyeing-mc/x')).toBe(false);
    expect(isBatchPath('/management/upload')).toBe(false);
    expect(isBatchPath('/batch/plan/EFL')).toBe(true);
    expect(batchPathFromRoute('plan/EFL')).toBe('/batch/plan/EFL');
    expect(batchPathFromRoute('report/daily')).toBe('/batch/report/daily');
    expect(batchRouteFromPath('/batch/card/EKL')).toBe('card/EKL');
    expect(batchRouteFromPath('/management/setup/dropdowns')).toBe('plan');
  });
});

describe('redirects (next.config.ts)', () => {
  it('/management/setup opens Dropdown Master Setup; the old Batch Setup URLs move to the new paths', () => {
    expect(setupRedirects).toEqual([
      { source: '/management/setup', destination: '/management/setup/dropdowns', permanent: false },
      { source: '/batch/setup/dyeing', destination: '/management/setup/dyeing-mc', permanent: false },
      { source: '/batch/setup/flat', destination: '/management/setup/flat-allowance', permanent: false },
      { source: '/batch/setup/unit', destination: '/management/setup/unit', permanent: false },
    ]);
  });
});

describe('route pages', () => {
  it('the Batch Setup page prerenders the three pages with their titles', async () => {
    const mod = await import('@/app/(dashboard)/management/setup/(batch)/[panel]/page');
    expect(mod.generateStaticParams()).toEqual([{ panel: 'dyeing-mc' }, { panel: 'flat-allowance' }, { panel: 'unit' }]);
    expect(mod.dynamicParams).toBe(false);
    for (const [, path, title] of NEW_PATHS) {
      const panel = path.split('/').pop() as string;
      expect(await mod.generateMetadata({ params: Promise.resolve({ panel }) })).toEqual({ title });
    }
  });

  it('Dropdown Master Setup keeps its title', async () => {
    const mod = await import('@/app/(dashboard)/management/setup/dropdowns/page');
    expect(mod.metadata).toEqual({ title: 'Dropdown Master Setup' });
  });
});

describe('Sidebar: Data Management > Setup', () => {
  async function setupLinks(pathname: string) {
    harnessState().pathname = pathname;
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ username: 'admin', role: 'Admin', status: 'active', permissions: {} }));
    vi.resetModules();
    const { default: Sidebar } = await import('@/components/layout/sidebar/Sidebar');
    const view = render(<Sidebar isOpen onToggle={() => {}} onCloseMobile={() => {}} />);
    await screen.findByText('admin');
    if (!screen.queryByText('Source File Upload')) fireEvent.click(screen.getByRole('button', { name: 'Data Management' }));
    if (!screen.queryByText('Dyeing MC')) fireEvent.click(screen.getByRole('button', { name: /^Setup/ }));
    const links = ['Dropdown Master Setup', 'Dyeing MC', 'Flat Allowance', 'Unit Setup'].map((label) => {
      const a = screen.getByText(label).closest('a') as HTMLAnchorElement;
      return [label, a.getAttribute('href'), a.className.includes('bg-emerald-500/15')] as const;
    });
    view.unmount();
    return links;
  }

  it('links every Setup page under /management/setup and marks the open one', async () => {
    expect(await setupLinks('/management/setup/flat-allowance')).toEqual([
      ['Dropdown Master Setup', '/management/setup/dropdowns', false],
      ['Dyeing MC', '/management/setup/dyeing-mc', false],
      ['Flat Allowance', '/management/setup/flat-allowance', true],
      ['Unit Setup', '/management/setup/unit', false],
    ]);
    expect((await setupLinks('/management/setup/dropdowns')).map(([, , active]) => active)).toEqual([true, false, false, false]);
  });
});
