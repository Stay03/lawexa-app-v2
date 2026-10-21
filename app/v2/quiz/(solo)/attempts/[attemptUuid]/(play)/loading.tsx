import { AttemptPlayerFallback } from '@/v2/features/quiz/solo/player/states';

/**
 * Route-level loading boundary for the solo PLAY page — inside the `(play)`
 * route group so the play skeleton wraps the play page and NOTHING ELSE (the
 * practice player's precedent; see `app/v2/loading.tsx` for the bug the
 * group prevents).
 *
 * It renders the SAME component the play states export, so route boundary →
 * live question is one continuous shape.
 */
export default function QuizAttemptLoading() {
  return <AttemptPlayerFallback />;
}
