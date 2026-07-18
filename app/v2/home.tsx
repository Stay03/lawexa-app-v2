'use client';

import { useDesignMode } from '@/v2/shell/design-mode';
import { HomeDesignA } from '@/v2/shell/designs/HomeDesignA';
import { HomeDesignB } from '@/v2/shell/designs/HomeDesignB';

/**
 * V2Home — the mode-reading client wrapper. Reads the shared `design-mode` store
 * (same store the header `DesignSwitch` writes) and renders the selected home
 * candidate, so flipping the switch re-renders the home in lockstep. The `name`
 * prop is still threaded from `app/v2/page.tsx` (verifySession first name).
 *
 * Both candidates carry the `data-v2-marker="V2-HOME"` marker on their root and
 * are server-renderable; the store's server snapshot is `'a'`, so the initial
 * HTML always contains a design-A home with the marker present.
 */
export function V2Home({ name }: { name?: string }) {
  const mode = useDesignMode();
  return mode === 'b' ? <HomeDesignB name={name} /> : <HomeDesignA name={name} />;
}
