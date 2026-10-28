'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  attemptHighlights,
  attemptHref,
  attemptResultsHref,
  attemptScore,
  challengeText,
  isFinishedAttempt,
  orderedQuestions,
  quizFrontHref,
} from '../model';
import { isViewerEntry } from '../home-model';
import { useStartAttempt } from '../mutations';
import { soloQuizQueries } from '../queries';
import { prefersReducedMotion } from '../ui';
import { AnswersFold } from './AnswersFold';
import { AttemptSummary } from './AttemptSummary';
import { FinishPosition } from './FinishPosition';
import { ResultsActions } from './ResultsActions';
import { AttemptResultsSkeleton, RESULTS_COLUMN } from './states';
import { PodiumStage, podiumAlreadySeen, rememberPodiumSeen } from './PodiumStage';
import { glideTop, opensOnPodium, SCORE_GLIDE_MS } from './position-model';
import '../solo-quiz.css';

/**
 * AttemptResultsScreen — `/quiz/attempts/{uuid}/results`, the review of a
 * finished attempt in design B1: the greeting, the points, one row of
 * stats and the comparison line; See your answers, folded; Take it again
 * and Challenge a friend at the bottom.
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
 * could not be read rather than printing a guess. The streak and the
 * fastest answer are read off the server's per-question verdicts and
 * times; the comparison line is the server's own block. Nothing here adds
 * up points from the questions to fill a gap.
 *
 * ── RETAKE STARTS A NEW ATTEMPT WITH THE SAME REVEAL CHOICE ────────────────
 * An attempt is one-way once scored; "again" is a fresh one on the same quiz,
 * the way the reader took this one, straight into the player. Challenge a
 * friend hands on the quiz's own link with the score, and only where a link
 * can open it: the quiz's visibility is read from its detail, which the
 * reader's visit to the front has almost always cached.
 *
 * Under the fold, the reader's place on the board (`FinishPosition`). A
 * top-three finish opens on the podium first, full screen, laid over these
 * results (`PodiumStage`), which moves on to them by itself.
 */
/**
 * Glides the page that holds the results back up to their top, over
 * `SCORE_GLIDE_MS` with an ease-out (`glideTop`), so the score comes into
 * view. The page scrolls inside the shell, so it is the nearest scrolled
 * ancestor of the heading that moves; nothing scrolled, nothing moves.
 */
function glideToScore(heading: HTMLElement): void {
  let page: HTMLElement | null = heading.parentElement;
  while (page && page.scrollTop === 0) page = page.parentElement;
  const scroller = page ?? (document.scrollingElement as HTMLElement | null);
  if (!scroller || scroller.scrollTop === 0) return;
  const startTop = scroller.scrollTop;
  const start = performance.now();
  const step = (now: number) => {
    const elapsed = now - start;
    scroller.scrollTop = glideTop(startTop, elapsed);
    if (elapsed < SCORE_GLIDE_MS) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
}

export function AttemptResultsScreen({ attemptUuid }: { attemptUuid: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? attemptResultsHref(attemptUuid);
  const { userId: viewerId, name: viewerName } = useV2Session();

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
  // For the place block, a detail that fails to load reads as not public: it
  // then leaves the space as it was, never a skeleton that stays.
  const shareable = visibility === 'link' || visibility === 'public';
  const publicQuiz = detailQuery.isError ? false : visibility === null ? null : visibility === 'public';

  // The board decides whether the results open on the podium; the place
  // block below reads the same entry, so this costs no second read.
  const boardQuery = useQuery({
    ...soloQuizQueries.leaderboard(quizUuid ?? '', { viewerId }),
    enabled: quizUuid !== null && publicQuiz === true,
  });
  /** The podium has been shown (or never will be: reduced motion). */
  const [podiumDone, setPodiumDone] = useState(() => prefersReducedMotion() || podiumAlreadySeen(attemptUuid));
  const finishPodium = useCallback(() => {
    rememberPodiumSeen(attemptUuid);
    setPodiumDone(true);
    window.requestAnimationFrame(() => {
      const heading = document.getElementById('attempt-results-heading');
      // Back to the results it covered, from their heading.
      heading?.focus({ preventScroll: true });
      // On a phone the podium landed below the fold: the page glides back up to
      // the score (Arthur's option B). On a computer nothing is scrolled.
      if (heading) glideToScore(heading);
    });
  }, [attemptUuid]);

  const startAttempt = useStartAttempt(quizUuid ?? '', viewerId);
  /** A refusal of Retake, said over the buttons — this surface has no toasts. */
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
            title="Couldn't load your results"
            description="Your answers are safe. The review just did not load. Please try again."
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

  // A top-three finish opens on the podium, full screen, before the score
  // (Arthur, 28 October 2026). Until the board says whether it is one, the
  // results keep their skeleton, so nothing swaps under the reader. A board
  // that fails to load goes straight to the results.
  if (!podiumDone && (publicQuiz === null || (publicQuiz && boardQuery.isPending))) {
    return (
      <div className={RESULTS_COLUMN}>
        <AttemptResultsSkeleton />
      </div>
    );
  }
  const board = boardQuery.data?.data ?? null;
  const podiumFirst = !podiumDone && board !== null && opensOnPodium(board, score.points);

  const highlights = attemptHighlights(score, questions);

  const retake = () => {
    setRetakeError(null);
    startAttempt.mutate(attempt.reveal_mode, {
      onSuccess: (response) => router.push(attemptHref(response.data.uuid)),
      onError: (error) => setRetakeError(extractApiError(error).message),
    });
  };

  return (
    <>
      {/* The podium first, as one full-screen layer over the results, which
          sit still (and out of reach) underneath until it moves on. */}
      {podiumFirst && board ? (
        <PodiumStage
          entries={board.entries.slice(0, 3)}
          isYou={(entry) => isViewerEntry(board.viewer, entry)}
          onDone={finishPodium}
        />
      ) : null}
      <div className={RESULTS_COLUMN} inert={podiumFirst}>
        <AttemptSummary
          attempt={attempt}
          score={score}
          highlights={highlights}
          viewerName={viewerName}
        />

        <AnswersFold attemptUuid={attempt.uuid} questions={questions} />

        <FinishPosition
          quizUuid={attempt.quiz.uuid}
          runPoints={score.points}
          publicQuiz={publicQuiz}
          viewerId={viewerId}
          podiumPlayed={podiumFirst || podiumDone}
          podiumCovered={podiumFirst}
        />

        {retakeError && (
          <p
            role="alert"
            className="mt-4 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {retakeError}
          </p>
        )}

        <ResultsActions
          quizUuid={attempt.quiz.uuid}
          quizTitle={attempt.quiz.title}
          challenge={challengeText(viewerName, score.points, attempt.quiz.title, highlights)}
          shareable={shareable}
          privateQuiz={visibility === 'private'}
          retaking={startAttempt.isPending}
          onRetake={retake}
        />
      </div>
    </>
  );
}
