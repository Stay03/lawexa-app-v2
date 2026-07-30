/**
 * The v2 SEGMENT boundary — the fallback for ANY v2 page whose shell is not
 * client-available at navigation time, and therefore the one boundary that
 * cannot know its destination's shape.
 *
 * ── THE SKELETON SYSTEM (owner, July 31 — "understand it properly so this
 * never repeats") ──────────────────────────────────────────────────────────
 * A segment's `loading.tsx` wraps its CHILD SLOT, not its own page. Painting
 * a PAGE's skeleton from a SEGMENT boundary is therefore a category error
 * that surfaces as "I saw the wrong page's skeleton for a second":
 *
 *   - `cases/loading.tsx` (list shape) painted before every case — fixed by
 *     the `(library)` group + a document-shaped `cases/loading.tsx`;
 *   - THIS file used to render `HomeFallback` — the HOME's shape — and it
 *     painted on any section switch with a cold shell, which is common here
 *     because the v2 rewrite proxy breaks parameterised-route prefetch (the
 *     client's segment cache requests junk `/undefined` URLs).
 *
 * THE RULES, so the mistake cannot replicate:
 *   1. A page's skeleton lives in a ROUTE GROUP beside the page —
 *      `(home)/loading.tsx`, `(library)/loading.tsx` — so it wraps that page
 *      and nothing else.
 *   2. A segment-level `loading.tsx` is shaped for the CHILDREN navigated
 *      into it. If they all share one shape, use it (`cases/` → the document
 *      skeleton). If they don't, it must be NEUTRAL — never one sibling's
 *      shape.
 *   3. Neutral means EMPTY: the persistent shell (sidebar, header) already
 *      frames the wait, the destination's own boundary takes over the moment
 *      its shell arrives, and a quiet beat is honest where any silhouette
 *      would be a lie about where the reader is going.
 */
export default function V2SegmentLoading() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading page
      </span>
      <div aria-hidden className="min-h-full" />
    </>
  );
}
