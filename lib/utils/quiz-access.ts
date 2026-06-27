import type { UserRole } from '@/types/auth';

/**
 * Roles allowed to see and use the Quiz **player** during its in-development
 * soft launch. Everyone else gets no nav link and is bounced from the routes —
 * see docs/quiz/main-plan.md §2.
 *
 * Opening Quiz to all users later is a one-line change: widen (or drop) this
 * list. The `satisfies` clause guarantees every entry is a real role, so a typo
 * fails the build.
 *
 * Scope: this gates the player only. The admin moderation console is gated
 * separately by the backend (`role:admin`) and the existing AdminGuard.
 */
export const QUIZ_PLAYER_ROLES = [
  'researcher',
  'admin',
  'superadmin',
] as const satisfies readonly UserRole[];

/**
 * Whether the given role may access the Quiz player. Returns `false` for a
 * missing role (logged out, guest, or not yet loaded).
 */
export function canAccessQuizPlayer(role: UserRole | null | undefined): boolean {
  return !!role && (QUIZ_PLAYER_ROLES as readonly UserRole[]).includes(role);
}
