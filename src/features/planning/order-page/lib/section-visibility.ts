/*
 * Hide/Unhide of the order page's parts (General Information and each plan section), remembered by this browser.
 * A tiny external store for useSyncExternalStore: the server snapshot is "nothing hidden", and localStorage is read
 * only in the browser (inside try/catch: private windows and blocked storage simply remember nothing).
 */

const STORAGE_KEY = 'orderPage.hiddenSections';

let snapshot: string | null = null;
const listeners = new Set<() => void>();

function read(): string {
  if (snapshot === null) {
    try {
      snapshot = localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      snapshot = '';
    }
  }
  return snapshot;
}

export function subscribeHiddenSections(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Comma-separated keys of the hidden parts (a string, so the snapshot is stable between reads). */
export function getHiddenSectionsSnapshot(): string {
  return typeof window === 'undefined' ? '' : read();
}

export function getHiddenSectionsServerSnapshot(): string {
  return '';
}

export function parseHiddenSections(value: string): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

export function setSectionHidden(key: string, hidden: boolean): void {
  const keys = new Set(parseHiddenSections(read()));
  if (hidden) keys.add(key);
  else keys.delete(key);
  snapshot = [...keys].sort().join(',');
  try {
    localStorage.setItem(STORAGE_KEY, snapshot);
  } catch {
    /* not remembered */
  }
  listeners.forEach((listener) => listener());
}
