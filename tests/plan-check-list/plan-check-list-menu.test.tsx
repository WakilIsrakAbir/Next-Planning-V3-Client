// @vitest-environment-options {"url": "http://plan-check-list.test/"}
import type { AnchorHTMLAttributes } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harnessState } from '../harness/state';
import { ADMIN, EDITOR, PLANNER, signIn, type MockUser } from './mock-server';

// The Plan Check List menu item and permission (SPEC D9 / C3): the Sidebar item after Atlas Monitor, the
// Manage Users switch (menus.dataManagement.planCheckList) and its defaults.

// next/link as a plain anchor (the Sidebar's own guard is tested in tests/unsaved/sidebar-guard.test.tsx).
vi.mock('next/link', async () => {
  const React = await import('react');
  type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate?: unknown };
  function Link({ href, children, onNavigate, ...rest }: LinkProps) {
    void onNavigate;
    return React.createElement('a', { ...rest, href }, children);
  }
  return { default: Link, useLinkStatus: () => ({ pending: false }) };
});
// Hovering Order Management prefetches the plan lists; no requests in these tests.
vi.mock('@/features/planning/lib/planning-cache', () => ({ prefetchOrderManagement: () => {} }));

afterEach(() => {
  harnessState().fetchHandler = null;
  vi.unstubAllGlobals();
});

describe('Sidebar: Data Management > Plan Check List', () => {
  async function dataManagementLinks(user: MockUser): Promise<Array<[string, string | null]>> {
    signIn('test-token', user);
    vi.resetModules();
    const { default: Sidebar } = await import('@/components/layout/sidebar/Sidebar');
    const view = render(<Sidebar isOpen onToggle={() => {}} onCloseMobile={() => {}} />);
    await screen.findByText(user.username);
    const groupButton = screen.queryByRole('button', { name: 'Data Management' });
    if (!groupButton) {
      view.unmount();
      return [];
    }
    if (!screen.queryByText('Source File Upload') && !screen.queryByText('Plan Check List')) fireEvent.click(groupButton);
    const group = groupButton.parentElement as HTMLElement;
    const entries = Array.from(group.querySelectorAll('a, button'))
      .filter((el) => el !== groupButton)
      .map((el): [string, string | null] => [(el.textContent || '').trim(), el.getAttribute('href')]);
    view.unmount();
    return entries;
  }

  beforeEach(() => {
    harnessState().pathname = '/dashboard';
  });

  it('Admin: right after Atlas Monitor, linking to /management/plan-check-list', async () => {
    expect(await dataManagementLinks(ADMIN)).toEqual([
      ['Source File Upload', '/management/upload'],
      ['Atlas Monitor', '/management/atlas-monitor'],
      ['Plan Check List', '/management/plan-check-list'],
      ['Setup', null],
    ]);
  });

  it('other users only when the permission is ticked (exactly true)', async () => {
    expect(await dataManagementLinks(EDITOR)).toEqual([
      ['Source File Upload', '/management/upload'],
      ['Plan Check List', '/management/plan-check-list'],
    ]);
    expect(await dataManagementLinks(PLANNER)).toEqual([['Source File Upload', '/management/upload']]);
    expect(
      await dataManagementLinks({ username: 'approver', role: 'Approver', permissions: { menus: { dataManagement: { planCheckList: 'true' } } } })
    ).toEqual([]);
    expect(
      await dataManagementLinks({ username: 'viewer', role: 'Viewer', permissions: { menus: { dataManagement: { planCheckList: true } } } })
    ).toEqual([['Plan Check List', '/management/plan-check-list']]);
  });

  it('the open page marks its item and opens its group', async () => {
    harnessState().pathname = '/management/plan-check-list';
    signIn('test-token', ADMIN);
    vi.resetModules();
    const { default: Sidebar } = await import('@/components/layout/sidebar/Sidebar');
    render(<Sidebar isOpen onToggle={() => {}} onCloseMobile={() => {}} />);
    const link = (await screen.findByText('Plan Check List')).closest('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/management/plan-check-list');
    expect(link.className).toContain('border-emerald-500');
    expect((screen.getByText('Atlas Monitor').closest('a') as HTMLAnchorElement).className).not.toContain('border-emerald-500');
  });
});

