// @vitest-environment-options {"url": "http://planning-guide.test/planning/knitting/V3T-GUIDE-1"}
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harnessState } from '../harness/state';
import { ADMIN, STANDARD, signIn, type Item } from '../plan-check-list/mock-server';
import { GuideServer, guidePath, type StoredGuide } from './guide-server';
import type { PlanGuide } from '@/features/planning/lib/plan-guide-api';
import type { SaveExtra } from '@/features/planning/lib/use-planning-guide';

// The order page's Checkpoint & Planning Guide card (SPEC D10-D13, C4) against an in-memory port of the server's
// guide API: defaults, the user's example, the lead rule and its tooltip, saving and showing a saved guide, the
// "changed since saved" hints with Apply, 409 with Reload, invalid T&A, the Knit warning, Inactive / Removed
// criteria, the Save Data step and the unsaved-work guard.

const TOKEN = 'guide-token';
const ORDER_NO = 'V3T-GUIDE-1';
/** The user's example: T&A Knitting 2 to 21 October 2026. */
const EXAMPLE = {
  orderNo: ORDER_NO,
  buyer: 'V3T BUYER',
  yarnDate: '2026-09-28',
  knitStart: '2026-10-02',
  knitEnd: '2026-10-21',
  dyeStart: '2026-10-15',
  dyeEnd: '2026-10-30',
  deliStart: '2026-11-02',
  deliEnd: '2026-11-12',
};
const LABELS = ['YD Start', 'YD End', 'Knit Start', 'Knit End', 'Dye Start', 'Dye End', 'Floor Start', 'Floor End', 'Lock Start', 'Lock End'];
const KEYS = ['ydStart', 'ydEnd', 'knitStart', 'knitEnd', 'dyeStart', 'dyeEnd', 'floorStart', 'floorEnd', 'lockStart', 'lockEnd'];
const EXAMPLE_LIVE = {
  ydStart: '2026-09-28',
  ydEnd: '',
  knitStart: '2026-10-02',
  knitEnd: '2026-10-21',
  dyeStart: '2026-10-15',
  dyeEnd: '2026-10-30',
  floorStart: '2026-11-02',
  floorEnd: '2026-11-12',
  lockStart: '',
  lockEnd: '',
};

type Modules = {
  PlanningGuideCard: typeof import('@/features/planning/components/PlanningGuideCard').default;
  guard: typeof import('@/lib/unsaved-changes');
  cache: typeof import('@/features/planning/lib/planning-cache');
};

// Fresh modules for every test: an empty shared Plan Check List copy, unsaved-work store and detail cache.
async function freshModules(): Promise<Modules> {
  vi.resetModules();
  const { default: PlanningGuideCard } = await import('@/features/planning/components/PlanningGuideCard');
  const guard = await import('@/lib/unsaved-changes');
  const cache = await import('@/features/planning/lib/planning-cache');
  return { PlanningGuideCard, guard, cache };
}

let server: GuideServer;
let confirms: string[];
let answers: boolean[];
let extras: Array<SaveExtra | null>;
let changes: PlanGuide[];

function startServer(list: Item[] = STANDARD, order: Record<string, unknown> = EXAMPLE): GuideServer {
  server = new GuideServer({ list }).install();
  server.addUser(TOKEN, ADMIN);
  server.addOrder(order);
  return server;
}

interface Shown {
  m: Modules;
  rerender: (props?: Partial<CardProps>) => void;
  unmount: () => void;
  container: HTMLElement;
}
interface CardProps {
  orderNo: string;
  order: Record<string, unknown> | null;
  guide: PlanGuide | StoredGuide | null | undefined;
}

