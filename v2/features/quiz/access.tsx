'use client';

import { canAccessQuizPlayer } from '@/lib/utils/quiz-access';
import { useV2Session } from '@/v2/runtime/session-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { QuizCreateAccountState, QuizSignedOutState } from './ui/states';

/**
 * QuizAccessGate — the ONE audience gate for every `/quiz/*` surface. Mounted
 * once, in `app/v2/quiz/layout.tsx`, so it decides before any quiz screen,
 * query or route fallback below it exists.
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
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 * NOT a security boundary, and it does not pretend to be one. The audience —
 * EVERY registered account, guests and bots excluded (`canAccessQuizPlayer`;
 * widened from the researcher/admin soft launch by the owner on August 3
 * 2026) — is a FRONTEND product decision: the backend does not block guest
 * tokens, verified live on 2026-08-03 when one played a full session end to
 * end. The only server-side gate is verified-email, which the screens below
 * handle as its own designed state. A separate backend ask covers the guest
 * block; until it lands, this gate is the UX and is described as exactly that
 * in the panel's copy.
 *
 * ── THE TWO REFUSALS ARE DIFFERENT ANSWERS ──────────────────────────────────
 * Signed out → "sign in", because the door is open once you do. A guest —
 * view-only pre-registration, the only signed-in identity outside the
 * audience — → the create-an-account panel, because registering IS the door.
 * Both are designed states with a way onward; neither is a redirect.
 */
export function QuizAccessGate({ children }: { children: React.ReactNode }) {
  const { signedIn, role } = useV2Session();

  if (!signedIn) {
    return (
      <div className={LIST_COLUMN}>
        <QuizSignedOutState />
      </div>
    );
  }

  if (!canAccessQuizPlayer(role)) {
    return (
      <div className={LIST_COLUMN}>
        <QuizCreateAccountState />
      </div>
    );
  }

  return <>{children}</>;
}
