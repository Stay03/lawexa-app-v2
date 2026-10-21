import { ExploreFallback } from '@/v2/features/quiz/solo/explore/ExploreScreen';

/**
 * Route-level loading boundary for `/quiz/explore`.
 *
 * It renders the SAME component the screen exports, so route boundary → live
 * list is one continuous shape and nothing moves at the hand-off. The heading
 * is static chrome and is drawn FOR REAL (inert) — only the rows are reserved.
 */
export default function QuizExploreLoading() {
  return <ExploreFallback />;
}
