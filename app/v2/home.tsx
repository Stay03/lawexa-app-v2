'use client';

import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/auth';
import { useDesignFading, useDesignMode } from '@/v2/shell/design-mode';
import { HomeDesignA } from '@/v2/shell/designs/HomeDesignA';
import { HomeDesignB } from '@/v2/shell/designs/HomeDesignB';

/**
 * V2Home — the mode-reading client wrapper. Reads the shared `design-mode` store
 * (same store the header `DesignSwitch` writes) and renders the selected home
 * candidate, so flipping the switch re-renders the home in lockstep. `name` +
 * `signedIn` are threaded from `app/v2/page.tsx` (server-verified session), so the
 * greeting name, composer furniture, and recents gating are correct on first
 * paint with no client auth round-trip.
 *
 * SYMMETRIC SWAP (owner #24): the A↔B flip is no longer a hard cut. This is the
 * ONE persistent element that survives the swap (the design roots key-remount, so
 * they can't own the transition themselves). The store raises `fading` for a beat
 * before it swaps `mode`, so this wrapper fades the outgoing home OUT, the mode
 * flips at the low point, then it fades the incoming home IN — both directions
 * animate. Softened to `duration-200 ease-in-out` (owner #32 — the tab cross-fade
 * gets slightly longer/eased so switching never flashes); it stays in lockstep
 * with the store's `FADE_MS` (200ms), which is when the mode swaps. `h-full` gives the design
 * roots a definite height context for their own `min-h-full` while the wrapper
 * persists across the swap. Reduced motion skips the fade (store-side) and the
 * `motion-reduce` guard drops the transition here too.
 *
 * Both candidates carry the `data-v2-marker="V2-HOME"` marker on their root and
 * are server-renderable; the store's server snapshot is `'a'`, so the initial
 * HTML always contains a design-A home with the marker present.
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
  const mode = useDesignMode();
  const fading = useDesignFading();

  return (
    <div
      className={cn(
        'h-full transition-opacity duration-200 ease-in-out motion-reduce:transition-none',
        fading ? 'opacity-0' : 'opacity-100',
      )}
    >
      {mode === 'b' ? (
        <HomeDesignB name={name} signedIn={signedIn} role={role} />
      ) : (
        <HomeDesignA name={name} signedIn={signedIn} role={role} />
      )}
    </div>
  );
}
