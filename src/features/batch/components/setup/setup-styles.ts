/* Tailwind classes shared by the Setup panels (Dyeing MC, Flat Allowance, Unit Setup) and the Not Possible
   Fabric dialog: the old setup-toolbar, setup-status-bar, setup-table, freeze-pane, setup-input and
   component-note rules. Built on the shared Batch classes of ../ui/styles. */
import { cn } from '@/lib/cn';
import { button, card, input, tableWrap } from '../ui/styles';
import type { ButtonVariant } from '../ui/styles';

/** A Setup panel: fills the page down to its bottom padding, and its table scrolls inside (tablePane). On a short
    screen it keeps a minimum height and the page scrolls. */
export const panel = cn(card, 'flex min-h-[360px] flex-1 flex-col');

/** A Batch button. The old page left the button font on the browser default (Arial). */
export function setupButton(variant: ButtonVariant = 'primary'): string {
  return cn(button(variant), 'font-[Arial]');
}

/** Panel heading bar with the title and the action buttons (old `.setup-toolbar`). */
export const toolbar =
  'flex flex-wrap items-center justify-between gap-3.5 border-b border-batch-border-light px-[22px] py-[18px] text-[12px] text-batch-muted';

/** Panel title (old `<h2 style="margin:0;font-size:17px">`, bold by browser default). */
export const toolbarTitle = 'm-0 text-[17px] font-bold';

/** Small grey note under the title (old `.component-note`). */
export const note = 'my-[7px] text-[11px] text-[#64748b]';

/** Button row (old `.btn-group-actions`). */
export const actions = 'flex flex-wrap gap-2';

/** Row count / save status line (old `.setup-status-bar`). */
export const statusBar =
  'flex flex-wrap items-center justify-between gap-3.5 bg-[#f8fbfe] px-[22px] py-2.5 text-[12px] text-batch-muted dark:bg-[#151921]';

/** Scroller with the frozen table heading (old `.table-wrap.freeze-pane`): the rest of the panel's height. */
export const tablePane = cn(tableWrap, 'relative min-h-0 flex-1 overflow-auto overscroll-contain');

/** The editable table (old `.setup-table` inside `.freeze-pane`): as wide as the panel, so there is no horizontal
    scrollbar; each panel sets the min width below which it scrolls sideways instead of squeezing its fields. */
export const table = 'w-full table-fixed border-separate border-spacing-0';

/** Frozen table heading (old `.freeze-pane thead`). */
export const thead = 'sticky top-0 z-[3] bg-[#f1f6fb] dark:bg-[#151921] print:static';

const cell = 'border border-batch-border-light text-left align-middle text-[12px]';

/** Heading cell (old `.setup-table th` and `.freeze-pane thead th`). */
export const th = cn(
  cell,
  'bg-[#e4eef8] px-2 py-2.5 font-bold text-[#173756] shadow-[0_1px_0_#c9d8e8] ' +
    'dark:bg-[#151921] dark:text-[#cbd5e1] dark:shadow-[0_1px_0_#2a3346]'
);

/** Body cell (old `.setup-table td`). */
export const td = cn(cell, 'p-1.5');

/** Body row: striped, highlighted on hover (old `.batch-app tbody tr` rules). */
export const tr = 'even:bg-batch-row-alt hover:bg-[#edf4fc] dark:hover:bg-[rgba(16,185,129,0.08)]';

/** Placeholder and dark focus look of the old page's text inputs and selects. */
const fieldStates =
  'placeholder:text-[#757575] dark:placeholder:text-[#475569] ' +
  'dark:focus:border-[#10b981] dark:focus:shadow-[0_0_0_2px_rgba(16,185,129,0.15)]';

/** Text input / select of the tables and the dialog (old `.setup-input`). */
export const field = cn(input, fieldStates);

/** An input the old page left on browser defaults (old `#unitSetupSearch`); dark mode gave it the dark input look. */
export const plainField = cn(
  '[all:revert]',
  'dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#e2e8f0] dark:outline-[#10b981]',
  fieldStates
);
