import type { UserRole } from '@/types/auth';

/**
 * Who may WRITE a note.
 *
 * Every registered account, which is the same audience `lib/utils/quiz-access.ts`
 * defines for the quiz player and for the same reason — the two excluded roles
 * are the two that are not registered people:
 *
 *  - `guest` — a view-only pre-registration account. Guests read the library
 *    and hold real bookmarks; they do not author. That is the standing owner
 *    principle, restated as decision 7 of this wave: "Guests read; guests do
 *    not write."
 *  - `bot` — a crawler identity, with no business owning content.
 *
 * EXCLUSION-BASED ON PURPOSE: a registered role added later is note-eligible
 * by default, which is what "every registered account" actually means. The
 * `satisfies` clause guarantees each entry is a real role, so a typo fails the
 * build rather than silently gating nobody.
 *
 * IT IS A SEPARATE MODULE FROM `quiz-access.ts` DELIBERATELY, even though the
 * two lists are identical today. They are two audiences that happen to agree,
 * not one audience read from two places: quiz's is a product decision the
 * owner has already moved once (it was researcher/admin for a day), and
 * writing notes could narrow or widen without quiz following. Importing the
 * quiz predicate here would silently couple them, so the next change to one
 * would move the other with no reviewer seeing it.
 *
 * NOT A SECURITY BOUNDARY. It decides whether an authoring affordance is
 * DRAWN — the "New note" button, the empty state's call to action, the editor
 * route's gate. The API is the authority on whether a save is accepted, and an
 * account outside this set meets a designed panel rather than a broken screen.
 */
const NOTE_WRITE_EXCLUDED_ROLES = ['guest', 'bot'] as const satisfies readonly UserRole[];

/** Whether this role may author notes. `false` when signed out. */
export function canWriteNotes(role: UserRole | null | undefined): boolean {
  return !!role && !(NOTE_WRITE_EXCLUDED_ROLES as readonly UserRole[]).includes(role);
}
