// @vitest-environment-options {"url": "http://plan-check-list.test/management/plan-check-list"}
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harnessState } from '../harness/state';
import { ADMIN, EDITOR, LIST_URL, PLANNER, PlanCheckListServer, SESSION_KEYS, STANDARD, signIn, type Item, type MockUser } from './mock-server';

// Data Management > Plan Check List page (SPEC C3): access, load, edits, saving through the server's validation,
// 409, Reset to Standard, deleting used criteria, the sign-out rules and the unsaved-work guard.

const TOKEN = 'test-token';
const PAGE_HREF = 'http://plan-check-list.test/management/plan-check-list';
const UNSAVED_MESSAGE = 'Unsaved changes in: Plan Check List. Leave without saving?';

type Modules = {
  PlanCheckListScreen: typeof import('@/features/management/components/PlanCheckListScreen').default;
  data: typeof import('@/features/management/lib/plan-check-list');
  guard: typeof import('@/lib/unsaved-changes');
};

// Fresh modules for every test: an empty shared copy of the list and an empty unsaved-work store.
async function freshModules(): Promise<Modules> {
  vi.resetModules();
  const { default: PlanCheckListScreen } = await import('@/features/management/components/PlanCheckListScreen');
  const data = await import('@/features/management/lib/plan-check-list');
  const guard = await import('@/lib/unsaved-changes');
  return { PlanCheckListScreen, data, guard };
}

let server: PlanCheckListServer;
let confirms: string[];
let answers: boolean[];
let location: { href: string; pathname: string };

/** Signs `user` in on the page and on the mocked server (the server may know the user differently). */
function setUser(user: MockUser, serverUser: MockUser = user): void {
  signIn(TOKEN, user);
  server.addUser(TOKEN, serverUser);
}

async function openPage(m: Modules) {
  const view = render(<m.PlanCheckListScreen />);
  await waitFor(() => expect(screen.getByTestId('plan-check-list-status').textContent).toMatch(/criteri/));
  await waitFor(() => expect(button('Reload').disabled).toBe(false));
  return view;
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const status = () => screen.getByTestId('plan-check-list-status').textContent;
const alertBox = () => screen.getByRole('alert');
/** The message of the alert (without its buttons). */
const noticeText = () => alertBox().querySelector('span')?.textContent;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

/** The draft on screen: [name, start, end, active] per row. */
function draft(): Array<[string, string, string, boolean]> {
  const rows: Array<[string, string, string, boolean]> = [];
  for (let n = 1; ; n++) {
    const name = screen.queryByLabelText(`Criteria name, row ${n}`) as HTMLInputElement | null;
    if (!name) return rows;
    rows.push([name.value, field(`Start days, row ${n}`).value, field(`End days, row ${n}`).value, field(`Active, row ${n}`).checked]);
  }
}
const asDraft = (items: Item[]) => items.map((i): [string, string, string, boolean] => [i.name, String(i.startDays), String(i.endDays), i.active]);

/** Lets pending promises and effects settle. */
const settle = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 10));
});

