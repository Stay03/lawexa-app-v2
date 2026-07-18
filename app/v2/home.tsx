'use client';

import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/auth';
import { useHomeTab, useHomeTabFading } from '@/v2/shell/home-tab';
import { ChatHome } from '@/v2/shell/designs/ChatHome';
import { WorkHome } from '@/v2/shell/designs/WorkHome';
import { StudyHome } from '@/v2/shell/designs/StudyHome';

/**
 * V2Home — the tab-reading client wrapper. Reads the shared `home-tab` store
 * (the same store the header `HomeTabs` control writes) and renders the active
 * home surface — Chat | Work | Study (owner #34) — so switching tabs re-renders
 * the home in lockstep. `name` + `signedIn` + `role` are threaded from
 * `app/v2/page.tsx` (server-verified session), so the greeting name, composer
 * furniture, and gating are correct on first paint with no client auth round-trip.
 *
 * SYMMETRIC SWAP (owner #24): the tab flip is not a hard cut. This wrapper is the
 * ONE persistent element that survives the swap (the surface roots key-remount,
 * so they can't own the transition themselves). The store raises `fading` for a
 * beat before it swaps the tab, so this wrapper fades the outgoing home OUT, the
 * tab flips at the low point, then it fades the incoming home IN — both
 * directions animate. `duration-200 ease-in-out` (owner #32) stays in lockstep
 * with the store's `FADE_MS` (200ms), which is when the tab swaps. `h-full` gives
 * the surface roots a definite height context for their own `min-h-full` while
 * the wrapper persists across the swap. Reduced motion skips the fade (store-side)
 * and the `motion-reduce` guard drops the transition here too.
 *
 * Every surface carries the `data-v2-marker="V2-HOME"` marker + its
 * `data-home-tab` on its root and is server-renderable; the store's server
 * snapshot is `'chat'`, so the initial HTML always contains the Chat home with
 * the marker present.
 */
export function V2Home({
  name,
  signedIn,
  role,
}: {
  name?: string;
  signedIn?: boolean;
  role?: UserRole;
}) {
  const tab = useHomeTab();
  const fading = useHomeTabFading();

  return (
    <div
      className={cn(
        'h-full transition-opacity duration-200 ease-in-out motion-reduce:transition-none',
        fading ? 'opacity-0' : 'opacity-100',
      )}
    >
      {tab === 'work' ? (
        <WorkHome name={name} signedIn={signedIn} role={role} />
      ) : tab === 'study' ? (
        <StudyHome name={name} signedIn={signedIn} role={role} />
      ) : (
        <ChatHome name={name} signedIn={signedIn} role={role} />
      )}
    </div>
  );
}
