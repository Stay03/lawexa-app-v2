'use client';

import { usePathname } from 'next/navigation';

import { canAccessQuizPlayer } from '@/lib/utils/quiz-access';
import { useGuestPassFailed } from '@/v2/runtime/guest-pass';
import { useV2Session } from '@/v2/runtime/session-context';
import { signInHref } from '@/v2/runtime/sign-in-href';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { SoloCreateAccountState, SoloSignedOutState } from './solo/states';
import { QuizCreateAccountState, QuizSegmentFallback, QuizSignedOutState } from './ui/states';

/**
 * QuizAccessGate — the ONE audience gate for the account-only `/quiz/*`
 * surfaces. Mounted once per route group — `app/v2/quiz/(practice)/layout.tsx`
 * over the practice player and `app/v2/quiz/(solo)/layout.tsx` over the solo
 * library and attempts — so it decides before any quiz screen, query or route
 * fallback below it exists. `/quiz/explore` and `/quiz/q/{uuid}` are under
 * neither group: anyone may browse them (Arthur's option B, 21 October 2026).
 *
 * ── IT IS SYNCHRONOUS, AND THAT IS THE WHOLE POINT ──────────────────────────
 * v1's `QuizGuard` waited for the persisted auth store to rehydrate, rendered a
 * page-shaped skeleton meanwhile, and then `router.replace('/')` in an effect —
 * so an ineligible user watched a fake loading state and was silently thrown
 * home, and an ELIGIBLE user paid that same wait on every hard load. Neither is
 * necessary here: `useV2Session()` reads a snapshot the SERVER already resolved
 * before this tree mounted, so the decision is available on the first frame.
 * No skeleton, no flash, no redirect.
 *
 * ── THE ONE WAIT IT DOES TAKE: THE GUEST PASS ───────────────────────────────
 * A visitor with no session becomes a GUEST a moment after the shell mounts
 * (`guest-pass.tsx` mints the pass, `SessionSync` re-renders the layout as the
 * guest). A gate that showed "sign in" in that moment and "create an account"
 * the next would flash two panels for one visitor. So while the pass is still
 * being minted the gate shows the segment's quiet beat instead, and the
 * sign-in panel is kept for a pass that could not be had — the same rule the
 * notes library follows.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 * NOT a security boundary, and it does not pretend to be one. The audience —
 * EVERY registered account, guests and bots excluded (`canAccessQuizPlayer`;
 * widened from the researcher/admin soft launch by the owner on August 3
 * 2026) — is a FRONTEND product decision for the practice player: the backend
 * does not block guest tokens there, verified live on 2026-08-03 when one
 * played a full session end to end. The solo attempt routes DO refuse a guest
 * (`403`), so there the gate only says sooner what the server would say.
 *
 * ── THE TWO REFUSALS ARE DIFFERENT ANSWERS, IN EACH SURFACE'S WORDS ─────────
 * Signed out → "sign in", because the door is open once you do. A guest —
 * view-only pre-registration, the only signed-in identity outside the
 * audience — → the create-an-account panel, because registering IS the door.
 * Both are designed states with a way onward; neither is a redirect. The
 * practice panels speak of practising; the solo panels say only what they
 * open, because a quiz somebody wrote is not practice.
 */
export function QuizAccessGate({
  surface,
  children,
}: {
  /** Whose words the two refusals use. */
  surface: 'practice' | 'solo';
  children: React.ReactNode;
}) {
  const { signedIn, role } = useV2Session();
  const guestPassFailed = useGuestPassFailed();
  const pathname = usePathname() ?? '/quiz';
  const signIn = signInHref(pathname);

  if (!signedIn) {
    // A guest pass is on its way — see the docblock.
    if (!guestPassFailed) return <QuizSegmentFallback />;
    return (
      <div className={LIST_COLUMN}>
        {surface === 'solo' ? (
          <SoloSignedOutState signInHref={signIn} />
        ) : (
          <QuizSignedOutState signInHref={signIn} />
        )}
      </div>
    );
  }

  if (!canAccessQuizPlayer(role)) {
    return (
      <div className={LIST_COLUMN}>
        {surface === 'solo' ? (
          <SoloCreateAccountState signInHref={signIn} />
        ) : (
          <QuizCreateAccountState />
        )}
      </div>
    );
  }

  return <>{children}</>;
}
