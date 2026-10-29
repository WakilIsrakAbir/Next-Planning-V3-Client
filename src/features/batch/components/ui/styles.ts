/* Shared Tailwind classes of the Batch pages (buttons, cards, tabs, tables, inputs, dialogs).
   Colours come from the batch-* theme tokens in src/app/globals.css, so most rules need no dark: variant.
   Compose with cn() from '@/lib/cn': cn(button('secondary'), 'px-2'). */

/** The browser's form-control font (Arial on Windows). The old page left <button>, <input> and <select> on it,
    so add it to those elements; button() has no font because <a>, <label> and <summary> also use it. */
export const controlFont = 'font-[Arial]';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

const BUTTON_BASE =
  'inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12.5px] font-bold leading-[normal] ' +
  'cursor-pointer transition-colors duration-150 disabled:cursor-wait disabled:opacity-60';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-0 bg-batch-primary text-white hover:bg-batch-primary-hover',
  secondary:
    'border border-solid border-[#c2d2e4] bg-white text-[#24466f] hover:bg-[#edf3f9] ' +
    'dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#cbd5e1] dark:hover:bg-[#252b3b] dark:hover:text-[#f8fafc]',
  success: 'border-0 bg-[#059669] text-white hover:bg-[#047857]',
  warning: 'border-0 bg-[#d97706] text-white hover:bg-[#b45309]',
  danger: 'border-0 bg-[#dc2626] text-white hover:bg-[#b91c1c]',
};

/** A Batch button (old `.btn`, `.btn.secondary`, `.btn.success`, `.btn.warning`, `.btn.danger`). */
export function button(variant: ButtonVariant = 'primary'): string {
  return BUTTON_BASE + ' ' + BUTTON_VARIANTS[variant];
}

/** Panel with border and shadow (old `.card`). */
export const card =
  'overflow-hidden rounded-lg border border-solid border-batch-border bg-batch-card ' +
  'shadow-[0_2px_8px_rgba(18,46,75,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.45)]';

/* Tab colours. Each state is a complete set, so no two utilities set the same property on one element. */
const TAB_IDLE =
  'border-[#bbc9d9] bg-white text-[#1e354f] hover:bg-[#f1f6fc] ' +
  'dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#cbd5e1] dark:hover:bg-[#252b3b] dark:hover:text-[#f8fafc]';
const TAB_ACTIVE =
  'border-[#203348] bg-[#203348] text-white shadow-[0_2px_4px_rgba(0,0,0,0.12)] ' +
  'dark:border-[#10b981] dark:bg-[#10b981] dark:shadow-[0_2px_6px_rgba(0,0,0,0.4)]';
const TAB_SEARCHING =
  'border-[#9fb6cd] bg-[#dbe7f3] text-[#1e354f] ' +
  'dark:border-[rgba(16,185,129,0.45)] dark:bg-[rgba(16,185,129,0.18)] dark:text-[#6ee7b7]';

/** Status list tab of the registers (old `.status-btn`, `.status-btn.active`). */
export function statusTab(active: boolean): string {
  return (
    'flex items-center gap-1.5 rounded border border-solid px-[18px] py-2 text-xs font-extrabold uppercase leading-[normal] ' +
    'tracking-[0.4px] cursor-pointer transition-all duration-150 ' +
    (active ? TAB_ACTIVE : TAB_IDLE)
  );
}

/** Unit tab in the page heading (old `.unit-tab`, `.unit-tab.active`, `.unit-tab.searching`). */
export function unitTab(state: 'idle' | 'active' | 'searching'): string {
  return (
    'inline-flex items-center gap-1.5 rounded border border-solid px-3 py-1.5 text-xs font-extrabold leading-[normal] ' +
    'tracking-[0.3px] no-underline cursor-pointer transition-all duration-150 ' +
    (state === 'active' ? TAB_ACTIVE : state === 'searching' ? TAB_SEARCHING : TAB_IDLE)
  );
}

/** The count inside a tab (old `.status-count`, `.unit-tab span`). */
export function tabCount(active: boolean): string {
  return 'inline-block rounded-[10px] px-1.5 py-px text-[11px] ' + (active ? 'bg-white/[0.22]' : 'bg-black/[0.08] dark:bg-white/[0.08]');
}

/** Status badge in the page heading (old `.badge` and `.badge-dot`). */
export const badge = {
  base:
    'inline-flex flex-none items-center gap-1.5 rounded-3xl border border-solid border-[#bce6d2] bg-[#e5f6ee] px-[13px] py-1.5 ' +
    'text-xs font-bold text-[#0e6b47] dark:border-[rgba(16,185,129,0.35)] dark:bg-[rgba(16,185,129,0.14)] dark:text-[#34d399]',
  dot: 'h-[7px] w-[7px] rounded-full bg-[#10b981]',
};

/** Text input / select of tables and forms (old `.setup-input`). */
export const input =
  'w-full min-w-0 rounded border border-solid border-[#d1dce7] bg-white px-1.5 py-[7px] text-batch-text outline-batch-primary ' +
  'disabled:bg-[#f1f5f9] disabled:opacity-70 dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#e2e8f0] dark:disabled:bg-[#13161e]';

/** Horizontal scroller around a table (old `.table-wrap`). */
export const tableWrap = 'w-full overflow-x-auto print:overflow-visible';

/** Placeholder text of an empty cell (old `.placeholder-cell`). */
export const placeholderCell = 'italic text-[#94a3b8] dark:text-[#64748b]';

/** Empty list message (old `.empty-state`). */
export const emptyState = 'px-5 py-[35px] text-center text-[13px] text-[#677d95] dark:text-[#64748b]';

/** Modal dialogs (old `.tentative-overlay` / `.tentative-panel` and their parts). */
export const dialog = {
  overlay:
    'fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(17,42,70,.45)] p-[18px] dark:bg-black/65 print:!hidden',
  panel:
    'max-h-[90vh] w-[540px] max-w-full overflow-auto rounded-lg border border-solid border-[#c9d8e8] bg-white p-[22px] ' +
    'shadow-[0_12px_40px_rgba(17,42,70,.25)] dark:border-[#2a3346] dark:bg-[#181c25] dark:text-[#e2e8f0] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]',
  title: 'm-0 text-lg leading-[normal] font-bold text-[#173756] dark:text-[#f8fafc]',
  context: 'mx-0 mb-[18px] mt-2 text-xs leading-[normal] text-[#64748b]',
  fieldset: 'mx-0 my-3.5 rounded-[5px] border border-solid border-[#d6e1eb] p-3 dark:border-[#2a3346]',
  legend: 'px-[5px] text-[13px] font-semibold text-[#23496b] dark:text-[#cbd5e1]',
  textarea:
    'mt-2 min-h-[85px] w-full resize-y rounded-[5px] border border-solid border-[#b9ccdf] p-2.5 text-[13px] ' +
    'dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#e2e8f0]',
  actions: 'mt-4 flex justify-end gap-2',
  error: 'mx-0 mb-0 mt-2.5 min-h-4 text-xs leading-[normal] text-[#b91c1c] dark:text-[#f87171]',
};

/** Floating message at the bottom right (old `#toast` / `.toast`). */
export const toast = {
  base:
    'fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 rounded-md bg-[#1e293b] px-5 py-3 text-[13px] text-white ' +
    'shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition-all duration-[250ms] ' +
    'dark:border dark:border-solid dark:border-[#2a3346] dark:bg-[#1e2330] dark:text-[#e2e8f0]',
  hidden: 'pointer-events-none translate-y-3 opacity-0',
};
