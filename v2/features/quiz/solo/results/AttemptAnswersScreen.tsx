'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';

import { extractApiError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { clearScreenContext, setScreenContext } from '@/v2/shell/screen-context';
import { QuizMessage } from '../../ui/QuizMessage';
import { QuizErrorState } from '../../ui/states';
import { attemptHref, attemptResultsHref, isFinishedAttempt, orderedQuestions } from '../model';
import { soloQuizQueries } from '../queries';
import { attemptAnswersHref } from './answers-model';
import { AnswersStepper } from './AnswersStepper';
import { AttemptAnswersSkeleton, RESULTS_COLUMN } from './states';
import '../solo-quiz.css';

/**
 * AttemptAnswersScreen — `/quiz/attempts/{uuid}/answers`, "See your answers"
 * as its own page, one question at a time (`AnswersStepper`).
 *
 * It reads the SAME attempt the results read (`soloQuizQueries.attempt`), so
 * opening it from the results is instant: the attempt is already cached. Back
 * returns to the results. An unfinished attempt goes back to the player, as
 * the results do, with the skeleton up while it happens.
 */
export function AttemptAnswersScreen({ attemptUuid }: { attemptUuid: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? attemptAnswersHref(attemptUuid);
  const { userId: viewerId } = useV2Session();

  const query = useQuery(soloQuizQueries.attempt(attemptUuid, { viewerId }));
  const attempt = query.data?.data ?? null;
  const unfinished = attempt !== null && !isFinishedAttempt(attempt);

  useEffect(() => {
    setScreenContext({
      pathname,
      back: { href: attemptResultsHref(attemptUuid), label: 'Back to your results' },
      actions: [],
    });
  }, [pathname, attemptUuid]);
  useEffect(() => () => clearScreenContext(), []);

  useEffect(() => {
    if (unfinished) router.replace(attemptHref(attemptUuid));
  }, [unfinished, router, attemptUuid]);

  const questions = useMemo(() => (attempt ? orderedQuestions(attempt) : []), [attempt]);

  if (query.isPending || unfinished) {
    return (
      <div className={RESULTS_COLUMN}>
        <AttemptAnswersSkeleton />
      </div>
    );
  }

  if (query.isError || !attempt) {
    const notFound = extractApiError(query.error).status === 404;
    return (
      <div className={LIST_COLUMN}>
        {notFound ? (
          <QuizMessage
            icon={SearchX}
            title="We couldn't find this attempt"
            description="It may belong to another account, or the link may be wrong."
          />
        ) : (
          <QuizErrorState
            title="Couldn't load your answers"
            description="Your answers are safe. The review just did not load. Please try again."
            onRetry={() => void query.refetch()}
          />
        )}
      </div>
    );
  }

  return (
    <div className={RESULTS_COLUMN}>
      {/* `useSearchParams` in the stepper reads `?q=` once; Next asks for a
          boundary around it. The skeleton is the same shape. */}
      <Suspense fallback={<AttemptAnswersSkeleton />}>
        <AnswersStepper attempt={attempt} questions={questions} />
      </Suspense>
    </div>
  );
}