function unloadPrompts(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

const signedIn = () => SESSION_KEYS.every((key) => localStorage.getItem(key) !== null);

beforeEach(() => {
  server = new PlanCheckListServer().install();
  confirms = [];
  answers = [];
  vi.stubGlobal('confirm', (message: string) => {
    confirms.push(message);
    return answers.length > 0 ? (answers.shift() as boolean) : false;
  });
  // Signing out loads /login (a full page load), which jsdom cannot do: the tests read the URL it was sent to.
  location = { href: PAGE_HREF, pathname: '/management/plan-check-list' };
  vi.stubGlobal('location', location);
});

afterEach(() => {
  harnessState().fetchHandler = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('access', () => {
  it('without the permission: Access denied, the API is never called, nothing is registered as unsaved', async () => {
    const noAccess: MockUser[] = [
      PLANNER,
      // the key must be exactly true, as on the server
      { username: 'planner3', role: 'Planner', permissions: { menus: { dataManagement: { planCheckList: 'true' } } } },
      // Approver is not Admin; other Data Management permissions do not count
      { username: 'approver', role: 'Approver', permissions: { menus: { dataManagement: { setup: true, atlasMonitor: true } } } },
      { username: 'viewer', role: 'Viewer', permissions: {} },
    ];
    for (const user of noAccess) {
      setUser(user);
      const m = await freshModules();
      const view = render(<m.PlanCheckListScreen />);
      expect(screen.getByRole('heading', { name: 'Access denied' })).toBeTruthy();
      expect(screen.getByText('Plan Check List needs the Plan Check List permission (Data Management). Ask an Admin.')).toBeTruthy();
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
      await settle();
      expect(server.log, user.username).toEqual([]);
      expect(m.guard.getUnsavedLabels()).toEqual([]);
      view.unmount();
    }
    // not even the stored list was created
    expect(server.list).toBeNull();
  });

  it('a signed-in user without a stored user record falls back to the single keys (role Admin passes)', async () => {
    localStorage.clear();
    localStorage.setItem('token', TOKEN);
    localStorage.setItem('role', 'Admin');
    server.addUser(TOKEN, ADMIN);
    const m = await freshModules();
    await openPage(m);
    expect(draft()).toEqual(asDraft(STANDARD));
  });
});

describe('load', () => {
  it('Admin: one GET, the list in order, editable; Save is off until something changes', async () => {
    setUser(ADMIN);
    const m = await freshModules();
    render(<m.PlanCheckListScreen />);
    // first paint: nothing cached yet
    expect(screen.getByText('Loading Plan Check List...')).toBeTruthy();
    expect(status()).toBe('Loading…');
    expect(button('Reload').disabled).toBe(true);
    await screen.findByLabelText('Criteria name, row 1');

    expect(server.requests()).toEqual([{ method: 'GET', url: LIST_URL, auth: `Bearer ${TOKEN}` }]);
    expect(draft()).toEqual(asDraft(STANDARD));
    expect(status()).toBe('9 criteria · 9 active · Saved · Standard list since 21-Nov-2026 06:00');
    expect(screen.getByText('Data Management › Plan Check List')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Plan Check List' })).toBeTruthy();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      '#',
      'Criteria Name',
      'Start (days)',
      'End (days)',
      'Active',
      'Actions',
    ]);
    expect(button('Reload').disabled).toBe(false);
    expect(button('Reset to Standard').disabled).toBe(false);
    expect(button('Save Changes').disabled).toBe(true);
    expect(button('Add Criteria').disabled).toBe(false);
    expect(button('Move Heatset up').disabled).toBe(true);
    expect(button('Move Semibleach down').disabled).toBe(true);
    // every input has an aria-label (name, start, end and the Active toggle of each row)
    const inputs = Array.from(document.querySelectorAll('input'));
    expect(inputs).toHaveLength(9 * 4);
    for (const input of inputs) expect(input.getAttribute('aria-label')).toMatch(/^(Criteria name|Start days|End days|Active), row \d$/);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(m.guard.getUnsavedLabels()).toEqual([]);
  });

  it('a Planner with the permission can edit; usage is shown for the criteria orders use', async () => {
    setUser(EDITOR);
    server.guides = [
      { orderNo: 'A-1', yesIds: ['cpb', 'heatset'] },
      { orderNo: 'A-2', yesIds: ['cpb'] },
    ];
    const m = await freshModules();
    await openPage(m);
    expect(draft()).toEqual(asDraft(STANDARD));
    expect(field('Criteria name, row 1').disabled).toBe(false);
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Yes on 1 order')).toBeTruthy(); // Heatset
    expect(within(rows[3]).getByText('Yes on 2 orders')).toBeTruthy(); // CPB
    expect(screen.getAllByText(/^Yes on /)).toHaveLength(2);
  });

  it('view only when the server says the user may not save (permission removed since login)', async () => {
    setUser(EDITOR, PLANNER);
    const m = await freshModules();
    await openPage(m);
    expect(screen.queryByLabelText('Criteria name, row 1')).toBeNull();
    expect(document.querySelectorAll('input')).toHaveLength(0);
    expect(screen.getByText('View only: saving the Plan Check List needs the Plan Check List permission. Ask an Admin.')).toBeTruthy();
    expect(screen.getByText('Heatset')).toBeTruthy();
    expect(screen.getAllByText('Active')).toHaveLength(1 + 9); // the column header and one badge per row
    expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset to Standard' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Criteria' })).toBeNull();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['#', 'Criteria Name', 'Start (days)', 'End (days)', 'Active']);
    expect(button('Reload').disabled).toBe(false);
  });

  it('a failed load shows the reason (500, no network, an older server) and Reload tries again', async () => {
    setUser(ADMIN);
    server.scriptNext({ status: 500, json: { message: 'Could not load the Plan Check List.' } });
    const m = await freshModules();
    render(<m.PlanCheckListScreen />);
    await waitFor(() => expect(noticeText()).toBe('Could not load the Plan Check List.'));
    expect(alertBox().className).toContain('alert-error');
    expect(screen.getByText('The Plan Check List could not be loaded. Try Reload.')).toBeTruthy();
    expect(status()).toBe('Not loaded');

    server.scriptNext({ networkError: true });
    fireEvent.click(button('Reload'));
    await waitFor(() => expect(noticeText()).toBe('Cannot reach the server (http://api.test). Check the connection and try again.'));

    server.scriptNext({ status: 404, text: '<!DOCTYPE html><html><body><pre>Cannot GET /api/plan-check-list</pre></body></html>' });
    fireEvent.click(button('Reload'));
    await waitFor(() =>
      expect(noticeText()).toBe(
        'This server does not have the Plan Check List yet. Deploy the updated Next Planning V3 server, then reload this page.'
      )
    );

    fireEvent.click(button('Reload'));
    await screen.findByLabelText('Criteria name, row 1');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(draft()).toEqual(asDraft(STANDARD));
    expect(signedIn()).toBe(true);
    expect(location.href).toBe(PAGE_HREF);
    expect(server.requests('GET')).toHaveLength(4);
  });

  it('the shared copy shows at once on the next visit, locked until the latest list has loaded', async () => {
    setUser(ADMIN);
    const m = await freshModules();
    const first = await openPage(m);
    first.unmount();

    server.saveDirectly(STANDARD.map((i) => (i.id === 'cpb' ? { ...i, startDays: 13 } : i)), 'planner1');
    const release = server.holdNext();
    render(<m.PlanCheckListScreen />);
    // the copy from the first visit, at once, not editable yet
    expect(field('Start days, row 3').value).toBe('12');
    expect(field('Start days, row 3').disabled).toBe(true);
    expect(button('Save Changes').disabled).toBe(true);
    release();
    await waitFor(() => expect(field('Start days, row 3').value).toBe('13'));
    expect(field('Start days, row 3').disabled).toBe(false);
    expect(status()).toBe('9 criteria · 9 active · Saved · Last saved by planner1, 21-Nov-2026 06:01');
  });
});

