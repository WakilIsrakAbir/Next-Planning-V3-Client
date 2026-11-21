// @vitest-environment-options {"url": "http://unsaved.test/"}
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  confirmLeave,
  confirmPageLeave,
  getUnsavedLabels,
  guardedLinkHandlers,
  guardLinkNavigate,
  registerUnsavedChanges,
  useUnsavedChanges,
} from '@/lib/unsaved-changes';

// Shared unsaved-work guard (SPEC section 4, milestone G): the store, the hook, the prompt and the link guard.

const MESSAGE = 'Unsaved changes in: Dyeing Plan, Delivery Plan (Lock). Leave without saving?';

let confirms: string[] = [];
let answer = false;
const cleanups: Array<() => void> = [];

/** Registers a source for this test only (unregistered in afterEach). */
function register(id: string, getLabels: () => string[]): () => void {
  const unregister = registerUnsavedChanges(id, getLabels);
  cleanups.push(unregister);
  return unregister;
}

/** Fires beforeunload the way the browser does; true = the page asked for the "Leave site?" prompt. */
function unloadPrompts(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

function Dirty({ id, labels }: { id: string; labels: string[] }) {
  useUnsavedChanges(id, labels);
  return null;
}

beforeEach(() => {
  confirms = [];
  answer = false;
  vi.stubGlobal('confirm', (message: string) => {
    confirms.push(message);
    return answer;
  });
  expect(getUnsavedLabels()).toEqual([]);
});

afterEach(() => {
  cleanups.splice(0).forEach((unregister) => unregister());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('store', () => {
  it('starts empty: nothing is unsaved, confirmLeave() is true without asking, no beforeunload prompt', () => {
    expect(getUnsavedLabels()).toEqual([]);
    expect(confirmLeave()).toBe(true);
    expect(confirms).toEqual([]);
    expect(unloadPrompts()).toBe(false);
  });

  it('getUnsavedLabels(): the union of every source, in registration order, without duplicates', () => {
    register('order-page', () => ['Dyeing Plan', 'Delivery Plan (Lock)']);
    register('planning-guide', () => ['Planning Guide', 'Dyeing Plan']);
    register('plan-check-list', () => ['Plan Check List']);
    expect(getUnsavedLabels()).toEqual(['Dyeing Plan', 'Delivery Plan (Lock)', 'Planning Guide', 'Plan Check List']);
  });

  it('reads getLabels each time it is asked; a source with [] adds nothing', () => {
    let labels: string[] = [];
    register('order-page', () => labels);
    expect(getUnsavedLabels()).toEqual([]);
    labels = ['Knitting Plan'];
    expect(getUnsavedLabels()).toEqual(['Knitting Plan']);
    labels = [];
    expect(getUnsavedLabels()).toEqual([]);
  });

  it('the unregister function removes only its own source', () => {
    const unregisterA = register('a', () => ['A']);
    register('b', () => ['B']);
    unregisterA();
    expect(getUnsavedLabels()).toEqual(['B']);
    unregisterA();
    expect(getUnsavedLabels()).toEqual(['B']);
  });

  it('registering an id again replaces that source in its place; the old unregister cannot remove the new one', () => {
    const unregisterOld = register('a', () => ['A1']);
    register('b', () => ['B']);
    register('a', () => ['A2']);
    expect(getUnsavedLabels()).toEqual(['A2', 'B']);
    unregisterOld();
    expect(getUnsavedLabels()).toEqual(['A2', 'B']);
  });
});

describe('beforeunload', () => {
  it('ONE listener for the whole app: added with the first source, removed with the last', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const count = (spy: typeof add) => spy.mock.calls.filter(([type]) => type === 'beforeunload').length;

    const unregisterA = register('a', () => ['A']);
    const unregisterB = register('b', () => ['B']);
    register('a', () => ['A again']);
    expect(count(add)).toBe(1);
    unregisterA();
    unregisterB();
    expect(count(remove)).toBe(0);
    cleanups.splice(0).forEach((unregister) => unregister());
    expect(count(remove)).toBe(1);
    expect(remove.mock.calls.find(([type]) => type === 'beforeunload')?.[1]).toBe(
      add.mock.calls.find(([type]) => type === 'beforeunload')?.[1]
    );
  });

  it('asks for the browser prompt only while some source has labels', () => {
    let labels: string[] = [];
    const unregister = register('order-page', () => labels);
    expect(unloadPrompts()).toBe(false);
    labels = ['Dyeing Plan'];
    expect(unloadPrompts()).toBe(true);
    labels = [];
    expect(unloadPrompts()).toBe(false);
    labels = ['Dyeing Plan'];
    unregister();
    expect(unloadPrompts()).toBe(false);
  });

  it('never calls window.confirm itself (the browser shows its own prompt)', () => {
    register('order-page', () => ['Dyeing Plan']);
    expect(unloadPrompts()).toBe(true);
    expect(confirms).toEqual([]);
  });
});

describe('useUnsavedChanges', () => {
  it('registers while the labels are not empty and reports the labels of the latest render', () => {
    const view = render(<Dirty id="order-page" labels={[]} />);
    expect(getUnsavedLabels()).toEqual([]);
    expect(unloadPrompts()).toBe(false);
    view.rerender(<Dirty id="order-page" labels={['Dyeing Plan']} />);
    expect(getUnsavedLabels()).toEqual(['Dyeing Plan']);
    expect(unloadPrompts()).toBe(true);
    view.rerender(<Dirty id="order-page" labels={['Dyeing Plan', 'Delivery Plan (Lock)']} />);
    expect(getUnsavedLabels()).toEqual(['Dyeing Plan', 'Delivery Plan (Lock)']);
    view.rerender(<Dirty id="order-page" labels={[]} />);
    expect(getUnsavedLabels()).toEqual([]);
    expect(unloadPrompts()).toBe(false);
    view.unmount();
  });

  it('a page with nothing unsaved is not registered: no beforeunload listener until it has labels', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const count = (spy: typeof add) => spy.mock.calls.filter(([type]) => type === 'beforeunload').length;
    const view = render(<Dirty id="order-page" labels={[]} />);
    expect(count(add)).toBe(0);
    view.rerender(<Dirty id="order-page" labels={['Dyeing Plan']} />);
    expect(count(add)).toBe(1);
    view.rerender(<Dirty id="order-page" labels={[]} />);
    expect(count(remove)).toBe(1);
    view.unmount();
  });

  it('keeps its place while its labels change; after [] it registers again at the end', () => {
    const page = render(<Dirty id="order-page" labels={['Dyeing Plan']} />);
    const guide = render(<Dirty id="planning-guide" labels={['Planning Guide']} />);
    page.rerender(<Dirty id="order-page" labels={['Knitting Plan', 'Dyeing Plan']} />);
    expect(getUnsavedLabels()).toEqual(['Knitting Plan', 'Dyeing Plan', 'Planning Guide']);
    page.rerender(<Dirty id="order-page" labels={[]} />);
    expect(getUnsavedLabels()).toEqual(['Planning Guide']);
    page.rerender(<Dirty id="order-page" labels={['Knitting Plan']} />);
    expect(getUnsavedLabels()).toEqual(['Planning Guide', 'Knitting Plan']);
    page.unmount();
    guide.unmount();
  });

  it('unregisters on unmount and when the id changes', () => {
    const view = render(<Dirty id="plan-check-list" labels={['Plan Check List']} />);
    view.rerender(<Dirty id="plan-check-list-2" labels={['Plan Check List']} />);
    expect(getUnsavedLabels()).toEqual(['Plan Check List']);
    register('other', () => ['Other']);
    view.rerender(<Dirty id="plan-check-list" labels={['Plan Check List']} />);
    expect(getUnsavedLabels()).toEqual(['Other', 'Plan Check List']);
    view.unmount();
    expect(getUnsavedLabels()).toEqual(['Other']);
  });
});

describe('confirmLeave and guardLinkNavigate', () => {
  it('confirmLeave() asks "Unsaved changes in: <A, B>. Leave without saving?" and returns the answer', () => {
    register('order-page', () => ['Dyeing Plan', 'Delivery Plan (Lock)']);
    answer = false;
    expect(confirmLeave()).toBe(false);
    answer = true;
    expect(confirmLeave()).toBe(true);
    expect(confirms).toEqual([MESSAGE, MESSAGE]);
  });

  it('one source: "Unsaved changes in: Plan Check List. Leave without saving?"', () => {
    register('plan-check-list', () => ['Plan Check List']);
    confirmLeave();
    expect(confirms).toEqual(['Unsaved changes in: Plan Check List. Leave without saving?']);
  });

  it('guardLinkNavigate() cancels the navigation only when the user stays', () => {
    const event = { preventDefault: vi.fn() };
    expect(guardLinkNavigate(event)).toBe(true);
    expect(confirms).toEqual([]);
    expect(event.preventDefault).not.toHaveBeenCalled();

    register('order-page', () => ['Dyeing Plan', 'Delivery Plan (Lock)']);
    answer = false;
    expect(guardLinkNavigate(event)).toBe(false);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    answer = true;
    expect(guardLinkNavigate(event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(confirms).toEqual([MESSAGE, MESSAGE]);
  });
});

describe('guardedLinkHandlers (a link whose click has side effects)', () => {
  it('nothing unsaved: the side effects run on click; onNavigate neither asks nor cancels', () => {
    const sideEffects = vi.fn();
    const event = { preventDefault: vi.fn() };
    const link = guardedLinkHandlers(sideEffects);
    link.onClick();
    expect(sideEffects).toHaveBeenCalledTimes(1);
    link.onNavigate(event);
    expect(sideEffects).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(confirms).toEqual([]);
  });

  it('unsaved work: nothing on click; Cancel cancels with no side effect; OK runs the side effects', () => {
    register('order-page', () => ['Dyeing Plan', 'Delivery Plan (Lock)']);
    const sideEffects = vi.fn();
    const link = guardedLinkHandlers(sideEffects);

    const cancelled = { preventDefault: vi.fn() };
    answer = false;
    link.onClick();
    expect(sideEffects).not.toHaveBeenCalled();
    link.onNavigate(cancelled);
    expect(cancelled.preventDefault).toHaveBeenCalledTimes(1);
    expect(sideEffects).not.toHaveBeenCalled();

    const accepted = { preventDefault: vi.fn() };
    answer = true;
    link.onClick();
    link.onNavigate(accepted);
    expect(accepted.preventDefault).not.toHaveBeenCalled();
    expect(sideEffects).toHaveBeenCalledTimes(1);
    expect(confirms).toEqual([MESSAGE, MESSAGE]);
  });

  it('unsaved work and a Ctrl/Cmd-click (Next calls onClick only): no prompt, no side effects', () => {
    register('order-page', () => ['Dyeing Plan']);
    const sideEffects = vi.fn();
    guardedLinkHandlers(sideEffects).onClick();
    expect(sideEffects).not.toHaveBeenCalled();
    expect(confirms).toEqual([]);
  });

  it('decides once per click: work saved between two clicks of the same link is seen by the next click', () => {
    let labels = ['Dyeing Plan'];
    register('order-page', () => labels);
    const sideEffects = vi.fn();
    const link = guardedLinkHandlers(sideEffects);
    answer = false;
    link.onClick();
    link.onNavigate({ preventDefault: () => {} });
    expect(sideEffects).not.toHaveBeenCalled();
    labels = [];
    link.onClick();
    link.onNavigate({ preventDefault: () => {} });
    expect(sideEffects).toHaveBeenCalledTimes(1);
    expect(confirms).toEqual(['Unsaved changes in: Dyeing Plan. Leave without saving?']);
  });
});

describe('confirmPageLeave (full page load: Sign Out, window.location)', () => {
  it('nothing unsaved: true without asking', () => {
    expect(confirmPageLeave()).toBe(true);
    expect(confirms).toEqual([]);
  });

  it('Cancel: false, and the browser prompt still protects the page', () => {
    register('order-page', () => ['Dyeing Plan', 'Delivery Plan (Lock)']);
    answer = false;
    expect(confirmPageLeave()).toBe(false);
    expect(confirms).toEqual([MESSAGE]);
    expect(unloadPrompts()).toBe(true);
  });

  it('OK: true, and that page load is not asked a second time by the browser prompt (once only)', () => {
    register('order-page', () => ['Dyeing Plan', 'Delivery Plan (Lock)']);
    answer = true;
    expect(confirmPageLeave()).toBe(true);
    expect(confirms).toEqual([MESSAGE]);
    expect(unloadPrompts()).toBe(false);
    expect(unloadPrompts()).toBe(true);
  });

  it('an unused skip ends with the last source', () => {
    const unregister = register('order-page', () => ['Dyeing Plan']);
    answer = true;
    expect(confirmPageLeave()).toBe(true);
    unregister();
    register('order-page', () => ['Dyeing Plan']);
    expect(unloadPrompts()).toBe(true);
  });
});
