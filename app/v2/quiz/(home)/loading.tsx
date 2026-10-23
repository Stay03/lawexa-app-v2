import { QuizHomeFallback } from '@/v2/features/quiz/home/QuizHomeScreen';

/**
 * Route-level loading boundary for `/quiz`, the Quiz home. It lives in the
 * `(home)` group so it wraps the home and nothing else; the `/quiz` segment
 * boundary above it stays neutral for the other quiz screens.
 */
export default function QuizHomeLoading() {
  return <QuizHomeFallback />;
}
