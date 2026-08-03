import { HistoryFallback } from '@/v2/features/quiz/history/HistoryScreen';

/**
 * Route-level loading boundary for `/quiz/history`.
 *
 * It renders the SAME component the screen exports, so route boundary → live
 * list is one continuous shape and nothing moves at the hand-off. The heading
 * and its two actions are static chrome and are drawn FOR REAL (inert), never
 * as grey bars — only the rows are reserved.
 */
export default function QuizHistoryLoading() {
  return <HistoryFallback />;
}
