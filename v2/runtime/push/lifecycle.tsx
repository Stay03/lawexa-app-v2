'use client';

import { useEffect, useRef } from 'react';
import { collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { deactivatePushDevice, syncPushDevice } from './register';

/**
 * V2PushLifecycle — the token half of closed-app push (plan W5 item 1).
 * Renders nothing. Mounted once in `app/v2/layout.tsx` beside the realtime
 * spine, because a push registration is app-wide state exactly like the
 * socket: it must survive every soft navigation and must key on the viewer.
 *
 * IT KEYS ON THE SAME IDENTITY EDGE the spine and `V2CacheIdentityGuard` do —
 * the SERVER-VERIFIED `userId`. Two transitions matter and they are handled
 * differently on purpose:
 *
 *  - ARRIVAL of an eligible viewer → {@link syncPushDevice}, the idempotent
 *    boot re-sync. It never prompts (that needs a gesture, and the nudge owns
 *    it); it re-affirms a token the viewer already agreed to, which is also
 *    how rotation is handled and how a device that changed hands is re-claimed
 *    for whoever is signed in now (the backend's reassign-on-register rule).
 *  - DEPARTURE of a viewer (A → signed out, or A → B) → teardown, so a shared
 *    browser stops delivering the previous person's mentions.
 *
 * ── WHY THE EDGE IS DETECTED IN AN EFFECT, NOT IN CLEANUP ──────────────────
 * An effect CLEANUP also runs when this component unmounts, and v2 unmounts
 * whenever the user soft-navigates to a page v2 has not claimed (`/settings`,
 * say). Tearing a healthy registration down on a page visit would be a bug
 * with no symptom until the next push failed to arrive. So the previous viewer
 * is held in a ref and compared on each run: a ref WRITE IN AN EFFECT is fine
 * (the React-Compiler rule bans writing refs during RENDER), and seeding it
 * with the current id means a first mount is never mistaken for a change.
 *
 * ── THE HONEST LIMIT OF THE SIGN-OUT TEARDOWN ──────────────────────────────
 * v2 has no sign-out of its own, so the sequence is always v1's: it revokes
 * the session (`POST /auth/logout`) and clears the bearer BEFORE this edge is
 * observable here. The `DELETE /notification-channels/push` therefore usually
 * 401s — it is attempted because there are paths where it lands (an account
 * SWITCH observed inside v2), and swallowed because there is nothing else to
 * do. What genuinely protects the device is the second half of
 * {@link deactivatePushDevice}: deleting the FCM registration locally, after
 * which the server's sends to the old token simply have nowhere to arrive.
 * The row is then reclaimed by the next person who signs in and registers.
 * Recorded as a known gap in `post-implementation.md` rather than papered
 * over.
 */
/**
 * ONE MODULE-LEVEL QUEUE for every token operation this component starts
 * (audit M6). Serializing INSIDE a single effect run is not enough: a real
 * account switch usually arrives as TWO transitions — A → signed out → B — so
 * the teardown for A and the registration for B are started by different
 * effect runs and would otherwise overlap. Both touch the same device token,
 * and interleaved they can end with B's fresh registration deleted by A's
 * teardown. Module scope (one queue per tab) also survives the remount that a
 * detour through a v1 page causes.
 */
let queue: Promise<void> = Promise.resolve();

function enqueue(work: () => Promise<void>): void {
  queue = queue.then(work, work);
}

export function V2PushLifecycle(): null {
  const session = useV2Session();
  const viewerId = session.userId;
  const eligible = collabAccessState(session) === 'eligible';

  // Seeded with the CURRENT viewer, so a first mount (and a remount after a
  // detour through v1) is never read as a departure.
  const lastViewerId = useRef<number | null>(viewerId);

  useEffect(() => {
    const previous = lastViewerId.current;
    lastViewerId.current = viewerId;

    const departed = previous !== null && previous !== viewerId;
    const arrived = viewerId !== null && eligible;
    if (!departed && !arrived) return;

    // Ordered against every other run of this effect — see {@link enqueue}.
    enqueue(async () => {
      if (departed) await deactivatePushDevice();
      if (arrived) await syncPushDevice();
    });
  }, [viewerId, eligible]);

  return null;
}
