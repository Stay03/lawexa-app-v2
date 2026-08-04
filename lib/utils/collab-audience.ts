import type { UserRole } from '@/types/auth';

/**
 * Who may see and use the v2 Spaces/Channels surface.
 *
 * OPEN TO EVERY REGISTERED ACCOUNT (owner decision D1, 2026-08-04 — see
 * `docs/v2-docs/phases/phase-5-collab-notifications/v1-keep-drop-study.md`
 * Part C). The only excluded roles are the two that are not registered people:
 *
 *  - `guest` — view-only pre-registration accounts. The v2 gate renders the
 *    create-an-account panel: registering IS the door.
 *  - `bot`   — crawler identities; no business in a team channel.
 *
 * Exclusion-based on purpose (the `canAccessQuizPlayer` shape): a future
 * registered role is collab-eligible by default, which is what "every
 * registered account" means. The `satisfies` clause guarantees every entry is
 * a real role, so a typo fails the build.
 *
 * This is deliberately NOT `SPACES_ROLES` (`lib/utils/spaces-access.ts`) —
 * that list keeps gating v1's soft launch and stays untouched; this predicate
 * is the v2 audience and only the v2 tree reads it.
 *
 * NOT a security boundary. The backend gates collab on membership + verified
 * email only — it does not block guest tokens (study §1 item 6). The
 * server-side guest block is a pending backend ask owned by the phase-5
 * coordinator; until it lands this helper is product truth, not security.
 */
const COLLAB_EXCLUDED_ROLES = ['guest', 'bot'] as const satisfies readonly UserRole[];

/**
 * Whether the given role may access v2 Spaces/Channels. Returns `false` for a
 * missing role (signed out or not yet loaded) and for the excluded roles.
 */
export function canAccessCollab(role: UserRole | null | undefined): boolean {
  return !!role && !(COLLAB_EXCLUDED_ROLES as readonly UserRole[]).includes(role);
}
