'use client';

import { useV2Session } from '@/v2/runtime/session-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { collabAccessState } from './model';
import { CollabCreateAccountState, CollabSignedOutState } from './ui/states';
import { CollabVerifyEmailState } from './ui/VerifyEmailState';

/**
 * CollabAccessGate — the ONE audience gate for every `/spaces/*` and
 * `/channels/*` surface. Mounted once per segment (`app/v2/spaces/layout.tsx`
 * and `app/v2/channels/layout.tsx`), so it decides before any collab screen,
 * query or route fallback below it exists. The exact `QuizAccessGate`
 * pattern; audience per owner decision D1 (2026-08-04); plan W1 item 7.
 *
 * SYNCHRONOUS, AND THAT IS THE WHOLE POINT: `useV2Session()` reads a snapshot
 * the SERVER already resolved before this tree mounted, so the decision is
 * available on the first frame. v1's `SpacesGuard` waited for the auth store
 * to rehydrate and then `router.replace('/')`-ed outsiders — a fake loading
 * state ending in a silent bounce, both DROPPED by the study (A0). No
 * skeleton, no flash, no redirect: refusals are designed states.
 *
 * THE THREE REFUSALS ARE DIFFERENT ANSWERS:
 *  - signed out → "sign in" (the door opens once you do);
 *  - guest → the create-an-account panel (registering IS the door);
 *  - unverified email → the verify panel, the one gate the backend actually
 *    enforces on collab (queries below stay `enabled: false` in this state —
 *    the collab model's `eligible` check is the same predicate everywhere).
 *
 * NOT a security boundary: the backend gates on membership + verified email,
 * not on role, and does not block guest tokens (study §1 item 6). The
 * server-side guest block is the coordinator's backend ask; until it lands
 * this gate is the UX, described as exactly that in the panels' copy.
 */
export function CollabAccessGate({ children }: { children: React.ReactNode }) {
  const session = useV2Session();

  switch (collabAccessState(session)) {
    case 'signed-out':
      return (
        <div className={LIST_COLUMN}>
          <CollabSignedOutState />
        </div>
      );
    case 'create-account':
      return (
        <div className={LIST_COLUMN}>
          <CollabCreateAccountState />
        </div>
      );
    case 'verify-email':
      return (
        <div className={LIST_COLUMN}>
          <CollabVerifyEmailState />
        </div>
      );
    case 'eligible':
      return <>{children}</>;
  }
}
