import { ResultsFallback } from '@/v2/features/quiz/results/states';

/**
 * The `[sessionUuid]` SEGMENT boundary.
 *
 * ── WHAT IT ACTUALLY COVERS ─────────────────────────────────────────────────
 * A segment's `loading.tsx` wraps everything below that segment — its OWN page
 * as well as its child segments. The `(play)` route group does not remove the
 * play page from this boundary; it adds a NESTED one inside it. So on a cold
 * navigation to the play page the real order is: this fallback paints first,
 * `(play)/loading.tsx` replaces it as soon as the play segment's shell arrives,
 * then the question.
 *
 * ── WHY IT DRAWS THE RESULTS SHAPE ANYWAY ───────────────────────────────────
 * Traffic decides it. The dominant navigation into this segment is play →
 * results (ending a session), and that transition is covered by THIS boundary
 * alone — the results route's own `loading.tsx` lives inside the changing
 * segment and cannot paint until that segment's shell arrives. Drawing the
 * results shape here is what makes the hand-off after every session move
 * nothing.
 *
 * ACCEPTED COST, stated plainly: a cold navigation INTO the play page (a shared
 * link, or a hub → player hop once the 5-minute router-cache entry has lapsed)
 * shows this results-shaped fallback for one server round trip before
 * `(play)/loading.tsx` takes over with the question shape. One mis-shaped beat
 * on the less common path, traded for a clean hand-off on the one that happens
 * at the end of every session. A neutral empty boundary would make BOTH paths
 * blank, which is worse for the transition that actually recurs.
 *
 * Do not merge this into the `(play)` group's file — see `app/v2/loading.tsx`
 * for the bug that pattern caused on `/cases`.
 */
export default function QuizSessionSegmentLoading() {
  return <ResultsFallback />;
}