describe('editing and saving', () => {
  it('rename, days, Active, reorder, delete and add stay a draft until Save Changes, which sends the whole list', async () => {
    setUser(ADMIN);
    const m = await freshModules();
    await openPage(m);

    type('Criteria name, row 1', 'Heatset (HT)');
    expect(status()).toBe('9 criteria · 9 active · Unsaved changes · Standard list since 21-Nov-2026 06:00');
    expect(button('Save Changes').disabled).toBe(false);
    type('Start days, row 3', '14');
    fireEvent.click(field('Active, row 5'));
    expect(screen.getAllByText('Inactive')).toHaveLength(1);
    fireEvent.click(button('Move Singeing up'));
    fireEvent.click(button('Delete Peach/brush')); // no order uses it: no question
    expect(confirms).toEqual([]);
    fireEvent.click(button('Add Criteria'));
    expect(document.activeElement).toBe(field('Criteria name, row 9'));
    expect(draft()[8]).toEqual(['', '0', '0', true]);
    type('Criteria name, row 9', '  Enzyme   wash ');
    type('Start days, row 9', '3');
    type('End days, row 9', '2');

    expect(draft()).toEqual([
      ['Heatset (HT)', '10', '7', true],
      ['Singeing', '7', '7', true],
      ['CPB', '14', '9', true],
      ['Subcontract', '0', '0', false],
      ['YD Pre', '6', '4', true],
      ['YD Post', '6', '4', true],
      ['Mercerized', '11', '9', true],
      ['Semibleach', '6', '5', true],
      ['  Enzyme   wash ', '3', '2', true],
    ]);
    expect(status()).toBe('9 criteria · 8 active · Unsaved changes · Standard list since 21-Nov-2026 06:00');
    // nothing was sent yet
    expect(server.requests()).toHaveLength(1);

    fireEvent.click(button('Save Changes'));
    expect(screen.getByRole('button', { name: 'Saving…' }).hasAttribute('disabled')).toBe(true);
    expect(field('Criteria name, row 1').disabled).toBe(true);
    await screen.findByText('Plan Check List saved.');

    const put = server.requests('PUT');
    expect(put).toHaveLength(1);
    expect(put[0]).toEqual({
      method: 'PUT',
      url: LIST_URL,
      auth: `Bearer ${TOKEN}`,
      body: {
        items: [
          { id: 'heatset', name: 'Heatset (HT)', startDays: 10, endDays: 7, active: true },
          { id: 'singeing', name: 'Singeing', startDays: 7, endDays: 7, active: true },
          { id: 'cpb', name: 'CPB', startDays: 14, endDays: 9, active: true },
          { id: 'subcontract', name: 'Subcontract', startDays: 0, endDays: 0, active: false },
          { id: 'yd_pre', name: 'YD Pre', startDays: 6, endDays: 4, active: true },
          { id: 'yd_post', name: 'YD Post', startDays: 6, endDays: 4, active: true },
          { id: 'mercerized', name: 'Mercerized', startDays: 11, endDays: 9, active: true },
          { id: 'semibleach', name: 'Semibleach', startDays: 6, endDays: 5, active: true },
          { name: '  Enzyme   wash ', startDays: 3, endDays: 2, active: true },
        ],
        version: 1,
      },
    });
    // the page now shows what the server stored (its new id, the name as the server cleaned it)
    const stored = server.list;
    expect(stored?.version).toBe(2);
    expect(stored?.value[8]).toMatchObject({ name: 'Enzyme wash', startDays: 3, endDays: 2, active: true });
    expect(stored?.value[8].id).toMatch(/^chk_[0-9a-f]{24}$/);
    expect(draft()).toEqual(asDraft(stored?.value || []));
    expect(status()).toBe('9 criteria · 8 active · Saved · Last saved by admin, 21-Nov-2026 06:01');
    expect(button('Save Changes').disabled).toBe(true);
    expect(m.guard.getUnsavedLabels()).toEqual([]);
    // the shared copy is the saved list, so order pages pick the change up
    const shared = m.data.getCachedPlanCheckList();
    expect(shared?.version).toBe(2);
    expect(shared?.items).toEqual(stored?.value);
  });

  it('moving a row there and back, or typing the saved value again, is not a change', async () => {
    setUser(ADMIN);
    const m = await freshModules();
    await openPage(m);
    fireEvent.click(button('Move CPB down'));
    expect(draft()[3][0]).toBe('CPB');
    expect(status()).toContain('Unsaved changes');
    fireEvent.click(button('Move CPB up'));
    expect(status()).toContain('Saved');
    type('End days, row 1', '07');
    type('Criteria name, row 1', ' Heatset ');
    expect(status()).toContain('· Saved ·');
    expect(button('Save Changes').disabled).toBe(true);
    expect(m.guard.getUnsavedLabels()).toEqual([]);
  });

  it("the server's validation message is shown as it is, its row is marked, and the draft stays", async () => {
    setUser(ADMIN);
    const m = await freshModules();
    await openPage(m);

    type('Start days, row 3', '12.5');
    fireEvent.click(button('Save Changes'));
    await waitFor(() => expect(noticeText()).toBe('Row 3 (CPB): Start days must be a whole number from 0 to 365.'));
    expect(alertBox().className).toContain('alert-error');
    const rows = screen.getAllByRole('row');
    expect(rows[3].className).toContain('bg-error/10');
    expect(rows.filter((row) => row.className.includes('bg-error/10'))).toHaveLength(1);
    expect(field('Start days, row 3').value).toBe('12.5');
    expect(status()).toContain('Unsaved changes');
    expect(m.guard.getUnsavedLabels()).toEqual(['Plan Check List']);
    expect(server.list?.version).toBe(1);

    // the marked row follows the row when it moves
    fireEvent.click(button('Move CPB up'));
    expect(screen.getAllByRole('row')[2].className).toContain('bg-error/10');
    fireEvent.click(button('Move CPB down'));

    type('Criteria name, row 2', '   ');
    fireEvent.click(button('Save Changes'));
    await waitFor(() => expect(noticeText()).toBe('Row 2: Criteria name must be 1 to 60 characters.'));
    expect(screen.getAllByRole('row')[2].className).toContain('bg-error/10');

    type('Criteria name, row 2', 'HEATSET');
    fireEvent.click(button('Save Changes'));
    await waitFor(() => expect(noticeText()).toBe('Row 2 (HEATSET): The name is already used in row 1 (Heatset).'));

    type('Criteria name, row 2', 'Peach/brush');
    type('Start days, row 3', '12');
    type('End days, row 4', '');
    fireEvent.click(button('Save Changes'));
    await waitFor(() => expect(noticeText()).toBe('Row 4 (Singeing): End days must be a whole number from 0 to 365.'));

    type('End days, row 4', '366');
    fireEvent.click(button('Save Changes'));
    await waitFor(() => expect(noticeText()).toBe('Row 4 (Singeing): End days must be a whole number from 0 to 365.'));
    expect(server.requests('PUT').map((r) => (r.body as { items: Array<{ endDays: unknown }> }).items[3].endDays)).toEqual([7, 7, 7, '', 366]);

    // closing the message removes the mark
    fireEvent.click(screen.getByRole('button', { name: 'Close message' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('row').some((row) => row.className.includes('bg-error/10'))).toBe(false);

    type('End days, row 4', '8');
    fireEvent.click(button('Save Changes'));
    await screen.findByText('Plan Check List saved.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(server.list?.version).toBe(2);
    expect(server.list?.value[3]).toEqual({ id: 'singeing', name: 'Singeing', startDays: 7, endDays: 8, active: true });
  });

  it('409: someone saved first; the warning offers Reload and the draft stays until the user agrees to drop it', async () => {
    setUser(ADMIN);
    const m = await freshModules();
    await openPage(m);

    server.saveDirectly(STANDARD.map((i) => (i.id === 'semibleach' ? { ...i, name: 'Semi-bleach' } : i)), 'planner1');
    type('End days, row 3', '10');
    fireEvent.click(button('Save Changes'));
    await waitFor(() =>
      expect(noticeText()).toBe(
        'The Plan Check List was changed by planner1 at 21-Nov-2026 06:01. Reload the page to see the latest values.'
      )
    );
    expect(alertBox().className).toContain('alert-warning');
    expect(server.requests('PUT')[0].body).toMatchObject({ version: 1 });
    // the draft is kept and still unsaved; nobody was signed out; the other user's save is untouched
    expect(field('End days, row 3').value).toBe('10');
    expect(draft()[8][0]).toBe('Semibleach');
    expect(status()).toContain('Unsaved changes');
    expect(m.guard.getUnsavedLabels()).toEqual(['Plan Check List']);
    expect(signedIn()).toBe(true);
    expect(location.href).toBe(PAGE_HREF);
    expect(server.list?.version).toBe(2);
    expect(server.list?.value[8].name).toBe('Semi-bleach');

    // Reload asks first; Cancel keeps the draft and sends nothing
    const gets = server.requests('GET').length;
    fireEvent.click(within(alertBox()).getByRole('button', { name: 'Reload' }));
    expect(confirms).toEqual(['Discard your unsaved changes and load the latest Plan Check List?']);
    await settle();
    expect(server.requests('GET')).toHaveLength(gets);
    expect(field('End days, row 3').value).toBe('10');

    // OK: the latest list replaces the draft
    answers = [true];
    fireEvent.click(within(alertBox()).getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(draft()[8][0]).toBe('Semi-bleach'));
    expect(field('End days, row 3').value).toBe('9');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(status()).toBe('9 criteria · 9 active · Saved · Last saved by planner1, 21-Nov-2026 06:01');

    // and the next save is based on the latest version
    type('End days, row 3', '10');
    fireEvent.click(button('Save Changes'));
    await screen.findByText('Plan Check List saved.');
    expect(server.requests('PUT')[1].body).toMatchObject({ version: 2 });
    expect(server.list?.version).toBe(3);
  });
});

describe('the "saved" toast', () => {
  it('a new save clears the previous toast, so it never stands next to a failed save', async () => {
    setUser(ADMIN);
    const m = await freshModules();
    await openPage(m);
    type('Start days, row 1', '11');
    fireEvent.click(button('Save Changes'));
    await screen.findByText('Plan Check List saved.');

    server.saveDirectly(STANDARD, 'planner1');
    type('Start days, row 1', '12');
    fireEvent.click(button('Save Changes'));
    expect(screen.queryByText('Plan Check List saved.')).toBeNull();
    await waitFor(() => expect(noticeText()).toMatch(/^The Plan Check List was changed by planner1 at /));
    expect(screen.queryByText('Plan Check List saved.')).toBeNull();
  });
});

describe('Reset to Standard', () => {
  const custom: Item[] = [
    { id: 'heatset', name: 'Heatset (HT)', startDays: 10, endDays: 7, active: true },
    { id: 'cpb', name: 'CPB', startDays: 12, endDays: 9, active: false },
    { id: 'chk_00000000000000000000000a', name: 'Enzyme wash', startDays: 3, endDays: 2, active: true },
  ];

  it("changes only the draft, after a confirm naming the used criteria it removes; Save then stores the server's standard list", async () => {
    server = new PlanCheckListServer({
      stored: { value: custom, version: 4, updatedBy: 'planner1', updatedAt: new Date('2026-11-20T09:30:00.000Z') },
    }).install();
    server.guides = [
      { orderNo: 'A-1', yesIds: ['chk_00000000000000000000000a', 'cpb'] },
      { orderNo: 'A-2', yesIds: ['chk_00000000000000000000000a'] },
    ];
    setUser(ADMIN);
    const m = await freshModules();
    await openPage(m);
    expect(draft()).toEqual(asDraft(custom));
    expect(status()).toBe('3 criteria · 2 active · Saved · Last saved by planner1, 20-Nov-2026 15:30');

    fireEvent.click(button('Reset to Standard'));
    expect(confirms).toEqual([
      'Replace the list with the standard criteria?\n\nOnly this page changes: nothing is saved until you click Save Changes.\n\n' +
        'These criteria are set to Yes on orders and will be removed:\n- Enzyme wash (2 orders)',
    ]);
    expect(draft()).toEqual(asDraft(custom));

    answers = [true];
    fireEvent.click(button('Reset to Standard'));
    expect(draft()).toEqual(asDraft(STANDARD));
    expect(status()).toBe('9 criteria · 9 active · Unsaved changes · Last saved by planner1, 20-Nov-2026 15:30');
    await settle();
    // nothing was sent: only the first GET
    expect(server.requests()).toHaveLength(1);
    expect(server.list?.version).toBe(4);
    expect(server.list?.value).toEqual(custom);
    expect(m.guard.getUnsavedLabels()).toEqual(['Plan Check List']);

    fireEvent.click(button('Save Changes'));
    await screen.findByText('Plan Check List saved.');
    expect(server.requests('PUT')[0].body).toEqual({ items: STANDARD, version: 4 });
    expect(server.list?.value).toEqual(STANDARD);
    expect(server.list?.version).toBe(5);
  });

  it('with nothing used outside the standard list the confirm is short', async () => {
    setUser(ADMIN);
    const m = await freshModules();
    await openPage(m);
    type('Criteria name, row 1', 'Heat set');
    answers = [true];
    fireEvent.click(button('Reset to Standard'));
    expect(confirms).toEqual(['Replace the list with the standard criteria?\n\nOnly this page changes: nothing is saved until you click Save Changes.']);
    expect(draft()).toEqual(asDraft(STANDARD));
    expect(status()).toContain('· Saved ·');
    expect(server.requests()).toHaveLength(1);
  });
});

describe('deleting', () => {
  it('a criterion that orders use is deleted only after a confirm with its usage; others at once; nothing is sent', async () => {
    setUser(ADMIN);
    server.guides = [
      ...Array.from({ length: 14 }, (_, i) => ({ orderNo: `C-${i + 1}`, yesIds: ['cpb'] })),
      { orderNo: 'H-1', yesIds: ['heatset', 'heatset'] },
    ];
    const m = await freshModules();
    await openPage(m);
    expect(screen.getByText('Yes on 14 orders')).toBeTruthy();
    expect(screen.getByText('Yes on 1 order')).toBeTruthy();

    fireEvent.click(button('Delete CPB'));
    expect(confirms).toEqual([
      '"CPB" is set to Yes on 14 orders.\n\nDelete it anyway? Those orders will show it as Removed. To keep it on them, set it Inactive instead.',
    ]);
    expect(draft().map((r) => r[0])).toContain('CPB');

    answers = [true];
    fireEvent.click(button('Delete CPB'));
    expect(draft().map((r) => r[0])).not.toContain('CPB');

    // a renamed used criterion is named as it is typed now
    type('Criteria name, row 1', 'Heat set');
    fireEvent.click(button('Delete Heat set'));
    expect(confirms[2]).toBe(
      '"Heat set" is set to Yes on 1 order.\n\nDelete it anyway? Those orders will show it as Removed. To keep it on them, set it Inactive instead.'
    );
    expect(draft()[0][0]).toBe('Heat set');

    // unused criteria and new rows go at once
    fireEvent.click(button('Delete Peach/brush'));
    fireEvent.click(button('Add Criteria'));
    fireEvent.click(button('Delete row 8'));
    expect(confirms).toHaveLength(3);
    expect(draft().map((r) => r[0])).toEqual(['Heat set', 'Singeing', 'Subcontract', 'YD Pre', 'YD Post', 'Mercerized', 'Semibleach']);
    await settle();
    expect(server.requests()).toHaveLength(1);
  });
});

describe('sign-out rules (own fetch helper, not apiClient)', () => {
  it('403 PERMISSION shows the message and keeps the user signed in and the draft', async () => {
    setUser(EDITOR);
    const m = await freshModules();
    await openPage(m);
    // an Admin removes the permission while the page is open
    server.addUser(TOKEN, PLANNER);
    type('Start days, row 1', '11');
    fireEvent.click(button('Save Changes'));
    await waitFor(() => expect(noticeText()).toBe('Access forbidden: Plan Check List permission required.'));
    expect(alertBox().className).toContain('alert-error');
    expect(signedIn()).toBe(true);
    expect(location.href).toBe(PAGE_HREF);
    expect(field('Start days, row 1').value).toBe('11');
    expect(m.guard.getUnsavedLabels()).toEqual(['Plan Check List']);
  });

  it('401 signs out and opens the login page', async () => {
    setUser(ADMIN);
    const m = await freshModules();
    await openPage(m);
    server.scriptNext({ status: 401, json: { message: 'Session expired (Dhaka midnight rollover). Please log in again.' } });
    type('Start days, row 1', '11');
    fireEvent.click(button('Save Changes'));
    await waitFor(() => expect(location.href).toBe('/login?expired=true'));
    expect(SESSION_KEYS.filter((key) => localStorage.getItem(key) !== null)).toEqual([]);
    expect(noticeText()).toBe('Your session has ended. Please log in again.');
  });

  it('a 403 without code PERMISSION (inactive account) signs out', async () => {
    setUser(ADMIN);
    const m = await freshModules();
    await openPage(m);
    server.addUser(TOKEN, { ...ADMIN, status: 'inactive' });
    type('Start days, row 1', '11');
    fireEvent.click(button('Save Changes'));
    await waitFor(() => expect(location.href).toBe('/login?expired=true'));
    expect(SESSION_KEYS.filter((key) => localStorage.getItem(key) !== null)).toEqual([]);
  });

  it('a 401 on the first load signs out too', async () => {
    setUser(ADMIN);
    server.users.clear();
    const m = await freshModules();
    render(<m.PlanCheckListScreen />);
    await waitFor(() => expect(location.href).toBe('/login?expired=true'));
    expect(server.requests()).toHaveLength(1);
  });
});

describe('unsaved-work guard (src/lib/unsaved-changes.ts)', () => {
  it('registers "Plan Check List" only while there are unsaved edits; the browser asks before closing meanwhile', async () => {
    setUser(ADMIN);
    const m = await freshModules();
    const view = await openPage(m);
    expect(m.guard.getUnsavedLabels()).toEqual([]);
    expect(unloadPrompts()).toBe(false);

    type('Criteria name, row 2', 'Peach brush');
    expect(m.guard.getUnsavedLabels()).toEqual(['Plan Check List']);
    expect(unloadPrompts()).toBe(true);
    // what a Sidebar link or Sign Out asks
    expect(m.guard.confirmLeave()).toBe(false);
    expect(confirms).toEqual([UNSAVED_MESSAGE]);

    // back to the saved value: nothing unsaved
    type('Criteria name, row 2', 'Peach/brush');
    expect(m.guard.getUnsavedLabels()).toEqual([]);
    expect(unloadPrompts()).toBe(false);

    // saved: nothing unsaved
    type('Criteria name, row 2', 'Peach brush');
    fireEvent.click(button('Save Changes'));
    expect(m.guard.getUnsavedLabels()).toEqual(['Plan Check List']); // still unsaved while the save runs
    await screen.findByText('Plan Check List saved.');
    expect(m.guard.getUnsavedLabels()).toEqual([]);
    expect(unloadPrompts()).toBe(false);

    // leaving the page (unmount) unregisters it
    type('Criteria name, row 2', 'Peach');
    expect(m.guard.getUnsavedLabels()).toEqual(['Plan Check List']);
    view.unmount();
    expect(m.guard.getUnsavedLabels()).toEqual([]);
    expect(unloadPrompts()).toBe(false);
  });

  it('Reload with unsaved edits asks first; without edits it reloads at once', async () => {
    setUser(ADMIN);
    const m = await freshModules();
    await openPage(m);
    fireEvent.click(button('Reload'));
    expect(confirms).toEqual([]);
    await waitFor(() => expect(server.requests('GET')).toHaveLength(2));
    await waitFor(() => expect(button('Reload').disabled).toBe(false));

    type('Start days, row 2', '1');
    fireEvent.click(button('Reload'));
    expect(confirms).toEqual(['Discard your unsaved changes and load the latest Plan Check List?']);
    await settle();
    expect(server.requests('GET')).toHaveLength(2);
    expect(field('Start days, row 2').value).toBe('1');
  });
});
