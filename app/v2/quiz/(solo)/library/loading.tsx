import { LibraryFallback } from '@/v2/features/quiz/solo/library/LibraryScreen';

/**
 * Route-level loading boundary for `/quiz/library`.
 *
 * It renders the SAME component the screen exports, so route boundary → live
 * list is one continuous shape and nothing moves at the hand-off. The heading
 * and its one action are static chrome and are drawn FOR REAL (inert), never
 * as grey bars — only the rows are reserved.
 */
export default function QuizLibraryLoading() {
  return <LibraryFallback />;
}