describe('Manage Users: the Plan Check List permission', () => {
  it('is listed in Data Management right after Atlas Monitor; Admin template on, other templates off', async () => {
    vi.resetModules();
    const ums = await import('@/features/management/users/components/UserManagementScreen');
    const dataManagement = ums.MENU_GROUPS.find((group) => group.key === 'dataManagement');
    expect(dataManagement?.items).toEqual([
      ['view', 'Source File Upload'],
      ['atlasMonitor', 'Atlas Monitor'],
      ['planCheckList', 'Plan Check List'],
      ['setup', 'Dropdown Master Setup'],
      ['dyeingMc', 'Dyeing MC'],
      ['flatAllowance', 'Flat Allowance'],
      ['unitSetup', 'Unit Setup'],
    ]);
    expect(ums.emptyPermissions().menus.dataManagement.planCheckList).toBe(false);
    expect(ums.makeTemplate('Admin').menus.dataManagement.planCheckList).toBe(true);
    for (const role of ['Approver', 'Planner', 'Viewer']) {
      expect(ums.makeTemplate(role).menus.dataManagement.planCheckList, role).toBe(false);
    }
  });

  it('a saved user without the key shows it off (even an Admin), and a ticked key shows on', async () => {
    const users = [
      // saved before the key existed: an Admin template would turn it on, but a missing key means off
      { _id: 'u1', username: 'old_admin', role: 'Admin', status: 'active', permissions: { menus: { dataManagement: { view: true, setup: true } } } },
      { _id: 'u2', username: 'planner1', role: 'Planner', status: 'active', permissions: { menus: { dataManagement: { view: true, planCheckList: true } } } },
    ];
    harnessState().fetchHandler = async (input) => {
      const path = new URL(String(input)).pathname;
      const json =
        path === '/api/auth/users'
          ? users
          : path === '/api/orders/buyers'
            ? []
            : path === '/api/dropdowns' || path === '/api/batch/units'
              ? { units: [] }
              : null;
      const text = JSON.stringify(json);
      return {
        ok: json !== null,
        status: json !== null ? 200 : 404,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => JSON.parse(text),
        text: async () => text,
      };
    };
    signIn('test-token', ADMIN);
    vi.resetModules();
    const { default: UserManagementScreen } = await import('@/features/management/users/components/UserManagementScreen');
    render(<UserManagementScreen />);

    async function planCheckListSwitch(username: string): Promise<{ checked: boolean; order: string[] }> {
      const card = (await screen.findByText(username)).closest('.card') as HTMLElement;
      fireEvent.click(within(card).getByRole('button', { name: 'Permissions' }));
      const title = await screen.findByText(`Permissions: ${username}`);
      const modal = title.closest('.modal-box') as HTMLElement;
      const groupTitle = within(modal).getByText('Data Management');
      const groupCard = groupTitle.closest('.card') as HTMLElement;
      const order = Array.from(groupCard.querySelectorAll('label > span')).map((span) => span.textContent || '');
      const checkbox = within(groupCard).getByLabelText('Plan Check List') as HTMLInputElement;
      const checked = checkbox.checked;
      fireEvent.click(within(modal).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByText(`Permissions: ${username}`)).toBeNull());
      return { checked, order };
    }

    const oldAdmin = await planCheckListSwitch('old_admin');
    expect(oldAdmin.order).toEqual([
      'Source File Upload',
      'Atlas Monitor',
      'Plan Check List',
      'Dropdown Master Setup',
      'Dyeing MC',
      'Flat Allowance',
      'Unit Setup',
    ]);
    expect(oldAdmin.checked).toBe(false);
    expect((await planCheckListSwitch('planner1')).checked).toBe(true);
  });
});