/** Renders the card the way the order page will: the order and guide of its full detail answer. */
async function showCard(props: Partial<CardProps> = {}, m?: Modules): Promise<Shown> {
  const mods = m ?? (await freshModules());
  const base: CardProps = { orderNo: ORDER_NO, order: EXAMPLE, guide: null, ...props };
  const element = (p: CardProps) => (
    <mods.PlanningGuideCard
      orderNo={p.orderNo}
      order={p.order}
      guide={p.guide as PlanGuide | null}
      onSaveExtraChange={(extra) => extras.push(extra)}
      onGuideChange={(guide) => changes.push(guide)}
    />
  );
  const view = render(element(base));
  if (base.order) await waitFor(() => expect(screen.queryByText('Loading the Plan Check List…')).toBeNull());
  return {
    m: mods,
    rerender: (next = {}) => view.rerender(element({ ...base, ...next })),
    unmount: () => view.unmount(),
    container: view.container,
  };
}

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const select = (name: string) => screen.getByLabelText(`${name}: Yes or No`) as HTMLSelectElement;
const setYes = (name: string, yes: boolean) => fireEvent.change(select(name), { target: { value: yes ? 'Yes' : 'No' } });
const setDate = (label: string, value: string) => fireEvent.change(input(label), { target: { value } });
const saveButton = () => screen.getByRole('button', { name: 'Save Guide' }) as HTMLButtonElement;
const shownDates = () => Object.fromEntries(KEYS.map((key, i) => [key, input(LABELS[i]).value]));
const badge = (container: HTMLElement) => container.querySelector('[data-guide-lead]') as HTMLElement | null;
const hint = (container: HTMLElement, row: string) => container.querySelector(`[data-guide-hint="${row}"]`) as HTMLElement | null;
const guideRow = (container: HTMLElement, row: string) => container.querySelector(`[data-guide-row="${row}"]`) as HTMLElement;
const criterionNames = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-criterion]')].map((el) => el.getAttribute('data-criterion'));
const lastExtra = () => extras[extras.length - 1];

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

async function clickSave() {
  const puts = server.requests('PUT').length;
  fireEvent.click(saveButton());
  await waitFor(() => expect(server.requests('PUT')).toHaveLength(puts + 1));
  await waitFor(() => expect(saveButton().disabled).toBe(false));
}

function unloadPrompts(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  signIn(TOKEN, ADMIN);
  localStorage.removeItem('planningGuideCard.hidden');
  confirms = [];
  answers = [];
  extras = [];
  changes = [];
  vi.stubGlobal('confirm', (message: string) => {
    confirms.push(message);
    return answers.length > 0 ? (answers.shift() as boolean) : false;
  });
});

afterEach(() => {
  harnessState().fetchHandler = null;
  vi.unstubAllGlobals();
});

