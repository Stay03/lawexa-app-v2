import type { UserRole } from '@/types/auth';

/**
 * Roles allowed to see and use the Spaces (Channels) feature during its
 * in-development soft launch. Everyone else gets no nav link and is bounced
 * from the routes — mirrors the Quiz gating in `quiz-access.ts`.
 *
 * Opening Spaces to all users later is a one-line change: widen (or drop) this
 * list. The `satisfies` clause guarantees every entry is a real role, so a typo
 * fails the build.
 */
export const SPACES_ROLES = [
  'researcher',
  'admin',
  'superadmin',
] as const satisfies readonly UserRole[];

/**
 * Whether the given role may access the Spaces feature. Returns `false` for a
 * missing role (logged out, guest, or not yet loaded).
 */
export function canAccessSpaces(role: UserRole | null | undefined): boolean {
  return !!role && (SPACES_ROLES as readonly UserRole[]).includes(role);
}
