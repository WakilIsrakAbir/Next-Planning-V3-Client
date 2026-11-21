// @vitest-environment-options {"url": "http://sidebar.test/"}
import type { AnchorHTMLAttributes, MouseEvent as ReactMouseEvent } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from '@/components/layout/Sidebar';
import { BATCH_NAVIGATE_EVENT } from '@/features/batch/lib/batch-navigation';
import { getUnsavedLabels, useUnsavedChanges } from '@/lib/unsaved-changes';
import { harnessState } from '../harness/state';

// Sidebar + shared unsaved-work guard (SPEC section 4, milestone G). Every effect of a click is written to one log,
// in the order it happens: the confirm, closing the mobile drawer, the Batch re-open event, the navigation.
const log = vi.hoisted(() => [] as string[]);

/* next/link as Next 16.3.6 runs a click (node_modules/next/dist/client/app-dir/link.js, linkClicked): the onClick
   prop first; a click it cancelled, a modified click (new tab or window) or a download keeps the browser default;
   otherwise the click is cancelled, onNavigate runs, and unless it called preventDefault the client-side
   navigation starts (logged here as "navigate:<href>"). */
vi.mock('next/link', async () => {
  const React = await import('react');
  type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    onNavigate?: (event: { preventDefault: () => void }) => void;
  };
  function Link({ href, onClick, onNavigate, children, ...rest }: LinkProps) {
    const handleClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      const target = e.currentTarget.getAttribute('target');
      const modified = (target && target !== '_self') || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.nativeEvent.which === 2;
      if (modified || e.currentTarget.hasAttribute('download')) return;
      e.preventDefault();
      if (onNavigate) {
        let prevented = false;
        onNavigate({
          preventDefault: () => {
            prevented = true;
          },
        });
        if (prevented) return;
      }
      log.push(`navigate:${href}`);
    };
    return React.createElement('a', { ...rest, href, onClick: handleClick }, children);
  }
  return { default: Link, useLinkStatus: () => ({ pending: false }) };
});

// Hovering Order Management prefetches the plan lists; no requests in these tests.
vi.mock('@/features/planning/lib/planning-cache', () => ({ prefetchOrderManagement: () => {} }));

const MESSAGE = 'Unsaved changes in: Dyeing Plan, Delivery Plan (Lock). Leave without saving?';
const UNSAVED = ['Dyeing Plan', 'Delivery Plan (Lock)'];
const SESSION_KEYS = ['token', 'user', 'username', 'role', 'permissions', 'status', 'sessionExpiresAt'];

let answer = false;
let stopJsdomNavigation: ((e: Event) => void) | null = null;

/** A page with unsaved work, as the order page or the Plan Check List page will register it. */
function DirtyPage({ labels }: { labels: string[] }) {
  useUnsavedChanges('test-page', labels);
  return null;
}

function renderSidebar(labels: string[] = []) {
  const onCloseMobile = () => log.push('closeMobile');
  const view = render(
    <>
      <Sidebar isOpen onToggle={() => {}} onCloseMobile={onCloseMobile} />
      <DirtyPage labels={labels} />
    </>
  );
  return {
    setLabels: (next: string[]) =>
      view.rerender(
        <>
          <Sidebar isOpen onToggle={() => {}} onCloseMobile={onCloseMobile} />
          <DirtyPage labels={next} />
        </>
      ),
  };
}

const link = (text: string) => {
  const anchor = screen.getByText(text, { exact: true }).closest('a');
  if (!anchor) throw new Error(`no link around "${text}"`);
  return anchor;
};
const brandLink = () => link('Textile Planning Solution');

/** Clicks and returns what happened (then clears the log). */
function click(element: Element, init: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}): string[] {
  log.length = 0;
  fireEvent.click(element, init);
  return log.splice(0);
}

function onBatchNavigate(event: Event) {
  log.push(`batchRoute:${(event as CustomEvent<{ route: string }>).detail.route}`);
}

beforeEach(() => {
  // Never a real host: jsdom would resolve the links against this origin.
  expect(window.location.origin).toBe('http://sidebar.test');
  log.length = 0;
  answer = false;
  localStorage.clear();
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ username: 'admin', role: 'Admin', status: 'active', permissions: {} }));
  localStorage.setItem('username', 'admin');
  localStorage.setItem('role', 'Admin');
  localStorage.setItem('permissions', '{}');
  localStorage.setItem('status', 'active');
  localStorage.setItem('sessionExpiresAt', '1795197600000');
  // The Knitting Plan page is open, so Order Management (Knitting Plan, Batch Plan) is expanded.
  harnessState().pathname = '/planning/knitting';
  // Phone width: a link click closes the drawer (handleNavClick).
  vi.stubGlobal('innerWidth', 800);
  vi.stubGlobal('confirm', (message: string) => {
    log.push(`confirm:${message}`);
    return answer;
  });
  window.addEventListener(BATCH_NAVIGATE_EVENT, onBatchNavigate);
  // A modified click keeps the browser default (open a new tab), which jsdom cannot do: stop it after React.
  stopJsdomNavigation = (e: Event) => e.preventDefault();
  document.addEventListener('click', stopJsdomNavigation);
});

