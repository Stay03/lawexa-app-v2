'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * DestinationFallback — let a segment boundary paint the shape of where the
 * reader is actually going.
 *
 * ── THE PROBLEM THIS EXISTS FOR, AND THE TWO FIXES THAT FAILED ─────────────
 * A segment's `loading.tsx` wraps its CHILD SLOT, and `/cases` holds two kinds
 * of child: the library list (inside the `(library)` route group, which adds no
 * URL segment and therefore does NOT escape this boundary) and the case
 * documents. One boundary, two shapes needed.
 *
 * July made it the DOCUMENT's shape, because list→case is the common move. The
 * cost was that arriving at the LIST painted a document silhouette first — the
 * owner's "wrong skeleton, then another skeleton".
 *
 * On 15 August I made it NEUTRAL to fix that, and shipped a worse bug: opening
 * a case from the list went from a document skeleton to a BLANK screen for the
 * whole fetch (measured: `sk=0` throughout). `[slug]/loading.tsx` exists and
 * never gets a turn, because the changed segment is the child slot of `cases/`
 * and this is the boundary that runs for it. Reverted in 5c987b7.
 *
 * Both attempts assumed the boundary had to commit to one shape. It does not.
 *
 * ── WHY `usePathname` IS THE RIGHT SOURCE ──────────────────────────────────
 * The App Router updates the pathname at navigation START, so while this
 * boundary is on screen the hook already reports the DESTINATION rather than
 * the page being left. That is exactly the fact the boundary was missing.
 *
 * It is also SSR-safe, which the obvious `window.location` read is not: Next
 * supplies the pathname to client components during the server render, so a
 * cold load renders the same branch on both sides and there is no hydration
 * mismatch to paper over.
 *
 * ── IT DECIDES BY EXCLUSION, NOT BY MATCHING THE DOCUMENT ──────────────────
 * `isIndex` names the handful of paths that are the section's own index; every
 * other path under the segment is a document. That direction matters: a new
 * document route (a report, a print view, a sub-page) is automatically treated
 * as a document, whereas a rule written the other way round would silently
 * paint the index shape for it until somebody noticed.
 */
export function DestinationFallback({
  indexPaths,
  index,
  document,
}: {
  /**
   * The paths that mean "the section's own index". Both the clean path and its
   * `/v2` twin, because the rewrite proxy means either can be what the router
   * reports depending on how the reader arrived.
   */
  indexPaths: readonly string[];
  /** Painted when the destination is the index. */
  index: ReactNode;
  /** Painted for everything else under this segment. */
  document: ReactNode;
}) {
  const pathname = usePathname();
  const isIndex = indexPaths.includes(pathname);
  return <>{isIndex ? index : document}</>;
}
