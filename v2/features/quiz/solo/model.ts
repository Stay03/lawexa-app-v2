import type { V2SessionSnapshot } from '@/v2/runtime/session-context';

/**
 * solo quiz model — the pure vocabulary of a quiz taken alone: who may publish
 * one, how it is found, how an attempt is read, and what the player's own
 * clock says. No hooks, no JSX, no browser APIs, so the library, the explore
 * list, the quiz front, the player and the results all read their rules from
 * one place and the node test runner can import it.
 *
 * Source: backend branch quiz-part1-publish-and-solo (tip 45a8f711; bodies in
 * `~/.lawexa/tools/frontend/contracts/quiz-45a8f711.json`), 21 October 2026.
 * The channel game's own vocabulary stays in `channels/quiz/model.ts`; this
 * module imports from it where the two surfaces share a word (the option
 * letters, the response-time format) and never redefines it.
 */

/* ── Who may publish ──────────────────────────────────────────────────────── */

/**
 * May this viewer set a quiz to `public`? The server's own flag
 * (`user.is_verified_author` on `/auth/me`), published on the session
 * snapshot, and nothing else: not the role, not a plan. A COURTESY GATE, like
 * every other presentation flag on the snapshot — the quiz API answers `403`
 * to a public save from anyone else, and the screens render that refusal as
 * a designed line, so a stale snapshot costs one round trip and no error.
 */
export function canPublishPublicly(session: V2SessionSnapshot): boolean {
  return session.signedIn && session.isVerifiedAuthor;
}

/** The one line under a disabled "Public" choice, and the answer to its 403. */
export const PUBLIC_NEEDS_VERIFIED_AUTHOR =
  'Public quizzes are for verified authors. Anyone can still share one by link.';
