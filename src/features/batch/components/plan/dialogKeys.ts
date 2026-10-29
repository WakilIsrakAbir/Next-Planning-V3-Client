/* Keyboard handling shared by the Batch Plan dialogs (old keydown listeners): Tab stays inside the dialog. */
import type React from 'react';

/** Old Tab handling: from the last enabled control Tab goes to the first, Shift+Tab from the first to the last. */
export function trapTab(event: React.KeyboardEvent, container: HTMLElement | null, selector: string): void {
  if (event.key !== 'Tab' || !container) return;
  const controls = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (element) => !(element as HTMLButtonElement | HTMLInputElement).disabled
    ),
    first = controls[0],
    last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
