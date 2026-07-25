import { HomeFallback } from '@/v2/shell/designs/HomeFallback';

/**
 * Route-level loading boundary for the v2 root (`/` — the home).
 *
 * Next compiles this file into the `fallback` of a real `<Suspense>` that wraps
 * `page.tsx` (and never the layout above it), so what it renders is the shape the
 * user looks at while `app/v2/page.tsx` resolves its server session.
 *
 * A server shell rendering a `'use client'` child — the same convention every v2
 * `page.tsx` follows, and the reason the fallback can be tab-aware at all: the
 * active home tab lives only in `localStorage`, which no server render can see,
 * but a client reference in the fallback payload is rendered by React IN THE
 * BROWSER on a soft navigation. On a hard load it streams inside the static shell
 * and reads the store's server snapshot (`'chat'`) — which is right, because the
 * page it hands off to paints Chat too. `HomeFallback` carries the full rationale,
 * the per-tab geometry, and the inertness guarantees.
 *
 * This file stays deliberately thin: the fallback's geometry belongs beside the
 * surfaces it mirrors (`v2/shell/designs/`), sharing one frame definition with
 * them, not duplicated in the route folder where it would quietly drift.
 */
export default function V2Loading() {
  return <HomeFallback />;
}
