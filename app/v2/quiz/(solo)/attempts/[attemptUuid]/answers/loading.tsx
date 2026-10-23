import { AttemptAnswersFallback } from '@/v2/features/quiz/solo/results/states';

/**
 * Route-level loading boundary for `/quiz/attempts/[attemptUuid]/answers`:
 * the same shape as the page's own pending state, so nothing moves at the
 * hand-off.
 */
export default function QuizAttemptAnswersLoading() {
  return <AttemptAnswersFallback />;
}
