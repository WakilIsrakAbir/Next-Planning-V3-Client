// ==========================================================
// PPI report: dynamic A4 landscape multi-page print engine.
// Ported from the old js/planning-prod-info.js (buildPrintPages, createPrintPage, createSummaryPrintShell,
// printContentOverflows, clearPrintPages). The report sections on screen are cloned into fixed-size A4 pages
// inside a container appended to <body>; ppi-print.css hides everything else while printing.
// ==========================================================

export const PRINT_CONTAINER_ID = 'printPagesContainer';
/** Set on <body> only while generated pages exist, so the print rules never affect other screens. */
const ACTIVE_BODY_CLASS = 'ppi-print-active';
const MEASURING_CLASS = 'ppi-print-measuring';

export interface PPIPrintSources {
  /** Section 1 (Booking Specification) element. */
  specSection: HTMLElement | null;
  /** Section 2 (Booking Planning) element. */
  planSection: HTMLElement | null;
  /** Section 3 banner (title + colour count badge). */
  summaryHeader: HTMLElement | null;
  summaryThead: HTMLElement | null;
  summaryTbody: HTMLElement | null;
  bookingTitle: string;
  colorCountText: string;
}

const FILE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>';

/** "username (role)" of the signed-in user, like the old header's display name. */
export function getPrintUsername(): string {
  let username: string | null = null;
  let role: string | null = null;
  try {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        const user = parsed as Record<string, unknown>;
        if (typeof user.username === 'string' && user.username) username = user.username;
        if (typeof user.role === 'string' && user.role) role = user.role;
      }
    }
    username = username || localStorage.getItem('username');
    role = role || localStorage.getItem('role');
  } catch {
    // Storage unavailable or malformed user record: fall through to the generic name.
  }
  if (username && role) return `${username} (${role})`;
  if (username) return username;
  return 'System User';
}

/** DD-Mon-YYYY hh:mm:ss AM/PM */
export function formatPrintDateTime(d: Date = new Date()): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${pad(d.getDate())}-${months[d.getMonth()]}-${d.getFullYear()} ${pad(hours)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
}

/** Clone of an on-screen node for printing: no ids, and no dark-mode classes so pages always print light. */
function clonePrintNode<T extends Element>(node: T): T {
  const clone = node.cloneNode(true) as T;
  const all: Element[] = [clone, ...Array.from(clone.querySelectorAll('*'))];
  all.forEach((el) => {
    el.removeAttribute('id');
    const cls = el.getAttribute('class');
    if (cls && cls.includes('dark:')) {
      el.setAttribute(
        'class',
        cls
          .split(/\s+/)
          .filter((c) => c && !c.startsWith('dark:'))
          .join(' ')
      );
    }
  });
  return clone;
}

function getPrintContainer(create: boolean): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let container = document.getElementById(PRINT_CONTAINER_ID);
  if (!container && create) {
    container = document.createElement('div');
    container.id = PRINT_CONTAINER_ID;
    container.setAttribute('aria-hidden', 'true');
    document.body.appendChild(container);
  }
  return container;
}

function createPrintPage(printedAt: string, username: string, bookingTitle: string) {
  const page = document.createElement('div');
  page.className = 'print-page';

  const inner = document.createElement('div');
  inner.className = 'print-page-inner';

  const title = document.createElement('div');
  title.className = 'print-report-title';
  const titleMain = document.createElement('div');
  titleMain.className = 'print-report-title-main';
  titleMain.innerHTML = FILE_ICON_SVG;
  const titleText = document.createElement('span');
  titleText.textContent = 'Detailed Planning & Production Info';
  titleMain.appendChild(titleText);
  const titleBooking = document.createElement('div');
  titleBooking.className = 'print-report-title-booking';
  titleBooking.textContent = bookingTitle || '';
  title.append(titleMain, titleBooking);
  inner.appendChild(title);

  const content = document.createElement('div');
  content.className = 'print-content';
  inner.appendChild(content);
  page.appendChild(inner);

  const footer = document.createElement('div');
  footer.className = 'print-footer';
  const left = document.createElement('div');
  left.className = 'print-footer-left';
  const printedLine = document.createElement('div');
  printedLine.textContent = `Printed Date & Time: ${printedAt}`;
  const userLine = document.createElement('div');
  userLine.textContent = `Print by: ${username}`;
  left.append(printedLine, userLine);
  const center = document.createElement('div');
  center.className = 'print-footer-center';
  center.textContent = 'This is the PMC internal ERP System Generated Report';
  const right = document.createElement('div');
  right.className = 'print-footer-right print-page-number';
  footer.append(left, center, right);
  page.appendChild(footer);

  return { page, content };
}

