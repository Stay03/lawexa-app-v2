import { canAccessCollab } from '@/lib/utils/collab-audience';
import type { V2SessionSnapshot } from '@/v2/runtime/session-context';

/**
 * collab model — the pure access vocabulary the gate
 * (`v2/features/collab/access.tsx`) and the realtime spine
 * (`v2/runtime/realtime/spine.tsx`) both branch on, so the surface that
 * REFUSES and the machinery that FETCHES can never disagree about who is in.
 * Sources: owner decision D1 (every registered account, 2026-08-04) + study
 * §A0 + the quiz `model.ts` precedent. No JSX, no hooks.
 *
 * A NOTE ON 403s, BECAUSE COLLAB DIFFERS FROM QUIZ: on `/quizzes/*` a 403
 * means exactly "verify your email". On collab endpoints a 403 is POLICY —
 * usually "not a member of this channel/space" (digest §C statuses) — and only
 * sometimes verification. There is deliberately NO `isVerificationBlocked`
 * predicate here: W2+ screens must treat a live 403 as an access-denied
 * designed state, never auto-map it to the verify-email panel.
 */

/** The four answers the collab door can give, in decision order. */
export type CollabAccessState =
  | 'signed-out'
  | 'create-account'
  | 'verify-email'
  | 'eligible';

/**
 * Whether THIS viewer's snapshot says the backend will 403 collab reads for an
 * unverified address. Three conditions, each load-bearing (the quiz model's
 * reasoning, which applies verbatim):
 *  - signed in — a signed-out viewer has no address to verify;
 *  - NOT a guest — guests have no email at all (`email: null`); without this
 *    clause a guest would be told to check an inbox they do not have (masked
 *    today by the audience gate running first — encoded anyway so widening the
 *    audience can never ship the bug);
 *  - `email` provider — OAuth accounts arrive verified; gating on `isVerified`
 *    alone would nag every Google user.
 */
export function needsEmailVerification(session: V2SessionSnapshot): boolean {
  return (
    session.signedIn &&
    session.role !== 'guest' &&
    session.authProvider === 'email' &&
    !session.isVerified
  );
}

/**
 * The ONE door decision. Order matters and is part of the contract:
 * sign-in before audience (an anonymous viewer is asked to sign in, not to
 * register), audience before verification (a guest gets the create-account
 * panel, never a verify nag for an inbox they lack).
 *
 * `eligible` is also the FETCH gate: collab queries run `enabled` only in this
 * state (the "queries enabled:false while unverified" rule from the quiz
 * pattern) — an unverified account's requests would only spend round trips to
 * be told what the snapshot already knows.
 */
export function collabAccessState(session: V2SessionSnapshot): CollabAccessState {
  if (!session.signedIn) return 'signed-out';
  if (!canAccessCollab(session.role)) return 'create-account';
  if (needsEmailVerification(session)) return 'verify-email';
  return 'eligible';
}
