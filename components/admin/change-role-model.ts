import type { UserRole } from '@/types/auth';

/* The rules behind the admin "Change role" control. Arthur chose option 3 on
 * 29 October 2026; the techlead approved design d0ed4466 the same day. The
 * server refuses your own role and (with Backend's guard) any role at or above
 * a non-superadmin's own, but some of these rules hold only here, so they are
 * kept pure and pinned by change-role-model.test.ts. */

/** The server's role priority. Higher outranks lower. */
export const ROLE_PRIORITY: Record<UserRole, number> = {
  superadmin: 5,
  admin: 4,
  researcher: 3,
  user: 2,
  guest: 1,
  bot: 0,
};

/** The only roles ever offered, in the order the dialog lists them. Guest and Bot never are. */
export const CHANGEABLE_ROLES = ['superadmin', 'admin', 'researcher', 'user'] as const;

export type ChangeableRole = (typeof CHANGEABLE_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  researcher: 'Researcher',
  user: 'User',
  guest: 'Guest',
  bot: 'Bot',
};

export const ROLE_DESCRIPTIONS: Record<ChangeableRole, string> = {
  superadmin: 'Everything, including other admins’ roles.',
  admin: 'The admin pages, and roles below Admin.',
  researcher: 'Research tools, no admin pages.',
  user: 'The normal app.',
};

/** Narrows a role string from the API to a known role, or null. */
export function asRole(value: string | null | undefined): UserRole | null {
  return value != null && Object.hasOwn(ROLE_PRIORITY, value) ? (value as UserRole) : null;
}

export function isChangeableRole(value: string | null | undefined): value is ChangeableRole {
  return (CHANGEABLE_ROLES as readonly string[]).includes(value ?? '');
}

/**
 * The roles this actor may give this target, in list order. A superadmin may
 * set any of the four; anyone else only roles strictly below their own, and
 * only on a target strictly below them. The target's current role is left out
 * (the dialog shows it as "Current", never pickable). Guest and bot targets get
 * nothing.
 */
export function assignableRoles(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined
): ChangeableRole[] {
  const actor = asRole(actorRole);
  const target = asRole(targetRole);
  if (actor === null || target === null) return [];
  if (actor !== 'superadmin' && actor !== 'admin') return [];
  if (target === 'guest' || target === 'bot') return [];
  if (actor !== 'superadmin' && ROLE_PRIORITY[target] >= ROLE_PRIORITY[actor]) return [];
  return CHANGEABLE_ROLES.filter(
    (role) =>
      role !== target &&
      (actor === 'superadmin' || ROLE_PRIORITY[role] < ROLE_PRIORITY[actor])
  );
}

/** Whether the "Change role" button shows at all. Never on your own account. */
export function canChangeRole({
  actorRole,
  targetRole,
  isSelf,
}: {
  actorRole: string | null | undefined;
  targetRole: string | null | undefined;
  isSelf: boolean;
}): boolean {
  if (isSelf) return false;
  return assignableRoles(actorRole, targetRole).length > 0;
}

/** The name the dialog and toast use; "This account" when there is none. */
export function displayName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed === '' ? 'This account' : trimmed;
}

/** "an Admin", "a Researcher", "a User", "a Superadmin". */
export function roleWithArticle(role: UserRole): string {
  const label = ROLE_LABELS[role];
  return /^[AEIO]/.test(label) ? `an ${label}` : `a ${label}`;
}
