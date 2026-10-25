'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';

import { extractApiError } from '@/lib/utils/api-error';
import { useScreenHold } from '@/v2/runtime/screen-hold';
import { useV2Session } from '@/v2/runtime/session-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { clearScreenContext, setScreenContext } from '@/v2/shell/screen-context';
import { QuizMessage } from '../../ui/QuizMessage';
import { QuizErrorState } from '../../ui/states';
import {
  attemptHref,
  attemptResultsHref,
  isFinishedAttempt,
  quizFrontHref,
} from '../model';
import { soloQuizQueries } from '../queries';
import { AttemptResultsSkeleton, RESULTS_COLUMN } from '../results/states';
import { AttemptPlay } from './AttemptPlay';
import { AttemptPlayerSkeleton, SOLO_PLAY_COLUMN } from './states';

/**
 * AttemptPlayerScreen — `/quiz/attempts/{uuid}`: reads the attempt and hands
 * it to the play loop, or sends a finished one to its results.
 *
 * ── THE READ IS THE RESUME ─────────────────────────────────────────────────
 * `GET /channel-quiz-attempts/{a}` carries every answer so far, so a reload,
 * a second device or a link from history lands on the first unanswered
 * question with the score so far intact (`AttemptPlay` opens there). The
 * entry is on the live tier and the Start that created it seeded it, so the
 * common arrival — from the quiz front — paints with no request at all.
 *
 * ── A FINISHED ATTEMPT IS A ROUTE, NOT A STATE ─────────────────────────────
 * `finished_at` set means the only honest screen is the results, so this one
 * `replace`s into it and keeps its skeleton up meanwhile: the play URL was
 * never a place to stay once the score exists, and it must not sit in Back
 * history between the reader and the results.
 *
 * ── THE WAY BACK IS THE QUIZ, ONCE THE ATTEMPT SAYS WHICH ──────────────────
 * The address knows no quiz (`/quiz/attempts/{uuid}`), so the hub stands as
 * the default until the attempt lands, and the screen then overrides the bar's
 * chevron with the quiz's own front (`screen-context`). Leaving mid-attempt is
 * allowed and loses nothing: the attempt resumes from this address.
 */
export function AttemptPlayerScreen({ attemptUuid }: { attemptUuid: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? attemptHref(attemptUuid);
  const { userId: viewerId } = useV2Session();

  const query = useQuery(soloQuizQueries.attempt(attemptUuid, { viewerId }));
  const attempt = query.data?.data ?? null;
  // While the attempt loads, nothing pops up over the quiz about to start;
  // AttemptPlay holds while it is played (screen-hold.ts).
  useScreenHold(query.isPending);
  const finished = attempt !== null && isFinishedAttempt(attempt);
  const quizUuid = attempt?.quiz.uuid ?? null;

  useEffect(() => {
    setScreenContext({
      pathname,
      back: quizUuid ? { href: quizFrontHref(quizUuid), label: 'Back to the quiz' } : null,
      actions: [],
    });
  }, [pathname, quizUuid]);
  useEffect(() => () => clearScreenContext(), []);

  useEffect(() => {
    if (finished) router.replace(attemptResultsHref(attemptUuid));
  }, [finished, router, attemptUuid]);

  if (query.isPending) {
    return (
      <div className={SOLO_PLAY_COLUMN}>
        <AttemptPlayerSkeleton />
      </div>
    );
  }

  // On the way to the results: their shape, so the redirect reads as a
  // continuation of the wait rather than a flash of a question that is not
  // coming.
  if (finished) {
    return (
      <div className={RESULTS_COLUMN}>
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
            title="Couldn't load this attempt"
            description="Your answers so far are safe. The question just did not load. Please try again."
            onRetry={() => void query.refetch()}
          />
        )}
      </div>
    );
  }

  return <AttemptPlay attempt={attempt} viewerId={viewerId} />;
}
