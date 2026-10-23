import type { Metadata } from 'next';
import { AttemptAnswersScreen } from '@/v2/features/quiz/solo/results/AttemptAnswersScreen';

/**
 * v2 `/quiz/attempts/[attemptUuid]/answers` — "See your answers" for one
 * finished attempt, one question at a time (Stay and Arthur, 23 October
 * 2026). `?q=` names the open question.
 *
 * PRIVATE surface, as the results beside it: the attempt answers only its
 * owner, so the metadata is a bare generic title + noindex, and nothing here
 * waits on Laravel before the page can draw.
 */
interface AttemptAnswersPageProps {
  params: Promise<{ attemptUuid: string }>;
}

export function generateMetadata(): Metadata {
  return {
    title: 'Your answers',
    description: 'Every answer of a finished quiz, one question at a time.',
    robots: { index: false, follow: false },
  };
}

/** The results page's router-cache lever: the segment awaits nothing, and a
 *  finished attempt never changes. */
export const unstable_dynamicStaleTime = 300;

export default async function V2QuizAttemptAnswersPage({ params }: AttemptAnswersPageProps) {
  const { attemptUuid } = await params;
  return <AttemptAnswersScreen attemptUuid={attemptUuid} />;
}
