'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { useV2Session } from '@/v2/runtime/session-context';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import {
  errorStatus,
  isVerificationBlocked,
  meanAnswerTimeMs,
  needsEmailVerification,
} from '../model';
import { quizQueries } from '../queries';
import { QuizErrorState } from '../ui/states';
import { VerifyEmailState } from '../ui/VerifyEmailState';
import { ResultsBreakdown } from './ResultsBreakdown';
import { ResultsSummary } from './ResultsSummary';
import { ReviewStepper } from './ReviewStepper';
import {
  NoAnswersState,
  ResultsSkeleton,
  ReviewStepperSkeleton,
} from './states';

/**
 * ResultsScreen — `/quiz/[sessionUuid]/results`, the review.
 *
 * ── 409 IS A ROUTE, NOT AN ERROR ────────────────────────────────────────────
 * `GET /results` answers 409 until the session is actually ended (verified
 * live: "End the session to see its results."). That is not a failure — it
 * means the reader is looking at the wrong half of their own session — so the
 * screen sends them BACK to the player and keeps the skeleton up while it
 * happens, instead of flashing an error they would have to read and dismiss.
 * `replace`, not `push`: the results URL was never a place they chose to be, so
 * it must not sit in the Back history between them and where they came from.
 *
 * ── THE SUMMARY SURVIVES AN EMPTY REVIEW ────────────────────────────────────
 * A session that ended without answering anything still has a real story — when
 * it ran, how long it lasted — so the headline card renders and only the review
 * below it is replaced by a designed "nothing to review" state. Returning an
 * error, or nothing, for a session that genuinely happened would be the lie.
 *
 * ── SIZE THE REVIEW BY WHAT CAME BACK ───────────────────────────────────────
 * The backend excludes a trailing UNANSWERED serve from `/results`, so
 * `served_count` overstates the review by one on almost every session
 * (confirmed live: served 2, answered 1). Everything here counts
 * `questions.length` / `answered_count` and never `served_count`.
 */
export function ResultsScreen({ sessionUuid }: { sessionUuid: string }) {
  const router = useRouter();
  const session = useV2Session();
  const { userId: viewerId } = session;

  useEffect(() => {
    setHeaderContext({ title: 'Session results', confidential: false });
    return () => clearHeaderContext();
  }, []);

  // Never send a request the snapshot already knows will 403 — see the hub.
  const snapshotUnverified = needsEmailVerification(session);

  const resultsQuery = useQuery({
    ...quizQueries.results(sessionUuid, { viewerId }),
    enabled: !snapshotUnverified,
  });
  const status = errorStatus(resultsQuery.error);
  const stillActive = status === 409;

  useEffect(() => {
    if (stillActive) router.replace(`/quiz/${sessionUuid}`);
  }, [stillActive, router, sessionUuid]);

  if (snapshotUnverified || isVerificationBlocked(resultsQuery.error)) {
    return (
      <div className={LIST_COLUMN}>
        <VerifyEmailState />
      </div>
    );
  }

  // Pending, or on the way back to the player — the same shape either way, so
  // the redirect reads as a continuation rather than a flash of something else.
  if (resultsQuery.isPending || stillActive) {
    return (
      <div className={LIST_COLUMN}>
        <ResultsSkeleton />
      </div>
    );
  }

  if (resultsQuery.isError || !resultsQuery.data) {
    const notFound = status === 404;
    return (
      <div className={LIST_COLUMN}>
        <QuizErrorState
          title={notFound ? "We couldn't find this session" : "Couldn't load your answers"}
          description={
            notFound
              ? 'The link may be wrong, or the session may belong to another account.'
              : 'Your answers are safe — the review just did not load. Please try again.'
          }
          onRetry={() => void resultsQuery.refetch()}
        />
      </div>
    );
  }

  const { session: quizSession, questions } = resultsQuery.data.data;

  return (
    <div className={LIST_COLUMN}>
      <div className="flex flex-col gap-5">
        <ResultsSummary
          session={quizSession}
          meanTimeMs={meanAnswerTimeMs(questions)}
        />

        {questions.length > 0 ? (
          <>
            <ResultsBreakdown questions={questions} />
            {/* The boundary Next requires around a `useSearchParams()` consumer
                — the stepper reads `?q=` for its opening question. The fallback
                draws the same three blocks, so resolving it moves nothing. */}
            <Suspense fallback={<ReviewStepperSkeleton />}>
              <ReviewStepper questions={questions} />
            </Suspense>
          </>
        ) : (
          <NoAnswersState />
        )}
      </div>
    </div>
  );
}
