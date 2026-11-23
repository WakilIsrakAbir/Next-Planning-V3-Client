import type { Loose } from './types';

/*
 * What a user can see on the order page, read from the DOM after each step.
 * The plan table is found through the test hooks in OrderPlanningScreen.tsx:
 *   data-plan-table="<dept>" on the table, data-row="<index>" on each item row,
 *   data-field="<name>" on every editable input/select (and on the Order Status select),
 *   data-action="save" on the save buttons.
 * Everything else is read by its visible text.
 */

export interface FieldState {
  value: string;
  disabled: boolean;
  title: string | null;
  min?: string;
  options?: string[];
  /** The input carries the "disabled look" classes (cursor-not-allowed). */
  greyed?: true;
}

export interface RowState {
  row: string | null;
  /** Text of each cell without an input (null for cells holding an input), in column order. */
  text: (string | null)[];
  fields: Record<string, FieldState>;
}

export interface PageState {
  view: 'page' | 'notFound';
  notFound?: string;
  header?: string;
  general?: Record<string, Loose>;
  section?: { header: string; footer: string };
  table?: { plan: string | null; head: string[][]; rows: RowState[]; message: string | null };
  buttons?: Array<{ text: string; action?: string; disabled: boolean; spinner?: true }>;
  /** "<type>: <text>" of the visible toast, or null. */
  toast: string | null;
}

const OPTION_FIELDS = new Set(['unit', 'processName', 'orderStatus']);

const clean = (s: string | null | undefined): string => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Visible text of an element: its text nodes, trimmed and joined with single spaces. */
export function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = clean(n.nodeValue);
    if (t) parts.push(t);
  }
  return parts.join(' ');
}

export function readField(el: Element): FieldState {
  const input = el as HTMLInputElement & HTMLSelectElement;
  const state: FieldState = {
    value: input.value,
    disabled: Boolean(input.disabled),
    title: el.getAttribute('title'),
  };
  const min = el.getAttribute('min');
  if (min !== null) state.min = min;
  const name = el.getAttribute('data-field') || '';
  if (el.tagName === 'SELECT' && OPTION_FIELDS.has(name)) {
    state.options = Array.from((el as HTMLSelectElement).options).map((o) => o.value);
  }
  if (String(el.getAttribute('class') || '').includes('cursor-not-allowed')) state.greyed = true;
  return state;
}

export function readToast(root: ParentNode): { type: string; text: string } | null {
  const alert = root.querySelector('.alert');
  if (!alert) return null;
  const cls = alert.getAttribute('class') || '';
  const type = cls.includes('alert-success') ? 'success' : cls.includes('alert-error') ? 'error' : 'other';
  return { type, text: textOf(alert) };
}

function toastLine(root: ParentNode): string | null {
  const t = readToast(root);
  return t ? `${t.type}: ${t.text}` : null;
}

function readGeneral(root: ParentNode): Record<string, Loose> {
  const general: Record<string, Loose> = {};
  root.querySelectorAll('span').forEach((span) => {
    const next = span.nextElementSibling;
    if (!next || (next.tagName !== 'INPUT' && next.tagName !== 'SELECT')) return;
    if (next.closest('[data-plan-table]')) return;
    const label = textOf(span);
    if (next.tagName === 'SELECT') {
      general[label] = readField(next);
    } else {
      const input = next as HTMLInputElement;
      general[label] = input.readOnly ? input.value : { value: input.value, readOnly: false };
    }
  });
  root.querySelectorAll('div').forEach((div) => {
    if (textOf(div) !== 'Fabric Notes' || div.children.length > 0) return;
    const ta = div.nextElementSibling as HTMLTextAreaElement | null;
    if (ta && ta.tagName === 'TEXTAREA') general['Fabric Notes'] = ta.readOnly ? ta.value : { value: ta.value, readOnly: false };
  });
  return general;
}

function readTable(table: HTMLTableElement): NonNullable<PageState['table']> {
  const head = Array.from(table.querySelectorAll('thead tr')).map((tr) => Array.from(tr.children).map((th) => textOf(th)));
  const rows: RowState[] = [];
  let message: string | null = null;
  table.querySelectorAll('tbody > tr').forEach((tr) => {
    if (!tr.hasAttribute('data-row')) {
      message = textOf(tr);
      return;
    }
    const text: (string | null)[] = [];
    const fields: Record<string, FieldState> = {};
    Array.from(tr.children).forEach((td) => {
      const controls = td.querySelectorAll('[data-field]');
      if (controls.length === 0) {
        text.push(textOf(td));
        return;
      }
      text.push(null);
      controls.forEach((el) => {
        let name = el.getAttribute('data-field') || '?';
        while (fields[name]) name += '+';
        fields[name] = readField(el);
      });
    });
    rows.push({ row: tr.getAttribute('data-row'), text, fields });
  });
  return { plan: table.getAttribute('data-plan-table'), head, rows, message };
}

