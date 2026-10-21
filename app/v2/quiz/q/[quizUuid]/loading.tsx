import { QuizFrontFallback } from '@/v2/features/quiz/solo/front/QuizFrontScreen';

/**
 * Route-level loading boundary for `/quiz/q/[quizUuid]`.
 *
 * It renders the SAME component the screen exports, so route boundary → live
 * quiz front is one continuous shape and nothing moves at the hand-off.
 */
export default function QuizFrontLoading() {
  return <QuizFrontFallback />;
}
