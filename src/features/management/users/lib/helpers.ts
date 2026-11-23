import type { UserRole } from '@/types/user';

const USER_ROLES: UserRole[] = ['Admin', 'Approver', 'Planner', 'Viewer'];

export function asUserRole(value: unknown): UserRole {
  return USER_ROLES.includes(value as UserRole) ? (value as UserRole) : 'Viewer';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasOwnKey(obj: unknown, key: string): boolean {
  return isRecord(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