function readButton(b: Element): NonNullable<PageState['buttons']>[number] {
  const btn: NonNullable<PageState['buttons']>[number] = {
    text: textOf(b) || clean(b.getAttribute('title')),
    disabled: (b as HTMLButtonElement).disabled,
  };
  const action = b.getAttribute('data-action');
  if (action) btn.action = action;
  if (b.querySelector('.animate-spin')) btn.spinner = true;
  return btn;
}

/*
 * The universal order page (SPEC C2) shows several plan sections. The golden recordings hold what TODAY's page showed:
 * one department's table. The recorder therefore reads the page as today's page would have shown it:
 * - General Information: only inside [data-general-info] (the per-section Order Status selects do not leak in);
 * - the plan table: only the route department's section(s) ([data-route-section]); on the delivery page the Floor and
 *   Lock tables are merged back into today's single table (Floor's identification + Floor columns, then Lock's
 *   columns, then the Dyeing columns, which since US-11 only the Floor table shows, then the read-only quantity
 *   columns, which both tables show);
 * - the section header/footer: the route section's table card. US-12 moved the card's "Department Fabric Items (n)"
 *   header row into the strip (C2 chrome), so a card without that row records an empty header (`cardHeader`);
 * - buttons: today's five: the header arrow and Back, today's header "Save Planning" (now: the route section's own
 *   Save, recorded with today's label and the state of the card's Save), and the card footer's Cancel and Save
 *   Planning Schedule. C2 chrome (strips, pills, notes, Hide/Unhide, Discard, Save Data: [data-c2-chrome]) and the
 *   other sections are not part of today's page and are not read.
 *   The synthesized "Save Planning" entry is a harness adaptation beyond SPEC section 5's list (kept on purpose):
 *   plan D5 replaced the header button with Save Data, which is disabled while nothing is unsaved, so the header has
 *   no button with today's states. The card's footer Save is disabled exactly when the strip Save that a `save` step
 *   clicks is (`saving`; a route section never has `noItems`) and shows the spinner while its section is saved, so
 *   no plan, check or save difference can hide behind the entry.
 */
/** The table card's header row (before US-12: "Department Fabric Items <n> ..."); '' when the card starts with its table. */
function cardHeader(card: HTMLElement): string {
  const first = card.firstElementChild;
  return first && !first.querySelector('table') ? textOf(first) : '';
}

function readRouteSections(root: HTMLElement, state: PageState): boolean {
  const sections = Array.from(root.querySelectorAll('[data-route-section]'));
  if (sections.length === 0) return false;
  const tables = sections
    .map((s) => s.querySelector('table[data-plan-table]') as HTMLTableElement | null)
    .filter((t): t is HTMLTableElement => t !== null);
  if (tables.length === 0) return true;

  const card = tables[0].closest('.overflow-hidden') as HTMLElement | null;
  if (card) {
    state.section = { header: cardHeader(card), footer: textOf(card.lastElementChild) };
  }

  if (tables.length === 1) {
    state.table = readTable(tables[0]);
  } else {
    // Delivery: [Floor table, Lock table] -> today's table. Head row 1: Color, FabricConstruction, GSM, the two Floor
    // headers, then the Lock table from its 4th header on; head row 2: the two Floor sub-headers, then the Lock row.
    const floor = readTable(tables[0]);
    const lock = readTable(tables[1]);
    // US-11 layouts. Floor: Color, Fabric, GSM, Floor Start/End, DelS-DelE, Floor Plan Type, Dyeing Start/End, Dyeing
    // Plan Type, quantities. Lock: Color, Fabric, GSM, Lock Start/End, LockS-LockE, Plan Type, Limitation, Remarks,
    // quantities. Header row 0 counts a Start/End pair once (colSpan), the rows count every cell.
    state.table = {
      plan: floor.plan,
      head: [
        [...floor.head[0].slice(0, 6), ...lock.head[0].slice(3, 8), ...floor.head[0].slice(6, 8), ...lock.head[0].slice(8)],
        [...floor.head[1].slice(0, 2), ...lock.head[1], ...floor.head[1].slice(2)],
      ],
      rows: floor.rows.map((fr, i) => {
        const lr = lock.rows[i];
        const text = lr
          ? [...fr.text.slice(0, 7), ...lr.text.slice(3, 9), ...fr.text.slice(7, 10), ...lr.text.slice(9)]
          : fr.text.slice(0, 10);
        return { row: fr.row, text, fields: { ...fr.fields, ...(lr ? lr.fields : {}) } };
      }),
      message: floor.message,
    };
  }

  const header = root.querySelector('[data-page-header]');
  const headerButtons = header ? Array.from(header.querySelectorAll('button')).filter((b) => !b.closest('[data-c2-chrome]')) : [];
  const footerButtons = card && card.lastElementChild ? Array.from(card.lastElementChild.querySelectorAll('button')) : [];
  const cardSave = footerButtons.find((b) => b.getAttribute('data-action') === 'save');
  state.buttons = [
    ...headerButtons.map(readButton),
    ...(cardSave ? [{ ...readButton(cardSave), text: 'Save Planning' }] : []),
    ...footerButtons.map(readButton),
  ];
  return true;
}