function createSummaryPrintShell(sources: PPIPrintSources, isContinuation: boolean) {
  const section = document.createElement('section');
  section.className = 'w-full';

  let header: HTMLElement;
  if (sources.summaryHeader) {
    header = clonePrintNode(sources.summaryHeader);
  } else {
    header = document.createElement('div');
    header.className =
      'bg-[#b45309] text-white px-3 py-1.5 rounded-t font-black text-xs uppercase flex items-center justify-between';
    const titleSpan = document.createElement('span');
    titleSpan.setAttribute('data-ppi-summary-title', '');
    titleSpan.textContent = 'Details Booking Summary (Color-Wise)';
    const badge = document.createElement('span');
    badge.className = 'text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded';
    badge.textContent = sources.colorCountText || '';
    header.append(titleSpan, badge);
  }
  if (isContinuation) {
    const titleSpan = header.querySelector('[data-ppi-summary-title]');
    if (titleSpan) titleSpan.appendChild(document.createTextNode(' - Continued'));
  }
  section.appendChild(header);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'overflow-hidden border border-t-0 border-slate-300 rounded-b';

  const table = document.createElement('table');
  table.className = 'w-full text-xs border-collapse';

  const thead = document.createElement('thead');
  thead.className = 'bg-amber-100 text-amber-950 font-bold border-b border-slate-300';
  if (sources.summaryThead) {
    Array.from(sources.summaryThead.children).forEach((row) => thead.appendChild(clonePrintNode(row)));
  }
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  tbody.className = 'divide-y divide-slate-200';
  table.appendChild(tbody);

  tableWrap.appendChild(table);
  section.appendChild(tableWrap);

  return { section, tbody };
}

/** True when the page's content no longer fits its fixed A4 height. */
function printContentOverflows(page: HTMLElement): boolean {
  const inner = page.querySelector<HTMLElement>('.print-page-inner');
  if (inner && inner.scrollHeight > inner.clientHeight + 2) return true;
  return page.scrollHeight > page.clientHeight + 2;
}

/**
 * Builds the A4 landscape pages: page 1 gets the specification and planning sections, then the colour
 * summary rows are added one by one and continue on new pages (with the table header repeated) whenever
 * a page overflows. Every page carries the report title, the print date-time, the user and "Page X out of Y".
 */
export function buildPrintPages(sources: PPIPrintSources): void {
  const container = getPrintContainer(true);
  if (!container) return;
  container.innerHTML = '';

  const printedAt = formatPrintDateTime();
  const username = getPrintUsername();

  // Lay the pages out off-screen at their printed size so overflow can be measured.
  container.classList.add(MEASURING_CLASS);

  let current = createPrintPage(printedAt, username, sources.bookingTitle);
  container.appendChild(current.page);
  let pageHasOtherContent = false;

  if (sources.specSection) {
    current.content.appendChild(clonePrintNode(sources.specSection));
    pageHasOtherContent = true;
  }
  if (sources.planSection) {
    current.content.appendChild(clonePrintNode(sources.planSection));
    pageHasOtherContent = true;
  }

  const allRows = sources.summaryTbody
    ? Array.from(sources.summaryTbody.children).filter((el): el is HTMLTableRowElement => el instanceof HTMLTableRowElement)
    : [];

  if (allRows.length > 0) {
    let shell = createSummaryPrintShell(sources, false);
    current.content.appendChild(shell.section);
    let rowsInCurrentShell = 0;
    let rowsPlaced = 0;

    for (let i = 0; i < allRows.length; i++) {
      const cloneRow = clonePrintNode(allRows[i]);
      shell.tbody.appendChild(cloneRow);
      rowsInCurrentShell++;

      // A row that does not fit even on a page of its own stays where it is (no endless new pages).
      const canMove = rowsInCurrentShell > 1 || pageHasOtherContent;
      if (canMove && printContentOverflows(current.page)) {
        if (rowsInCurrentShell > 1) {
          shell.tbody.removeChild(cloneRow);
        } else {
          // Only the table header and its first row: move the whole table to the next page.
          current.content.removeChild(shell.section);
        }
        rowsPlaced += rowsInCurrentShell - 1;
        i--;

        current = createPrintPage(printedAt, username, sources.bookingTitle);
        container.appendChild(current.page);
        pageHasOtherContent = false;

        shell = createSummaryPrintShell(sources, rowsPlaced > 0);
        current.content.appendChild(shell.section);
        rowsInCurrentShell = 0;
      }
    }
  }

  // Stamp the page numbers across all pages
  const pages = Array.from(container.querySelectorAll<HTMLElement>('.print-page'));
  const totalPages = pages.length || 1;
  pages.forEach((page, idx) => {
    const pageNumEl = page.querySelector<HTMLElement>('.print-page-number');
    if (pageNumEl) {
      pageNumEl.textContent = `Page ${String(idx + 1).padStart(2, '0')} out of ${String(totalPages).padStart(2, '0')}`;
    }
  });

  container.classList.remove(MEASURING_CLASS);
  document.body.classList.add(ACTIVE_BODY_CLASS);
}

export function hasPrintPages(): boolean {
  const container = getPrintContainer(false);
  return !!container && container.children.length > 0;
}

export function clearPrintPages(): void {
  const container = getPrintContainer(false);
  if (container) container.innerHTML = '';
  if (typeof document !== 'undefined') document.body.classList.remove(ACTIVE_BODY_CLASS);
}

/** Removes the print container from <body> (when the report closes). */
export function removePrintContainer(): void {
  clearPrintPages();
  getPrintContainer(false)?.remove();
}
