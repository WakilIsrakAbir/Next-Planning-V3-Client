// @vitest-environment-options {"url": "http://order-page.test/"}
import { readFileSync } from 'node:fs';
import type { AnchorHTMLAttributes, MouseEvent as ReactMouseEvent } from 'react';
import { fireEvent, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openPage, type PageDriver } from './driver';
import { savedOrder, twoRows } from './fixtures';
import { harnessState } from '../harness/state';
import { leavePromptsAnswered, runScenario } from '../harness/runner';
import { formatJson } from '../harness/snapshot';
import { loadSyntheticFixture, TESTS_DIR } from '../harness/fixtures';
import { syntheticScenarios } from '../golden/scenarios';
import { recordingPath } from '../golden/golden-suite';
import { T } from '../golden/scenarios/texts';

// SPEC C2 item 8 through the shared guard (milestone G): the order page registers its unsaved sections; Back, the
// arrow, the card's Cancel, every Sidebar link and closing or reloading the tab ask first, naming those sections
// (SPEC C2 10b). With nothing unsaved nobody is asked.

const navigations = vi.hoisted(() => [] as string[]);

/* next/link as Next 16.3.6 runs a click (as in tests/unsaved/sidebar-guard.test.tsx): onClick, then onNavigate, which
   may cancel the client-side navigation (logged here as the href). */
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
      navigations.push(href);
    };
    return React.createElement('a', { ...rest, href, onClick: handleClick }, children);
  }
  return { default: Link, useLinkStatus: () => ({ pending: false }) };
});

let page: PageDriver | null = null;
afterEach(() => {
  page?.close();
  page = null;
  navigations.length = 0;
});

const routerCalls = () => harnessState().routerCalls.map((c) => (c.args.length ? `${c.fn}:${c.args.join(',')}` : c.fn));
const button = (text: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
const arrow = () => document.querySelector('button[title="Go Back"]') as HTMLButtonElement;
const leaveMessage = (labels: string[]) => `Unsaved changes in: ${labels.join(', ')}. Leave without saving?`;

function beforeUnloadPrevented(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('Back, the arrow and the card Cancel', () => {
  it('with unsaved work they ask, naming the sections in page order; Cancel keeps the page and the work', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    await page.set('deliveryLock', 1, 'remarks', 'l');
    await page.set('dyeing', 1, 'remarks', 'd');
    const message = leaveMessage(['Dyeing Plan', 'Delivery Plan (Lock)']);
    for (const el of [arrow(), button('Back'), button('Cancel')]) {
      page.answer(false);
      await page.click(el);
    }
    expect(page.confirms).toEqual([message, message, message]);
    expect(routerCalls()).toEqual([]);
    expect((page.field('dyeing', 1, 'remarks') as HTMLTextAreaElement).value).toBe('d');
    expect(page.pills('dyeing')).toContain('Unsaved');
    expect(page.errors).toEqual([]);
  });

  it('OK leaves (as today: the list without history, router.back with history)', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'dyeing', role: 'planner' });
    await page.set('dyeing', 1, 'remarks', 'd');
    page.answer(true);
    await page.click(button('Back'));
    expect(page.confirms).toEqual([leaveMessage(['Dyeing Plan'])]);
    expect(routerCalls()).toEqual(['push:/planning/dyeing']);
    Object.defineProperty(window.history, 'length', { configurable: true, get: () => 3 });
    page.answer(true);
    await page.click(arrow());
    expect(routerCalls()).toEqual(['push:/planning/dyeing', 'back']);
  });

  it('nothing unsaved: no prompt, the page leaves at once', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'planner' });
    await page.click(arrow());
    await page.click(button('Back'));
    await page.click(button('Cancel'));
    expect(page.confirms).toEqual([]);
    expect(routerCalls()).toEqual(['push:/planning/knitting', 'push:/planning/knitting', 'push:/planning/knitting']);
    // After a save nothing is unsaved either.
    await page.set('knitting', 1, 'remarks', 'k');
    await page.saveSection('knitting');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    await page.click(button('Back'));
    expect(page.confirms).toEqual([]);
    expect(page.errors).toEqual([]);
  });

  it('the section titles of every page (SPEC section 6)', async () => {
    const cases: Array<[string, Array<[string, number, string]>, string[]]> = [
      ['yd', [['yd', 0, 'remarks'], ['knitting', 0, 'remarks']], ['YD Plan', 'Knitting Plan']],
      ['finishing', [['finishing', 0, 'remarks'], ['dyeing', 0, 'remarks']], ['Finishing Plan', 'Dyeing Plan']],
      ['delivery', [['deliveryLock', 0, 'remarks'], ['deliveryFloor', 0, 'floorPlanType']], ['Delivery Plan (Floor)', 'Delivery Plan (Lock)']],
    ];
    for (const [dept, edits, labels] of cases) {
      page = await openPage({ fixture: savedOrder(), dept, role: 'admin' });
      for (const [key, row, name] of edits) await page.set(key, row, name, name === 'floorPlanType' ? 'Confirm' : 'x');
      page.answer(false);
      await page.click(button('Back'));
      expect(page.confirms).toEqual([leaveMessage(labels)]);
      page.close();
      page = null;
    }
  });
});

