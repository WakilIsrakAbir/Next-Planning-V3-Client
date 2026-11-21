'use client';

import { useEffect, useRef } from 'react';

/* Unsaved-work guard shared by every page that edits data (order page sections, Planning Guide, Plan Check List)
   and by the Sidebar.
   - A source registers the names of its unsaved work ("Dyeing Plan", "Planning Guide", ...) while it has any.
   - Leaving the page then asks first: Sidebar links and Sign Out, the order page's Back, and closing or reloading
     the tab (the browser's own beforeunload prompt).
   - With nothing unsaved nobody is asked and every navigation works exactly as without the guard. */

/** Something that can cancel a navigation: the event of a Next <Link> `onNavigate`. */
export interface NavigateEventLike {
  preventDefault(): void;
}

// One entry per source id, kept in registration order (a Map keeps the order of first insertion).
const sources = new Map<string, () => string[]>();
let listening = false;
// Set once the user has agreed to a full page load (confirmPageLeave): that load must not ask a second time.
let skipNextUnloadPrompt = false;

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (skipNextUnloadPrompt) {
    skipNextUnloadPrompt = false;
    return;
  }
  if (getUnsavedLabels().length === 0) return;
  event.preventDefault();
  // Older browsers show the prompt only when returnValue is set.
  event.returnValue = true;
}

// ONE beforeunload listener for the whole app, attached only while a source is registered.
function syncUnloadListener(): void {
  if (typeof window === 'undefined') return;
  const wanted = sources.size > 0;
  if (wanted === listening) return;
  listening = wanted;
  if (wanted) {
    window.addEventListener('beforeunload', onBeforeUnload);
  } else {
    window.removeEventListener('beforeunload', onBeforeUnload);
    skipNextUnloadPrompt = false;
  }
}

/**
 * Registers a source of unsaved work. `getLabels` is read each time someone asks and returns the names of what
 * is unsaved right now ([] = nothing). Registering an id again replaces that source and keeps its place.
 * Returns the function that unregisters it (it never removes a newer registration of the same id).
 */
export function registerUnsavedChanges(id: string, getLabels: () => string[]): () => void {
  sources.set(id, getLabels);
  syncUnloadListener();
  return () => {
    if (sources.get(id) !== getLabels) return;
    sources.delete(id);
    syncUnloadListener();
  };
}

/** The names of all unsaved work: every source's labels in registration order, without duplicates. */
export function getUnsavedLabels(): string[] {
  const labels: string[] = [];
  sources.forEach((getLabels) => {
    for (const label of getLabels()) {
      if (!labels.includes(label)) labels.push(label);
    }
  });
  return labels;
}

/**
 * Registers `labels` as unsaved work of source `id` while the list is not empty; an empty list, another id or
 * unmounting unregisters it. While registered the labels follow the latest render and the source keeps its place.
 */
export function useUnsavedChanges(id: string, labels: string[]): void {
  const latest = useRef(labels);
  useEffect(() => {
    latest.current = labels;
  });
  const active = labels.length > 0;
  useEffect(() => {
    if (!active) return undefined;
    return registerUnsavedChanges(id, () => latest.current);
  }, [id, active]);
}

/**
 * Asks before leaving the page: true at once when nothing is unsaved, otherwise the user's answer to
 * "Unsaved changes in: <A, B>. Leave without saving?".
 */
export function confirmLeave(): boolean {
  const labels = getUnsavedLabels();
  if (labels.length === 0) return true;
  return window.confirm(`Unsaved changes in: ${labels.join(', ')}. Leave without saving?`);
}

/** For a Next <Link> `onNavigate`: cancels the navigation when the user chooses to stay. True = it goes ahead. */
export function guardLinkNavigate(event: NavigateEventLike): boolean {
  if (confirmLeave()) return true;
  event.preventDefault();
  return false;
}

/**
 * onClick + onNavigate for a Next <Link> whose click has side effects (closing the mobile drawer, ...).
 * - Nothing unsaved: the side effects run in onClick exactly as without the guard (also on a Ctrl/Cmd-click that
 *   opens a new tab) and onNavigate does nothing.
 * - Unsaved work: onNavigate asks first. Cancel keeps the page and runs no side effect; OK runs the side effects,
 *   then the navigation. A Ctrl/Cmd-click (new tab) leaves this page and its side effects alone.
 */
export function guardedLinkHandlers(sideEffects: () => void): {
  onClick: () => void;
  onNavigate: (event: NavigateEventLike) => void;
} {
  // Decided once per click in onClick, which Next always runs before onNavigate.
  let ranOnClick = false;
  return {
    onClick: () => {
      ranOnClick = getUnsavedLabels().length === 0;
      if (ranOnClick) sideEffects();
    },
    onNavigate: (event) => {
      if (ranOnClick) return;
      if (guardLinkNavigate(event)) sideEffects();
    },
  };
}

/**
 * For a full page load (window.location, Sign Out): asks like confirmLeave(). When the user agrees to leave
 * unsaved work, the browser's own beforeunload prompt is skipped for that load, so they are asked only once.
 */
export function confirmPageLeave(): boolean {
  if (getUnsavedLabels().length === 0) return true;
  if (!confirmLeave()) return false;
  skipNextUnloadPrompt = true;
  return true;
}
