import { CollabAccessGate } from '@/v2/features/collab/access';

/**
 * v2 `/spaces/*` — the segment layout, and (with its `/channels` twin) the ONE
 * place the collab audience is decided (phase-5 W1 item 7; owner decision D1,
 * 2026-08-04 — every registered account, guests/bots excluded).
 *
 * A layout does NOT re-render on a soft navigation, so mounting the gate here
 * means the check runs once per full page load and every spaces hop below it
 * is free. An ineligible viewer never renders a collab screen, query or route
 * fallback at all: the gate short-circuits above any `<Suspense>` a child
 * `loading.tsx` compiles into.
 *
 * A SERVER layout rendering a `'use client'` gate, per the v2 convention (the
 * quiz layout is the exemplar) — children stay server components, passed
 * through untouched. The gate is synchronous (it reads the session snapshot
 * the v2 layout already resolved), so there is no pending branch and no
 * flash.
 *
 * ROUTES STAY DARK: the pages landed with W4 — `(list)/page.tsx` for the
 * spaces list and `[spaceId]/page.tsx` for one space — but `/spaces` is still
 * deliberately absent from `v2/routes.manifest.ts` until W5, so the clean URL
 * keeps falling through to v1 and these screens are reachable only by a direct
 * `/v2/...` URL in dev.
 */
export default function V2SpacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CollabAccessGate>{children}</CollabAccessGate>;
}