describe('before the first save: the live values', () => {
  it('shows the T&A dates, every criterion No, no lead; nothing is unsaved', async () => {
    startServer();
    const { container, m } = await showCard();
    expect(shownDates()).toEqual(EXAMPLE_LIVE);
    expect(criterionNames(container)).toEqual(STANDARD.map((item) => item.id));
    for (const item of STANDARD) expect(select(item.name).value, item.name).toBe('No');
    expect(badge(container)).toBeNull();
    expect(screen.getByTestId('guide-saved-by').textContent).toBe('Not saved yet');
    expect(screen.getByTestId('guide-yes-count').textContent).toBe('0 Yes');
    expect(screen.queryByText('Unsaved')).toBeNull();
    expect(saveButton().disabled).toBe(false);
    expect(lastExtra()).toMatchObject({ key: 'guide', label: 'Planning Guide', isDirty: false });
    expect(m.guard.getUnsavedLabels()).toEqual([]);
    expect(unloadPrompts()).toBe(false);
    // The source of each row, and the guide-only note.
    expect(within(guideRow(container, 'yd')).getByText('T&A Yarn Date (Start only)')).toBeTruthy();
    expect(within(guideRow(container, 'lock')).getByText('Manual (not in the General file)')).toBeTruthy();
    expect(screen.getByText('Guide only: it does not change the Knitting plan, its validations or the T&A dates.')).toBeTruthy();
    // Only the Plan Check List was read; the guide comes from the page's detail answer.
    expect(server.requests()).toEqual([]);
  });

  it("the user's example: Heatset Yes gives Knit 2026-10-12..2026-10-28 with the badge +10d / +7d", async () => {
    startServer();
    const { container, m } = await showCard();
    setYes('Heatset', true);
    expect(input('Knit Start').value).toBe('2026-10-12');
    expect(input('Knit End').value).toBe('2026-10-28');
    expect(shownDates()).toEqual({ ...EXAMPLE_LIVE, knitStart: '2026-10-12', knitEnd: '2026-10-28' });
    expect(badge(container)?.textContent).toBe('+10d / +7d Checklist Lead Time');
    expect(badge(container)?.getAttribute('title')).toBe('Heatset +10/+7 → largest start +10d (Heatset), largest end +7d (Heatset)');
    expect(screen.getByText('Unsaved')).toBeTruthy();
    expect(screen.getByTestId('guide-yes-count').textContent).toBe('1 Yes');
    expect(lastExtra()).toMatchObject({ key: 'guide', label: 'Planning Guide', isDirty: true });
    expect(m.guard.getUnsavedLabels()).toEqual(['Planning Guide']);
    expect(unloadPrompts()).toBe(true);

    // Back to No: the live values again, nothing unsaved.
    setYes('Heatset', false);
    expect(shownDates()).toEqual(EXAMPLE_LIVE);
    expect(badge(container)).toBeNull();
    expect(screen.queryByText('Unsaved')).toBeNull();
    expect(lastExtra()?.isDirty).toBe(false);
    expect(m.guard.getUnsavedLabels()).toEqual([]);
  });

  it('A 10/3 + B 8/7 gives +10 / +7 (per-column maxima), the tooltip naming A and B', async () => {
    startServer([
      { id: 'a', name: 'A', startDays: 10, endDays: 3, active: true },
      { id: 'b', name: 'B', startDays: 8, endDays: 7, active: true },
      { id: 'c', name: 'C', startDays: 20, endDays: 20, active: false },
    ]);
    const { container } = await showCard();
    // Inactive criteria are offered only where the order already has them as Yes.
    expect(criterionNames(container)).toEqual(['a', 'b']);
    setYes('A', true);
    expect(badge(container)?.textContent).toBe('+10d / +3d Checklist Lead Time');
    setYes('B', true);
    expect(badge(container)?.textContent).toBe('+10d / +7d Checklist Lead Time');
    expect(badge(container)?.getAttribute('title')).toBe('A +10/+3, B +8/+7 → largest start +10d (A), largest end +7d (B)');
    expect(input('Knit Start').value).toBe('2026-10-12');
    expect(input('Knit End').value).toBe('2026-10-28');
  });

  it('a Yes/No change recomputes Knit from the T&A and the lead, replacing manual Knit edits; other edits stay', async () => {
    startServer();
    const { container } = await showCard();
    setDate('Knit Start', '2026-10-05');
    setDate('Lock Start', '2026-11-20');
    expect(within(guideRow(container, 'knit')).getByText('Edited')).toBeTruthy();
    // The Lock row has no T&A: a date there is not "Edited".
    expect(within(guideRow(container, 'lock')).queryByText('Edited')).toBeNull();
    setYes('CPB', true);
    expect(input('Knit Start').value).toBe('2026-10-14');
    expect(input('Knit End').value).toBe('2026-10-30');
    expect(input('Lock Start').value).toBe('2026-11-20');
    expect(within(guideRow(container, 'knit')).queryByText('Edited')).toBeNull();
    setYes('Heatset', true);
    // CPB 12/9 holds both maxima over Heatset 10/7.
    expect(badge(container)?.textContent).toBe('+12d / +9d Checklist Lead Time');
    expect(input('Knit Start').value).toBe('2026-10-14');
  });

  it('while the order details load: no dates, Save Guide disabled, no request; the Save Data step refuses', async () => {
    startServer();
    const { rerender } = await showCard({ order: null });
    expect(screen.getByText("Loading the order's T&A dates…")).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    expect(screen.queryByLabelText('Knit Start')).toBeNull();
    await expect((lastExtra() as SaveExtra).save()).rejects.toThrow('The order is still loading. Try again in a moment.');
    rerender({ order: EXAMPLE });
    await waitFor(() => expect(input('Knit Start').value).toBe('2026-10-02'));
    expect(server.requests('PUT')).toEqual([]);
  });

  it('a list-row header of another order (no full details yet) is not used', async () => {
    startServer();
    await showCard({ order: { ...EXAMPLE, orderNo: 'OTHER-1' } });
    expect(screen.queryByLabelText('Knit Start')).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });
});

