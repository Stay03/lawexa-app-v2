import { PlayerFallback } from '@/v2/features/quiz/player/states';

/**
 * Route-level loading boundary for the PLAY page — inside the `(play)` route
 * group so the play skeleton wraps the play page and NOTHING ELSE.
 *
 * The group is load-bearing (the `cases/(library)` precedent). Without it this
 * file would also be the `[sessionUuid]` SEGMENT boundary and would paint a
 * question with four options on the way to the RESULTS page, which is a score
 * ring over a review — the "I saw the wrong page's skeleton for a second" bug
 * that `app/v2/loading.tsx` documents. The segment boundary beside this group
 * draws the results shape instead, because results is the only child navigated
 * into it.
 *
 * It renders the SAME component the play states export, so route boundary →
 * live question is one continuous shape.
 */
export default function QuizSessionLoading() {
  return <PlayerFallback />;
}
