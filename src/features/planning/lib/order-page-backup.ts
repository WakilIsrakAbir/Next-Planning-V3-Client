import type { Loose } from '@/features/planning/lib/order-plan-logic';
import { groupFields, groupsOf, statusGroupOf, type DeptDraft, type GroupKey } from '@/features/planning/lib/order-page-model';

/*
 * Backup of the order page's unsaved work in sessionStorage (this tab only), so that it survives what the guard cannot
 * stop: the session ending at midnight, a sign-out forced by the heartbeat or a 401, a reload or a crash. After the
 * user signs in again in the same tab and opens the order, the page offers to restore it.
 *
 * - One entry per department with unsaved work, keyed by user + order + department + the base fingerprint the work
 *   was made on. It holds the item ids, the values of the unsaved field groups and the draft Order Status.
 * - It is offered only while that fingerprint is still the department's stored one (nobody saved it since) and the
 *   order still has the same items, and only for sections the user may change on that page.
 * - Every storage access is inside try/catch: a private window or blocked storage simply keeps no backup.
 */

const PREFIX = 'planning.orderBackup:';

/** Unsaved work is written this long after the last change (and at once when the page goes away). */
export const BACKUP_DELAY_MS = 500;

export interface DeptBackup {
  v: 1;
  dept: string;
  /** The base fingerprint the work was made on (also part of the key). */
  base: string;
  savedAt: number;
  /** The field groups with unsaved work (delivery: 'floor' and/or 'lock'). */
  groups: GroupKey[];
  /** Per row: the item id and the values of the fields of `groups`. */
  rows: Loose[];
  /** The draft Order Status, when the department's status group is in `groups`. */
  status?: string;
}

const part = (value: string) => encodeURIComponent(value);
const deptPrefix = (user: string, orderNo: string, dept: string) => `${PREFIX}${part(user)}:${part(orderNo)}:${part(dept)}:`;

export function backupKey(user: string, orderNo: string, dept: string, fingerprint: string): string {
  return deptPrefix(user, orderNo, dept) + part(fingerprint);
}

/** The signed-in user (as LoginScreen stores it), or '' when unknown. */
export function readStoredUser(): string {
  try {
    const username = localStorage.getItem('username');
    if (username) return username;
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user && typeof user.username === 'string' ? user.username : '';
  } catch {
    return '';
  }
}

function keysStartingWith(prefix: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

/** The unsaved work of `groups` of a department, ready to store. */
export function buildBackup(draft: DeptDraft, dept: string, groups: GroupKey[], base: string, now: number): DeptBackup {
  const fields = groups.flatMap((g) => groupFields(g));
  const rows = draft.rows.map((row) => {
    const out: Loose = { itemId: row?.itemId };
    fields.forEach((f) => {
      out[f] = row?.[f];
    });
    return out;
  });
  const backup: DeptBackup = { v: 1, dept, base, savedAt: now, groups: [...groups], rows };
  if (groups.includes(statusGroupOf(dept))) backup.status = draft.status;
  return backup;
}

/** Stores a department's backup, replacing any older one of that user, order and department. */
export function writeBackup(user: string, orderNo: string, backup: DeptBackup): void {
  try {
    const key = backupKey(user, orderNo, backup.dept, backup.base);
    keysStartingWith(deptPrefix(user, orderNo, backup.dept)).forEach((k) => {
      if (k !== key) sessionStorage.removeItem(k);
    });
    sessionStorage.setItem(key, JSON.stringify(backup));
  } catch {
    /* not backed up */
  }
}

/** Removes every backup of that user, order and department. */
export function removeBackups(user: string, orderNo: string, dept: string): void {
  try {
    keysStartingWith(deptPrefix(user, orderNo, dept)).forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* nothing stored */
  }
}

/** The backup made on `fingerprint`, or null (none, unreadable, or not a backup of that department). */
export function readBackup(user: string, orderNo: string, dept: string, fingerprint: string): DeptBackup | null {
  try {
    const raw = sessionStorage.getItem(backupKey(user, orderNo, dept, fingerprint));
    if (!raw) return null;
    const b = JSON.parse(raw);
    const known = groupsOf(dept);
    const valid =
      b &&
      b.v === 1 &&
      b.dept === dept &&
      b.base === fingerprint &&
      Array.isArray(b.rows) &&
      Array.isArray(b.groups) &&
      b.groups.length > 0 &&
      b.groups.every((g: unknown) => known.includes(g as GroupKey)) &&
      (b.status === undefined || typeof b.status === 'string');
    return valid ? (b as DeptBackup) : null;
  } catch {
    return null;
  }
}

/** The backup belongs to these rows: the same items in the same order. */
export function backupFits(backup: DeptBackup, draft: DeptDraft | undefined): boolean {
  if (!draft || draft.rows.length !== backup.rows.length) return false;
  return draft.rows.every((row, i) => row?.itemId === backup.rows[i]?.itemId);
}