describe('Sidebar links (G guards them; the order page registers its work)', () => {
  let sidebar: HTMLElement = document.body;
  async function openWithSidebar(fixtureDept: string) {
    const p = await openPage({ fixture: twoRows(), dept: fixtureDept, role: 'admin' });
    // The Sidebar from the same module graph as the page (vi.resetModules gave the page a fresh guard store).
    const { default: Sidebar } = await import('@/components/layout/sidebar/Sidebar');
    sidebar = render(<Sidebar isOpen onToggle={() => {}} onCloseMobile={() => {}} />).container;
    await p.settle();
    return p;
  }
  const link = (text: string) => within(sidebar).getByText(text, { exact: true }).closest('a') as HTMLAnchorElement;

  it('a dirty order page: a Sidebar link asks with the section names; Cancel stays, OK navigates', async () => {
    page = await openWithSidebar('knitting');
    await page.set('knitting', 1, 'remarks', 'k');
    await page.set('deliveryFloor', 1, 'floorEndDate', '2026-11-04');
    const message = leaveMessage(['Knitting Plan', 'Delivery Plan (Floor)']);
    page.answer(false);
    fireEvent.click(link('Dyeing Plan'));
    await page.settle();
    expect(page.confirms).toEqual([message]);
    expect(navigations).toEqual([]);
    expect((page.field('knitting', 1, 'remarks') as HTMLTextAreaElement).value).toBe('k');
    page.answer(true);
    fireEvent.click(link('Dashboard Home'));
    await page.settle();
    expect(page.confirms).toEqual([message, message]);
    expect(navigations).toEqual(['/dashboard']);
    expect(page.errors).toEqual([]);
  });

  it('a clean order page: Sidebar links navigate without a prompt (also after Discard)', async () => {
    page = await openWithSidebar('knitting');
    fireEvent.click(link('Dyeing Plan'));
    await page.settle();
    expect(navigations).toEqual(['/planning/dyeing']);
    await page.set('dyeing', 1, 'remarks', 'd');
    page.answer(true);
    await page.discard('dyeing');
    fireEvent.click(link('Knitting Plan'));
    await page.settle();
    expect(page.confirms).toEqual(['Discard the unsaved changes in Dyeing Plan?']);
    expect(navigations).toEqual(['/planning/dyeing', '/planning/knitting']);
  });
});

describe('closing or reloading the tab (beforeunload, from G)', () => {
  it('asks only while something is unsaved', async () => {
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'admin' });
    expect(beforeUnloadPrevented()).toBe(false);
    await page.set('dyeing', 1, 'remarks', 'd');
    expect(beforeUnloadPrevented()).toBe(true);
    await page.saveSection('dyeing');
    expect(page.toasts.at(-1)).toBe(`success: ${T.saved('SYN-S1')}`);
    expect(beforeUnloadPrevented()).toBe(false);
    // A View only section never counts: a planner's edit attempt there changes nothing.
    page.close();
    page = await openPage({ fixture: twoRows(), dept: 'knitting', role: 'planner' });
    const el = page.field('dyeing', 1, 'remarks');
    el.closest('fieldset')?.removeAttribute('disabled');
    fireEvent.change(el, { target: { value: 'tampered' } });
    await page.settle();
    expect(beforeUnloadPrevented()).toBe(false);
    page.close();
    page = null;
    // The page gone: no listener left.
    expect(beforeUnloadPrevented()).toBe(false);
  });
});

describe('golden master: knitting/gate07 (Back with an unsaved edit, recorded from the old page)', () => {
  it('the runner answers the leave prompts of its back steps; the recordings stay byte for byte', async () => {
    const cases: Array<[string, number]> = [
      ['knitting/gate07-back-discards-edits/admin', 3],
      ['knitting/gate07-back-discards-edits/planner', 3],
      ['knitting/gate07-back-with-history/planner', 0],
    ];
    for (const [id, prompts] of cases) {
      const sc = syntheticScenarios.find((s) => s.id === id);
      if (!sc) throw new Error(`no scenario ${id}`);
      const recording = await runScenario(sc, loadSyntheticFixture(sc.fixture));
      expect(recording.harnessErrors ?? []).toEqual([]);
      expect(leavePromptsAnswered).toEqual(Array(prompts).fill(leaveMessage(['Knitting Plan'])));
      const stored = readFileSync(recordingPath(`${TESTS_DIR}golden/synthetic`, id), 'utf8').replace(/\r\n/g, '\n');
      expect(formatJson(recording) + '\n').toBe(stored);
    }
  });
});
