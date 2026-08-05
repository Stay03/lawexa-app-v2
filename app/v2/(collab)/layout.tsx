import { CollabAccessGate } from '@/v2/features/collab/access';
import { CollabFrame } from '@/v2/features/collab/shell/CollabFrame';

/**
 * v2 `(collab)` — the ONE segment that `/spaces/*` and `/channels/*` share.
 *
 * ── WHY A ROUTE GROUP, AND WHY IT CHANGES NO URL ───────────────────────────
 * A space and its channels were three unrelated full pages: `/spaces` →
 * `/spaces/{uuid}` → `/channels/{uuid}`, each repainting from a skeleton, so
 * moving between two channels of one space cost a Back and a second tap. The
 * fix is structural, not visual — put both address families under one layout,
 * because **a layout is not re-rendered or re-mounted when the reader navigates
 * between its own descendants** (Next's Layouts RFC: "Layouts … do not
 * re-render (React state is preserved) when a user navigates between sibling
 * segments"). Everything the layout holds — the space rail, its scroll
 * position, its queries, the mobile drawer — therefore survives a channel
 * switch, and only the pane below is fetched and repainted.
 *
 * A PARENTHESISED folder is the only tool that can do this without touching a
 * single address: Next strips `(collab)` from the route, so
 * `app/v2/(collab)/spaces/[spaceId]` still serves `/v2/spaces/{uuid}` and the
 * proxy's `/spaces/x → /v2/spaces/x` rewrite is unaffected.
 * `v2/routes.manifest.ts` matches URL PATHS, so it needs no edit either — and
 * this tree already proves the mechanism twice over, in the `(list)` and
 * `(index)` groups directly below.
 *
 * ── THE RAIL SITS HERE, NOT UNDER `[spaceId]` ──────────────────────────────
 * Deliberately. A layout AT or INSIDE a dynamic segment is remounted when the
 * param value changes (vercel/next.js#44793, #60395 — intended behaviour: a
 * dynamic segment usually names a different object). A layout strictly ABOVE
 * both dynamic segments is the shape that is guaranteed to persist, and it is
 * also the only place that can span two different segment names.
 *
 * ── THE GATE MOVED UP WITH THEM ────────────────────────────────────────────
 * `/spaces` and `/channels` previously carried one `CollabAccessGate` each,
 * with a comment promising the two doors could never drift. They now cannot:
 * there is one door. It still runs once per full page load (a layout is not
 * re-rendered on a soft navigation) and still short-circuits ABOVE every child
 * `loading.tsx`, so an ineligible viewer renders no collab screen, query or
 * route fallback at all. Audience per owner decision D1 (2026-08-04).
 *
 * A SERVER layout rendering `'use client'` children, per the v2 convention —
 * `children` stay server components and are passed through untouched. No
 * `await` runs here: a layout that awaited data would block navigation in a way
 * no `loading.tsx` can cover (loading.js wraps the page, never the layout).
 */
export default function V2CollabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CollabAccessGate>
      <CollabFrame>{children}</CollabFrame>
    </CollabAccessGate>
  );
}
