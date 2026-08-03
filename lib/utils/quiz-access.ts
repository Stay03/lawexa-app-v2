import type { UserRole } from '@/types/auth';

/**
 * Who may see and use the Quiz **player**.
 *
 * OPEN TO EVERY REGISTERED ACCOUNT (owner decision, August 3 2026 — this
 * replaced the researcher/admin/superadmin soft-launch list the same day it
 * shipped). The only excluded roles are the two that are not registered people:
 *
 *  - `guest` — view-only pre-registration accounts. They are nudged to create
 *    a real account (the v2 gate renders that panel; v1's guard still bounces).
 *  - `bot` — crawler identities; no business in a practice session.
 *
 * Exclusion-based on purpose: a future registered role is quiz-eligible by
 * default, which is what "all registered users" means. The `satisfies` clause
 * guarantees every entry is a real role, so a typo fails the build.
 *
 * The backend enforces verified-email only — it does NOT block guests (a guest
 * token played a full session via the API, verified live 2026-08-03). The
 * server-side guest block is a pending backend ask
 * (docs/v2-docs/backend-ask-2026-08-03-quiz.md); until it lands this helper is
 * product truth, not security.
 *
 * Scope: this gates the player only. The admin moderation console is gated
 * separately by the backend (`role:admin`) and the existing AdminGuard.
 */
const QUIZ_EXCLUDED_ROLES = ['guest', 'bot'] as const satisfies readonly UserRole[];

/**
 * Whether the given role may access the Quiz player. Returns `false` for a
 * missing role (logged out or not yet loaded) and for the excluded roles.
 */
export function canAccessQuizPlayer(role: UserRole | null | undefined): boolean {
  return !!role && !(QUIZ_EXCLUDED_ROLES as readonly UserRole[]).includes(role);
}
