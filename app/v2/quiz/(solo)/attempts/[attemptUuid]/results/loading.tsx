import { AttemptResultsFallback } from '@/v2/features/quiz/solo/results/states';

/**
 * Route-level loading boundary for `/quiz/attempts/[attemptUuid]/results`.
 *
 * It renders the SAME component as the segment boundary above it and as the
 * screen's own pending state, so segment fallback → route fallback → the live
 * review is one continuous shape and nothing moves at either hand-off.
 */
export default function QuizAttemptResultsLoading() {
  return <AttemptResultsFallback />;
}
