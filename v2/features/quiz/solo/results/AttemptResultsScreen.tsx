'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';

import { extractApiError } from '@/lib/utils/api-error';
import { channelQuizQueries } from '@/v2/features/channels/quiz/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { clearScreenContext, setScreenContext } from '@/v2/shell/screen-context';
import { QuizMessage } from '../../ui/QuizMessage';
import { QuizErrorState } from '../../ui/states';
import {
  attemptHref,
  attemptResultsHref,
  attemptScore,
  isFinishedAttempt,
  orderedQuestions,
  quizFrontHref,
} from '../model';
import { useStartAttempt } from '../mutations';
import { soloQuizQueries } from '../queries';
import { AttemptQuestionCard } from './AttemptQuestionCard';
import { AttemptSummary } from './AttemptSummary';
import { AttemptResultsSkeleton } from './states';

/**
 * AttemptResultsScreen — `/quiz/attempts/{uuid}/results`, the review of a
 * finished attempt: the score, the points, the speed, and every question
 * with its answer revealed.
 *
 * ── AN UNFINISHED ATTEMPT IS A ROUTE, NOT AN ERROR ─────────────────────────
 * `finished_at` null means the reader is looking at the wrong half of their
 * own attempt, so the screen sends them BACK to the player and keeps the
 * skeleton up while it happens (the practice review's rule for its 409).
 * `replace`, not `push`: the results URL was never a place they chose to be.
 *
 * ── THE SCORE IS THE SERVER'S, OR NOTHING ──────────────────────────────────
 * `attemptScore` reads the five score fields a finished body carries and
 * returns `null` for a body without them; the screen then says the score
 * could not be read rather than printing a guess. Nothing here adds up
 * points from the questions to fill a gap.
 *
 * ── RETAKE STARTS A NEW ATTEMPT WITH THE SAME REVEAL CHOICE ────────────────
 * An attempt is one-way once scored; "again" is a fresh one on the same quiz,
 * the way the reader took this one, straight into the player. Share hands on
 * the quiz's own link, and only where a link can open it: the quiz's
 * visibility is read from its detail, which the reader's visit to the front
 * has almost always cached.
 */
export function AttemptResultsScreen({ attemptUuid }: { attemptUuid: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? attemptResultsHref(attemptUuid);
  const { userId: viewerId } = useV2Session();

  const query = useQuery(soloQuizQueries.attempt(attemptUuid, { viewerId }));
  const attempt = query.data?.data ?? null;
  const finished = attempt !== null && isFinishedAttempt(attempt);
  const unfinished = attempt !== null && !finished;
  const quizUuid = attempt?.quiz.uuid ?? null;

  const detailQuery = useQuery({
    ...channelQuizQueries.quizDetail(quizUuid ?? '', { viewerId }),
    enabled: quizUuid !== null,
  });
  const visibility = detailQuery.data?.data.visibility ?? null;
  const shareable = visibility === 'link' || visibility === 'public';

  const startAttempt = useStartAttempt(quizUuid ?? '', viewerId);
  /** A refusal of Retake, said under the card — this surface has no toasts. */
  const [retakeError, setRetakeError] = useState<string | null>(null);

  useEffect(() => {
    setScreenContext({
      pathname,
      back: quizUuid ? { href: quizFrontHref(quizUuid), label: 'Back to the quiz' } : null,
      actions: [],
    });
  }, [pathname, quizUuid]);
  useEffect(() => () => clearScreenContext(), []);

  useEffect(() => {
    if (unfinished) router.replace(attemptHref(attemptUuid));
  }, [unfinished, router, attemptUuid]);

  const questions = useMemo(() => (attempt ? orderedQuestions(attempt) : []), [attempt]);
  const score = attempt ? attemptScore(attempt) : null;

  // Pending, or on the way back to the player — the same shape either way.
  if (query.isPending || unfinished) {
    return (
      <div className={LIST_COLUMN}>
        <AttemptResultsSkeleton />
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
            title="Couldn't load your results"
            description="Your answers are safe — the review just did not load. Please try again."
            onRetry={() => void query.refetch()}
          />
        )}
      </div>
    );
  }

  if (!score) {
    return (
      <div className={LIST_COLUMN}>
        <QuizErrorState
          title="Couldn't read the score"
          description="The attempt is finished, but its score did not arrive. Please try again."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const retake = () => {
    setRetakeError(null);
    startAttempt.mutate(attempt.reveal_mode, {
      onSuccess: (response) => router.push(attemptHref(response.data.uuid)),
      onError: (error) => setRetakeError(extractApiError(error).message),
    });
  };

  return (
    <div className={LIST_COLUMN}>
      <div className="flex flex-col gap-5">
        <AttemptSummary
          attempt={attempt}
          score={score}
          shareable={shareable}
          retaking={startAttempt.isPending}
          onRetake={retake}
        />

        {retakeError && (
          <p
            role="alert"
            className="text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {retakeError}
          </p>
        )}

        <section aria-labelledby="attempt-review-heading" className="flex flex-col gap-4">
          <h2 id="attempt-review-heading" className="text-xs font-medium text-muted-foreground">
            Your answers
          </h2>
          <ol className="flex flex-col gap-4">
            {questions.map((question, index) => (
              <li
                key={question.uuid}
                className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <AttemptQuestionCard question={question} index={index} />
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