export function readPage(root: HTMLElement): PageState {
  const toast = toastLine(root);
  const h2 = root.querySelector('h2');
  if (h2 && textOf(h2) === 'Order Not Found') {
    const box = h2.parentElement as HTMLElement;
    const link = box.querySelector('a');
    return {
      view: 'notFound',
      notFound: `${textOf(box)} | link: ${link ? link.getAttribute('href') : 'none'}`,
      toast,
    };
  }

  const state: PageState = { view: 'page', toast };
  state.header = textOf(root.querySelector('h3'));
  state.general = readGeneral((root.querySelector('[data-general-info]') as HTMLElement | null) ?? root);

  if (readRouteSections(root, state)) return state;

  const table = root.querySelector('table') as HTMLTableElement | null;
  if (table) {
    const card = table.closest('.overflow-hidden') as HTMLElement | null;
    if (card) {
      state.section = {
        header: cardHeader(card),
        footer: textOf(card.lastElementChild),
      };
    }
    state.table = readTable(table);
  }

  state.buttons = Array.from(root.querySelectorAll('button')).map(readButton);
  return state;
}

/* ---------------- recording helpers ---------------- */

/** Flattens a state to "path -> leaf value" (arrays as [i], objects as .key) in document order. */
export function flatten(value: Loose, prefix = '', out: Map<string, Loose> = new Map()): Map<string, Loose> {
  if (value === null || typeof value !== 'object') {
    out.set(prefix, value);
    return out;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) out.set(prefix, []);
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return out;
  }
  const keys = Object.keys(value).filter((k) => value[k] !== undefined);
  if (keys.length === 0) out.set(prefix, {});
  keys.forEach((k) => flatten(value[k], prefix ? `${prefix}.${k}` : k, out));
  return out;
}

export const REMOVED = '<removed>';

/** The leaves that changed between two states: changed/added paths in the new state's order, then removed ones. */
export function diffStates(prev: Loose, next: Loose): Record<string, Loose> {
  const a = flatten(prev);
  const b = flatten(next);
  const changes: Record<string, Loose> = {};
  b.forEach((v, k) => {
    if (!a.has(k) || JSON.stringify(a.get(k)) !== JSON.stringify(v)) changes[k] = v;
  });
  a.forEach((_v, k) => {
    if (!b.has(k)) changes[k] = REMOVED;
  });
  return changes;
}

/** Rebuilds the full state of every step from a recording (first step full, later steps as changes). */
export function expandStates(steps: Array<{ state?: Loose; changes?: Record<string, Loose> }>): Loose[] {
  const states: Loose[] = [];
  let flat = new Map<string, Loose>();
  for (const s of steps) {
    if (s.state) {
      flat = flatten(s.state);
    } else if (s.changes) {
      flat = new Map(flat);
      for (const [k, v] of Object.entries(s.changes)) {
        if (v === REMOVED) flat.delete(k);
        else flat.set(k, v);
      }
    }
    states.push(Object.fromEntries(flat));
  }
  return states;
}

const isPrimitive = (v: Loose) => v === null || typeof v !== 'object';

/**
 * Stable, compact JSON: anything that fits in 120 characters stays on one line, and so does any object or
 * array that holds only plain values (a field, a row's cell texts, an Excel row).
 */
export function formatJson(value: Loose, indent = ''): string {
  if (isPrimitive(value)) return JSON.stringify(value);
  const inline = JSON.stringify(value);
  if (inline.length + indent.length <= 120) return inline;
  const values = Array.isArray(value) ? value : Object.values(value);
  if (values.every(isPrimitive)) return inline;
  const inner = indent + '  ';
  if (Array.isArray(value)) {
    return `[\n${value.map((v) => inner + formatJson(v, inner)).join(',\n')}\n${indent}]`;
  }
  const entries = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .map((k) => `${inner}${JSON.stringify(k)}: ${formatJson(value[k], inner)}`);
  return `{\n${entries.join(',\n')}\n${indent}}`;
}