describe('saving and showing a saved guide', () => {
  it('Save Guide sends everything shown; the saved guide is shown again later, and the next save sends its version', async () => {
    startServer();
    const first = await showCard();
    // Order details already cached for two departments: the saved guide goes into them (and only them).
    first.m.cache.setPrecachedOrderDetail('knitting', ORDER_NO, { order: EXAMPLE, planData: null });
    first.m.cache.setPrecachedOrderDetail('dyeing', ORDER_NO, { order: EXAMPLE, planData: null });

    setYes('Heatset', true);
    setDate('Lock Start', '2026-11-20');
    setDate('Lock End', '2026-11-25');
    await clickSave();

    const put = server.requests('PUT')[0];
    expect(put.path).toBe(guidePath(ORDER_NO));
    expect(put.auth).toBe(`Bearer ${TOKEN}`);
    const sentDates = { ...EXAMPLE_LIVE, knitStart: '2026-10-12', knitEnd: '2026-10-28', lockStart: '2026-11-20', lockEnd: '2026-11-25' };
    // No version before the first save.
    expect(put.body).toEqual({ yesIds: ['heatset'], dates: sentDates });

    const stored = server.guides.get(ORDER_NO) as StoredGuide;
    expect(stored).toMatchObject({
      version: 1,
      yesIds: ['heatset'],
      dates: sentDates,
      lead: { startDays: 10, endDays: 7, startFrom: ['Heatset'], endFrom: ['Heatset'], startFromIds: ['heatset'], endFromIds: ['heatset'] },
      updatedBy: 'admin',
    });
    await waitFor(() => expect(screen.getByText(`Planning Guide saved for Order #${ORDER_NO}.`)).toBeTruthy());
    expect(screen.getByTestId('guide-saved-by').textContent).toBe('Saved by admin, 21-Nov-2026 06:01');
    expect(screen.queryByText('Unsaved')).toBeNull();
    expect(lastExtra()?.isDirty).toBe(false);
    expect(first.m.guard.getUnsavedLabels()).toEqual([]);
    expect(shownDates()).toEqual(sentDates);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ orderNo: ORDER_NO, version: 1, yesIds: ['heatset'], dates: sentDates });

    // The PUT answer is in the cached details of every department that had them.
    const cached = (dept: string) => first.m.cache.cachedOrderDetails.get(`${dept}_${ORDER_NO}`) as { guide?: PlanGuide } | undefined;
    expect(cached('knitting')?.guide).toMatchObject({ version: 1, yesIds: ['heatset'] });
    expect(cached('dyeing')?.guide).toMatchObject({ version: 1 });
    expect(cached('yd')).toBeUndefined();
    expect(first.m.cache.cachedOrderDetails.size).toBe(2);

    // A stale guide from the page (older than the saved one) does not replace it.
    first.rerender({ guide: null });
    expect(shownDates()).toEqual(sentDates);
    first.unmount();

    // Later: the page opens with the guide of its detail answer; the stored values are shown, nothing unsaved.
    const detail = (await (await server.handle(`http://api.test/api/orders/${ORDER_NO}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json()) as {
      guide: StoredGuide;
    };
    extras = [];
    const second = await showCard({ guide: detail.guide });
    expect(shownDates()).toEqual(sentDates);
    expect(select('Heatset').value).toBe('Yes');
    expect(badge(second.container)?.textContent).toBe('+10d / +7d Checklist Lead Time');
    expect(second.container.querySelectorAll('[data-guide-hint]')).toHaveLength(0);
    expect(screen.queryByText('Unsaved')).toBeNull();
    expect(lastExtra()?.isDirty).toBe(false);

    setDate('Lock End', '2026-11-27');
    await clickSave();
    expect(server.requests('PUT')[1].body).toEqual({ yesIds: ['heatset'], dates: { ...sentDates, lockEnd: '2026-11-27' }, version: 1 });
    expect(server.guides.get(ORDER_NO)?.version).toBe(2);
    expect(changes[changes.length - 1]).toMatchObject({ version: 2 });
  });

  it('Save Guide also saves an unchanged guide (the defaults before the first save)', async () => {
    startServer();
    await showCard();
    await clickSave();
    expect(server.requests('PUT')[0].body).toEqual({ yesIds: [], dates: EXAMPLE_LIVE });
    expect(server.guides.get(ORDER_NO)).toMatchObject({ version: 1, yesIds: [], lead: { startDays: 0, endDays: 0 } });
  });

  it('the Save Data step: saves through the same request, rejects with the reason and keeps the guide unsaved', async () => {
    startServer();
    const view = await showCard();
    expect(lastExtra()).toMatchObject({ key: 'guide', label: 'Planning Guide', isDirty: false });
    const cleanStep = lastExtra();
    setDate('Lock Start', '2026-11-20');
    const dirtyStep = lastExtra() as SaveExtra;
    expect(dirtyStep).not.toBe(cleanStep);
    expect(dirtyStep.isDirty).toBe(true);
    // Editing more keeps the same step object (it changes only with the dirty flag).
    setDate('Lock End', '2026-11-22');
    expect(lastExtra()).toBe(dirtyStep);

    server.scriptNext({ status: 500, json: { message: 'Server error while saving the Planning Guide.' } });
    let failure: unknown;
    await act(async () => {
      failure = await dirtyStep.save().catch((err: unknown) => err);
    });
    expect((failure as Error).message).toBe('Server error while saving the Planning Guide.');
    expect(screen.getByRole('alert').textContent).toContain('Server error while saving the Planning Guide.');
    expect(lastExtra()?.isDirty).toBe(true);
    expect(view.m.guard.getUnsavedLabels()).toEqual(['Planning Guide']);

    await act(async () => {
      await dirtyStep.save();
    });
    expect(server.requests('PUT')).toHaveLength(2);
    expect(server.guides.get(ORDER_NO)?.dates.lockEnd).toBe('2026-11-22');
    expect(lastExtra()?.isDirty).toBe(false);
    expect(view.m.guard.getUnsavedLabels()).toEqual([]);
    // Save Data shows its own message: the card shows no "saved" toast for it.
    expect(screen.queryByText(`Planning Guide saved for Order #${ORDER_NO}.`)).toBeNull();

    view.unmount();
    expect(lastExtra()).toBeNull();
  });

  it('Discard asks first and goes back to the saved values', async () => {
    startServer();
    await showCard();
    setYes('Singeing', true);
    answers.push(false);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(confirms).toEqual(['Discard your unsaved Planning Guide changes?']);
    expect(select('Singeing').value).toBe('Yes');
    answers.push(true);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(select('Singeing').value).toBe('No');
    expect(shownDates()).toEqual(EXAMPLE_LIVE);
    expect(screen.queryByText('Unsaved')).toBeNull();
  });

  it('an older server without the Planning Guide: the message says to deploy it', async () => {
    startServer();
    server.oldServer = true;
    await showCard();
    setYes('Heatset', true);
    await clickSave();
    expect(screen.getByRole('alert').textContent).toContain(
      'This server does not have the Planning Guide yet. Deploy the updated Next Planning V3 server to save the Planning Guide.'
    );
    expect(screen.getByText('Unsaved')).toBeTruthy();
  });

  it('a 400 shows the server message and keeps the changes', async () => {
    startServer();
    await showCard();
    setYes('Heatset', true);
    server.scriptNext({ status: 400, json: { code: 'INVALID', message: 'dates.knitStart: must be empty or a date (YYYY-MM-DD).' } });
    await clickSave();
    expect(screen.getByRole('alert').textContent).toContain('dates.knitStart: must be empty or a date (YYYY-MM-DD).');
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
    expect(select('Heatset').value).toBe('Yes');
  });
});

/** A guide saved by `username` with the server's own rules, for the order as it was then. */
function storedGuide(
  order: Record<string, unknown>,
  body: { yesIds: string[]; dates: Record<string, string> },
  list: Item[] = STANDARD,
  username = 'admin'
): StoredGuide {
  const at = new GuideServer({ list });
  at.addOrder(order);
  return at.saveDirectly(String(order.orderNo), body as never, username);
}

describe('a saved guide after the T&A or the Plan Check List changed', () => {
  // Saved with Heatset (10/7) on the example T&A, with Floor Start and the Lock dates edited by hand.
  const SAVED_DATES = {
    ...EXAMPLE_LIVE,
    knitStart: '2026-10-12',
    knitEnd: '2026-10-28',
    floorStart: '2026-11-05',
    lockStart: '2026-11-20',
    lockEnd: '2026-11-25',
  };

  it('shows the stored values; a row the T&A changed gets the hint with Apply; rows edited by hand do not', async () => {
    const saved = storedGuide(EXAMPLE, { yesIds: ['heatset'], dates: SAVED_DATES });
    // The next General upload moved T&A Knitting Start and Dyeing End.
    const now = { ...EXAMPLE, knitStart: '2026-10-05', dyeEnd: '2026-11-01' };
    startServer(STANDARD, now);
    server.guides.set(ORDER_NO, saved);
    const { container } = await showCard({ order: now, guide: saved });

    expect(shownDates()).toEqual(SAVED_DATES);
    expect(hint(container, 'knit')?.textContent).toContain('T&A / Check List changed since saved: now 15-Oct-2026 to 28-Oct-2026');
    expect(hint(container, 'dye')?.textContent).toContain('T&A / Check List changed since saved: now 15-Oct-2026 to 01-Nov-2026');
    for (const row of ['yd', 'floor', 'lock']) expect(hint(container, row), row).toBeNull();
    expect(within(guideRow(container, 'floor')).getByText('Edited')).toBeTruthy();
    expect(screen.queryByText('Unsaved')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Apply the new Knit dates' }));
    expect(input('Knit Start').value).toBe('2026-10-15');
    expect(input('Knit End').value).toBe('2026-10-28');
    expect(hint(container, 'knit')).toBeNull();
    expect(hint(container, 'dye')).not.toBeNull();
    expect(screen.getByText('Unsaved')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Apply the new Dye dates' }));
    expect(input('Dye End').value).toBe('2026-11-01');
    await clickSave();
    expect(server.requests('PUT')[0].body).toEqual({
      yesIds: ['heatset'],
      dates: { ...SAVED_DATES, knitStart: '2026-10-15', dyeEnd: '2026-11-01' },
      version: 1,
    });
    // Saved with the new T&A: no hints any more.
    expect(container.querySelectorAll('[data-guide-hint]')).toHaveLength(0);
  });

  it('a Plan Check List change shows on the Knit row (badge = the current lead) until Apply', async () => {
    const saved = storedGuide(EXAMPLE, { yesIds: ['heatset'], dates: SAVED_DATES });
    startServer(STANDARD.map((item) => (item.id === 'heatset' ? { ...item, startDays: 12 } : item)));
    const { container } = await showCard({ guide: saved });
    expect(input('Knit Start').value).toBe('2026-10-12');
    expect(badge(container)?.textContent).toBe('+12d / +7d Checklist Lead Time');
    expect(hint(container, 'knit')?.textContent).toContain('now 14-Oct-2026 to 28-Oct-2026');
    for (const row of ['yd', 'dye', 'floor', 'lock']) expect(hint(container, row), row).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apply the new Knit dates' }));
    expect(input('Knit Start').value).toBe('2026-10-14');
    expect(hint(container, 'knit')).toBeNull();
  });

  it('hand edits with nothing changed since the save: no hint at all', async () => {
    const saved = storedGuide(EXAMPLE, { yesIds: ['heatset'], dates: { ...SAVED_DATES, knitStart: '2026-10-13', ydEnd: '2026-10-01' } });
    startServer();
    const { container } = await showCard({ guide: saved });
    expect(container.querySelectorAll('[data-guide-hint]')).toHaveLength(0);
    expect(within(guideRow(container, 'knit')).getByText('Edited')).toBeTruthy();
  });
});

describe('409: someone else saved the guide first', () => {
  it('shows the server message with Reload; Reload asks, loads the latest guide and the next save sends its version', async () => {
    const saved = storedGuide(EXAMPLE, { yesIds: ['heatset'], dates: { ...EXAMPLE_LIVE, knitStart: '2026-10-12', knitEnd: '2026-10-28' } });
    startServer();
    server.guides.set(ORDER_NO, saved);
    const { container } = await showCard({ guide: saved });
    // Another planner saves CPB from their own browser.
    server.saveDirectly(ORDER_NO, { yesIds: ['cpb'], dates: { ...EXAMPLE_LIVE, knitStart: '2026-10-14', knitEnd: '2026-10-30' } }, 'planner9');

    setYes('Singeing', true);
    await clickSave();
    expect(server.requests('PUT')[0].body).toMatchObject({ version: 1 });
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('alert-warning');
    expect(alert.textContent).toContain(
      'The Planning Guide of this order was changed by planner9 at 21-Nov-2026 06:01. Reload the page to see the latest values.'
    );
    // The changes stay.
    expect(select('Singeing').value).toBe('Yes');
    expect(screen.getByText('Unsaved')).toBeTruthy();

    answers.push(false);
    fireEvent.click(within(alert).getByRole('button', { name: 'Reload' }));
    expect(confirms).toEqual(['Discard your unsaved Planning Guide changes and load the latest Planning Guide?']);
    expect(server.requests('GET')).toHaveLength(0);

    answers.push(true);
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    const get = server.requests('GET')[0];
    expect(get.path).toBe(`/api/orders/${ORDER_NO}`);
    expect(get.query).toBe('?fresh=1');
    expect(select('CPB').value).toBe('Yes');
    expect(select('Singeing').value).toBe('No');
    expect(input('Knit Start').value).toBe('2026-10-14');
    expect(badge(container)?.textContent).toBe('+12d / +9d Checklist Lead Time');
    expect(screen.queryByText('Unsaved')).toBeNull();
    expect(changes[changes.length - 1]).toMatchObject({ version: 2, updatedBy: 'planner9' });

    setDate('Lock Start', '2026-11-20');
    await clickSave();
    expect(server.requests('PUT')[1].body).toMatchObject({ version: 2 });
    expect(server.guides.get(ORDER_NO)?.version).toBe(3);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a first save that someone else beat: 409 although no version was sent', async () => {
    startServer();
    await showCard();
    server.saveDirectly(ORDER_NO, { yesIds: [], dates: EXAMPLE_LIVE }, 'planner9');
    setYes('Heatset', true);
    await clickSave();
    expect(server.requests('PUT')[0].body).not.toHaveProperty('version');
    expect(screen.getByRole('alert').textContent).toContain('was changed by planner9');
    expect(within(screen.getByRole('alert')).getByRole('button', { name: 'Reload' })).toBeTruthy();
  });
});

describe('T&A that is not a date, and the Knit warning', () => {
  it('a blank cell with the raw T&A text as a hint, never shifted', async () => {
    const odd = { ...EXAMPLE, yarnDate: '', knitStart: 'TBA', knitEnd: '-', dyeStart: 46297, dyeEnd: '2026-02-30', deliStart: 'N/A' };
    startServer(STANDARD, odd);
    const { container } = await showCard({ order: odd });
    expect(shownDates()).toEqual({ ...EXAMPLE_LIVE, ydStart: '', knitStart: '', knitEnd: '', dyeStart: '2026-10-02', dyeEnd: '', floorStart: '' });
    const hints = (row: string) => [...guideRow(container, row).querySelectorAll('td')].map((td) => td.querySelector('div')?.textContent ?? '');
    expect(hints('knit').slice(1, 3)).toEqual(['T&A: TBA', 'T&A: -']);
    expect(hints('dye').slice(1, 3)).toEqual(['', 'T&A: 2026-02-30']);
    expect(hints('floor').slice(1, 3)).toEqual(['T&A: N/A', '']);
    expect(hints('yd').slice(1, 3)).toEqual(['', '']);
    expect(screen.queryByText('No T&A in the General file for this order.')).toBeNull();

    setYes('Heatset', true);
    expect(input('Knit Start').value).toBe('');
    expect(input('Knit End').value).toBe('');
    expect(badge(container)?.textContent).toBe('+10d / +7d Checklist Lead Time');
  });

  it('an order without any T&A says so', async () => {
    const bare = { orderNo: ORDER_NO, buyer: 'V3T BUYER' };
    startServer(STANDARD, bare);
    await showCard({ order: bare });
    expect(screen.getByText('No T&A in the General file for this order.')).toBeTruthy();
    expect(shownDates()).toEqual(Object.fromEntries(KEYS.map((key) => [key, ''])));
  });

  it('Knit Start after Knit End after the shift: an amber warning only, saving still works', async () => {
    const short = { ...EXAMPLE, knitStart: '2026-10-02', knitEnd: '2026-10-03' };
    startServer(STANDARD, short);
    await showCard({ order: short });
    expect(screen.queryByText(/is after Knit End/)).toBeNull();
    setYes('Heatset', true);
    expect(input('Knit Start').value).toBe('2026-10-12');
    expect(input('Knit End').value).toBe('2026-10-10');
    expect(screen.getByRole('status').textContent).toContain('Knit Start (12-Oct-2026) is after Knit End (10-Oct-2026).');
    expect(saveButton().disabled).toBe(false);
    await clickSave();
    expect(server.guides.get(ORDER_NO)?.dates).toMatchObject({ knitStart: '2026-10-12', knitEnd: '2026-10-10' });
  });
});

describe('Inactive and Removed criteria', () => {
  it('are decided against the CURRENT Plan Check List, shown only while Yes, and never count', async () => {
    // Saved when the list had CPB active and the criteria "Old one" (since deleted) and Semibleach.
    const thenList: Item[] = [
      ...STANDARD,
      { id: 'chk_old', name: 'Old one', startDays: 30, endDays: 30, active: true },
    ];
    // Its Knit dates were set to what Heatset alone gives (the list then also had the 30-day criterion).
    const knitByHeatset = { ...EXAMPLE_LIVE, knitStart: '2026-10-12', knitEnd: '2026-10-28' };
    const saved = storedGuide(EXAMPLE, { yesIds: ['heatset', 'cpb', 'chk_old', 'semibleach'], dates: knitByHeatset }, thenList);
    expect(saved.lead).toMatchObject({ startDays: 30, endDays: 30, startFrom: ['Old one'] });
    // The snapshot keeps every saved criterion, CPB as active.
    expect(saved.checks.find((check) => check.id === 'cpb')?.active).toBe(true);
    // Now: CPB is inactive, "Old one" and Semibleach are no longer in the list.
    const nowList = STANDARD.filter((item) => item.id !== 'semibleach').map((item) => (item.id === 'cpb' ? { ...item, active: false } : item));
    startServer(nowList);
    const { container } = await showCard({ guide: saved });

    const active = nowList.filter((item) => item.active).map((item) => item.id);
    expect(criterionNames(container)).toEqual([...active, 'cpb', 'chk_old', 'semibleach']);
    const badgeOf = (id: string) => container.querySelector(`[data-criterion="${id}"]`)?.textContent ?? '';
    expect(badgeOf('cpb')).toContain('Inactive');
    expect(badgeOf('chk_old')).toContain('Removed');
    expect(badgeOf('chk_old')).toContain('Old one');
    expect(badgeOf('semibleach')).toContain('Removed');
    expect(badgeOf('heatset')).not.toMatch(/Inactive|Removed/);
    // Only Heatset counts.
    expect(badge(container)?.textContent).toBe('+10d / +7d Checklist Lead Time');
    expect(badge(container)?.getAttribute('title')).toBe('Heatset +10/+7 → largest start +10d (Heatset), largest end +7d (Heatset)');

    // No hint: the Knit row already shows what the counted criteria give now.
    expect(container.querySelectorAll('[data-guide-hint]')).toHaveLength(0);

    // Set to No: still listed until saved; Knit is recomputed from Heatset alone; back to Yes: nothing unsaved.
    setYes('CPB', false);
    expect(criterionNames(container)).toContain('cpb');
    expect(select('CPB').value).toBe('No');
    expect(input('Knit Start').value).toBe('2026-10-12');
    expect(input('Knit End').value).toBe('2026-10-28');
    expect(screen.getByText('Unsaved')).toBeTruthy();
    setYes('CPB', true);
    expect(screen.queryByText('Unsaved')).toBeNull();

    setYes('Old one', false);
    await clickSave();
    expect(server.requests('PUT')[0].body).toMatchObject({ yesIds: ['heatset', 'cpb', 'semibleach'], version: 1 });
  });
});

describe('the guide prop and the card state', () => {
  it('a newer guide from the page replaces the shown one when nothing is unsaved; unsaved changes are kept', async () => {
    const saved = storedGuide(EXAMPLE, { yesIds: [], dates: EXAMPLE_LIVE });
    startServer();
    const view = await showCard({ guide: saved });
    const newer = { ...saved, version: 2, yesIds: ['heatset'], dates: { ...EXAMPLE_LIVE, knitStart: '2026-10-12', knitEnd: '2026-10-28' } };
    view.rerender({ guide: newer });
    expect(select('Heatset').value).toBe('Yes');
    expect(input('Knit Start').value).toBe('2026-10-12');

    setDate('Lock Start', '2026-11-20');
    view.rerender({ guide: { ...newer, version: 3, dates: { ...newer.dates, lockEnd: '2026-12-01' } } });
    expect(input('Lock Start').value).toBe('2026-11-20');
    expect(input('Lock End').value).toBe('');
    expect(screen.getByText('Unsaved')).toBeTruthy();
  });

  it('Hide is remembered in this browser', async () => {
    startServer();
    const view = await showCard();
    fireEvent.click(screen.getByTitle('Hide the Planning Guide'));
    expect(screen.queryByLabelText('Knit Start')).toBeNull();
    expect(localStorage.getItem('planningGuideCard.hidden')).toBe('1');
    view.unmount();
    await showCard();
    expect(screen.queryByLabelText('Knit Start')).toBeNull();
    fireEvent.click(screen.getByTitle('Show the Planning Guide'));
    expect(input('Knit Start').value).toBe('2026-10-02');
    expect(localStorage.getItem('planningGuideCard.hidden')).toBeNull();
    await settle();
  });

  it('a failed Plan Check List load shows the message with Retry', async () => {
    startServer();
    server.lists.scriptNext({ status: 500, json: { message: 'Server error while loading the Plan Check List.' } });
    const m = await freshModules();
    render(<m.PlanningGuideCard orderNo={ORDER_NO} order={EXAMPLE} guide={null} />);
    await waitFor(() => expect(screen.getByText('Server error while loading the Plan Check List.')).toBeTruthy());
    // Dates still show and can be saved.
    expect(input('Knit Start').value).toBe('2026-10-02');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(select('Heatset').value).toBe('No'));
    expect(screen.queryByText('Server error while loading the Plan Check List.')).toBeNull();
  });
});
