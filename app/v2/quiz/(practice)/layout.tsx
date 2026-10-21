import { QuizAccessGate } from '@/v2/features/quiz/access';

/**
 * v2 `/quiz/*`, the PRACTICE half — the hub, the session player, its results,
 * the history and the stats — and the ONE place that half's audience is
 * decided.
 *
 * A layout does NOT re-render on a soft navigation, so mounting the gate here
 * means the check runs once per full page load and every hub → player →
 * results → history hop below it is free. It also means an ineligible viewer
 * never renders a quiz screen, a quiz query or a quiz route fallback at all:
 * the gate short-circuits above the `<Suspense>` that `loading.tsx` compiles
 * into.
 *
 * ── WHY A ROUTE GROUP (21 October 2026) ────────────────────────────────────
 * The gate used to sit on `app/v2/quiz/layout.tsx`, over everything under
 * `/quiz`. The solo quiz brought two addresses that must render SIGNED OUT —
 * `/quiz/explore` and `/quiz/q/{uuid}`, which anyone may browse — and two
 * that need an account with words of their own (`(solo)/layout.tsx`). So the
 * practice routes moved into this group, which adds no segment to the URL,
 * and the gate came with them. The segment boundary (`../loading.tsx`) stays
 * above all of it, neutral, as before.
 *
 * A SERVER layout rendering a `'use client'` gate, per the v2 convention — the
 * children stay server components and are simply passed through. The gate is
 * synchronous (it reads the session snapshot the v2 layout already resolved),
 * so there is no pending branch and no flash; see `v2/features/quiz/access.tsx`
 * for why that replaces v1's hydrate-then-redirect guard.
 */
export default function V2QuizPracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <QuizAccessGate surface="practice">{children}</QuizAccessGate>;
}