afterEach(() => {
  window.removeEventListener(BATCH_NAVIGATE_EVENT, onBatchNavigate);
  if (stopJsdomNavigation) document.removeEventListener('click', stopJsdomNavigation);
  vi.unstubAllGlobals();
});

describe('Sidebar with nothing unsaved: exactly as before', () => {
  it('brand link, Dashboard Home and menu links: no prompt; the click side effects, then the navigation', () => {
    renderSidebar();
    expect(getUnsavedLabels()).toEqual([]);
    expect(click(brandLink())).toEqual(['closeMobile', 'navigate:/dashboard']);
    expect(click(link('Dashboard Home'))).toEqual(['closeMobile', 'navigate:/dashboard']);
    expect(click(link('Knitting Plan'))).toEqual(['closeMobile', 'navigate:/planning/knitting']);
    expect(click(link('Batch Plan'))).toEqual(['closeMobile', 'batchRoute:plan', 'navigate:/batch/plan']);
  });

  it('wide screen: there is no drawer to close', () => {
    vi.stubGlobal('innerWidth', 1280);
    renderSidebar();
    expect(click(brandLink())).toEqual(['navigate:/dashboard']);
    expect(click(link('Batch Plan'))).toEqual(['batchRoute:plan', 'navigate:/batch/plan']);
  });

  it('Ctrl/Cmd/Shift-click (new tab or window): the click side effects run as before, no navigation here', () => {
    renderSidebar();
    expect(click(link('Batch Plan'), { ctrlKey: true })).toEqual(['closeMobile', 'batchRoute:plan']);
    expect(click(link('Knitting Plan'), { metaKey: true })).toEqual(['closeMobile']);
    expect(click(brandLink(), { shiftKey: true })).toEqual(['closeMobile']);
  });

  it('Sign Out: signs out and loads /login without asking', () => {
    renderSidebar();
    const location = { href: 'http://sidebar.test/planning/knitting' };
    vi.stubGlobal('location', location);
    expect(click(screen.getByTitle('Sign Out'))).toEqual([]);
    expect(SESSION_KEYS.filter((key) => localStorage.getItem(key) !== null)).toEqual([]);
    expect(location.href).toBe('/login');
  });
});

describe('Sidebar with unsaved work', () => {
  it('every link asks first, naming the unsaved work; Cancel keeps the page and runs no side effect', () => {
    renderSidebar(UNSAVED);
    answer = false;
    expect(click(brandLink())).toEqual([`confirm:${MESSAGE}`]);
    expect(click(link('Dashboard Home'))).toEqual([`confirm:${MESSAGE}`]);
    expect(click(link('Knitting Plan'))).toEqual([`confirm:${MESSAGE}`]);
    expect(click(link('Batch Plan'))).toEqual([`confirm:${MESSAGE}`]);
  });

  it('OK: the click side effects run after the answer, then the navigation', () => {
    renderSidebar(UNSAVED);
    answer = true;
    expect(click(brandLink())).toEqual([`confirm:${MESSAGE}`, 'closeMobile', 'navigate:/dashboard']);
    expect(click(link('Dashboard Home'))).toEqual([`confirm:${MESSAGE}`, 'closeMobile', 'navigate:/dashboard']);
    expect(click(link('Knitting Plan'))).toEqual([`confirm:${MESSAGE}`, 'closeMobile', 'navigate:/planning/knitting']);
    expect(click(link('Batch Plan'))).toEqual([
      `confirm:${MESSAGE}`,
      'closeMobile',
      'batchRoute:plan',
      'navigate:/batch/plan',
    ]);
  });

  it('Ctrl/Cmd-click opens a new tab: no prompt, and this page and its drawer are left alone', () => {
    renderSidebar(UNSAVED);
    expect(click(link('Batch Plan'), { ctrlKey: true })).toEqual([]);
    expect(click(brandLink(), { metaKey: true })).toEqual([]);
  });

  it('the prompt follows the page: another label set, and no prompt once the work is saved', () => {
    const page = renderSidebar(['Plan Check List']);
    answer = false;
    expect(click(link('Knitting Plan'))).toEqual(['confirm:Unsaved changes in: Plan Check List. Leave without saving?']);
    page.setLabels([]);
    expect(click(link('Knitting Plan'))).toEqual(['closeMobile', 'navigate:/planning/knitting']);
  });

  it('Sign Out, Cancel: still signed in, and the page stays', () => {
    renderSidebar(UNSAVED);
    const location = { href: 'http://sidebar.test/planning/knitting' };
    vi.stubGlobal('location', location);
    answer = false;
    expect(click(screen.getByTitle('Sign Out'))).toEqual([`confirm:${MESSAGE}`]);
    expect(SESSION_KEYS.filter((key) => localStorage.getItem(key) === null)).toEqual([]);
    expect(location.href).toBe('http://sidebar.test/planning/knitting');
  });

  it('Sign Out, OK: signs out and loads /login; the browser does not ask a second time', () => {
    renderSidebar(UNSAVED);
    const location = { href: 'http://sidebar.test/planning/knitting' };
    vi.stubGlobal('location', location);
    answer = true;
    expect(click(screen.getByTitle('Sign Out'))).toEqual([`confirm:${MESSAGE}`]);
    expect(SESSION_KEYS.filter((key) => localStorage.getItem(key) !== null)).toEqual([]);
    expect(location.href).toBe('/login');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });
});
