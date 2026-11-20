import type { RoleName, Scenario } from '../../harness/types';

/** The two roles every department is recorded for: Admin, and a non-admin (Planner). */
export const ADMIN_AND_USER: RoleName[] = ['admin', 'planner'];

export type ScenarioDraft = Omit<Scenario, 'id' | 'role'> & { name: string };

/** One scenario per role, id "<dept>/<name>/<role>"; `build` may return null to leave a role out. */
export function forRoles(build: (role: RoleName, isAdmin: boolean) => ScenarioDraft | null, roles: RoleName[] = ADMIN_AND_USER): Scenario[] {
  const out: Scenario[] = [];
  for (const role of roles) {
    const draft = build(role, role === 'admin' || role === 'approver' || role === 'lowerApprover');
    if (!draft) continue;
    const { name, ...rest } = draft;
    out.push({ ...rest, id: `${rest.dept}/${name}/${role}`, role });
  }
  return out;
}
