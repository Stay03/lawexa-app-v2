import { QuizAccessGate } from '@/v2/features/quiz/access';

/**
 * v2 `/quiz/*` — the segment layout, and the ONE place the quiz audience is
 * decided.
 *
 * A layout does NOT re-render on a soft navigation, so mounting the gate here
 * means the check runs once per full page load and every hub → player →
 * results → history hop below it is free. It also means an ineligible viewer
 * never renders a quiz screen, a quiz query or a quiz route fallback at all:
 * the gate short-circuits above the `<Suspense>` that `loading.tsx` compiles
 * into.
 *
 * A SERVER layout rendering a `'use client'` gate, per the v2 convention — the
 * children stay server components and are simply passed through. The gate is
 * synchronous (it reads the session snapshot the v2 layout already resolved),
 * so there is no pending branch and no flash; see `v2/features/quiz/access.tsx`
 * for why that replaces v1's hydrate-then-redirect guard.
 */
export default function V2QuizLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <QuizAccessGate>{children}</QuizAccessGate>;
}
