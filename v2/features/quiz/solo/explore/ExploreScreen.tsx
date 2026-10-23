'use client';

import { memo, useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { Compass } from 'lucide-react';

import type { ChannelQuiz } from '@/types/channel-quiz';
import { useV2Session } from '@/v2/runtime/session-context';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { QuizMessage } from '../../ui/QuizMessage';
import { QuizErrorState } from '../../ui/states';
import { QUIZ_CARD_GRID, QuizCard, QuizCardGridSkeleton } from '../QuizCard';
import { soloQuizQueries } from '../queries';

/**
 * ExploreList — the Quiz home's Explore tab (`/quiz`), every public quiz,
 * for anyone. It was the `/quiz/explore` page until the home became two tabs
 * (Stay, 23 October 2026: "tabs discover/explore and my quiz"); that address
 * now lands here.
 *
 * ── IT RENDERS SIGNED OUT, AND THAT IS THE POINT ───────────────────────────
 * `GET /channel-quizzes/explore` answers with no token (measured 21 October
 * 2026; `is_mine: false` on every row then), so the list is fetched
 * unconditionally: a visitor, a guest pass and an account all see the same
 * rows and open the same quiz fronts. Nothing here asks who the reader is
 * beyond the cache partition. The one door that needs an account — Start — is
 * on the quiz front, not here (Arthur's option B).
 *
 * The guest pass that follows a visitor's first paint re-renders the layout
 * under the guest's id, and the cache guard clears the cache on that edge, so
 * the list re-reads under the new key. `keepPreviousData` keeps the rows
 * already on screen while it does: the visitor sees one list, not rows, then
 * the skeleton, then the same rows (checker, 22 October 2026).
 *
 * ── THE SAME SMALL CARD, WITH ITS AUTHOR ───────────────────────────────────
 * The grid Stay picked (version C, 23 October 2026), the card My quizzes uses
 * (`QuizCard`) with one line more: who wrote it, which on this list is the
 * reason to open one. `creator` is nullable (an account that has gone), and
 * a missing author is a designed word, never a dereference.
 */
export function ExploreList() {
  const { userId: viewerId, signedIn } = useV2Session();

  const query = useInfiniteQuery({
    ...soloQuizQueries.explore({ viewerId }),
    // Across the visitor-to-guest key change (see the docblock).
    placeholderData: keepPreviousData,
  });

  const pages = query.data?.pages;
  const quizzes = useMemo<ChannelQuiz[]>(
    () => pages?.flatMap((page) => page.data) ?? [],
    [pages],
  );

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    // Not from the outgoing key's pages: the next page belongs to the new read.
    hasNextPage: query.hasNextPage && !query.isPlaceholderData,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  const showSkeleton = query.isPending;
  const showError = query.isError && quizzes.length === 0;
  const showEmpty = !showSkeleton && !showError && quizzes.length === 0;

  return (
    <>
      <ExploreLede />

      {/* The ONE live region for this tab — see the library. */}
      <span role="status" aria-live="polite" className="sr-only">
        {showSkeleton ? 'Loading quizzes' : ''}
      </span>

      {showSkeleton ? (
        <ExploreListSkeleton />
      ) : showError ? (
        <QuizErrorState
          title="Couldn't load the quizzes"
          description="Something went wrong on our side. Please try again."
          onRetry={() => void query.refetch()}
        />
      ) : showEmpty ? (
        <QuizMessage
          icon={Compass}
          title="No public quizzes yet"
          description="Quizzes that verified authors publish to everyone show up here. There is nothing to take just yet."
        />
      ) : (
        <>
          <ul className={QUIZ_CARD_GRID}>
            {quizzes.map((quiz, index) => (
              <ExploreCard key={quiz.uuid} quiz={quiz} index={index} signedIn={signedIn} />
            ))}
          </ul>

          <div ref={sentinelRef} className="pt-1">
            {query.isFetchingNextPage ? (
              <ExploreNextPageSkeleton />
            ) : !query.hasNextPage && quizzes.length > 5 ? (
              <p className="py-6 text-center text-xs text-muted-foreground/70">
                No more quizzes
              </p>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}

/** What the tab holds, in one line. Static chrome: the home's fallback draws it too. */
export function ExploreLede() {
  return (
    <p className="mb-3 text-sm text-muted-foreground">
      Public quizzes from verified authors. Open one to take it.
    </p>
  );
}

/** One public quiz, as a card with its author. `memo` because the list
 *  grows a page at a time. */
const ExploreCard = memo(function ExploreCard({
  quiz,
  index,
  signedIn,
}: {
  quiz: ChannelQuiz;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  signedIn: boolean;
}) {
  const author = quiz.is_mine ? 'You' : (quiz.creator?.name ?? 'Someone who has left');
  return <QuizCard quiz={quiz} index={index} signedIn={signedIn} author={author} />;
});

/** The initial-load skeleton, in the card grid's shape. It pulses in the
 *  route fallback too. */
export function ExploreListSkeleton() {
  return <QuizCardGridSkeleton author />;
}

function ExploreNextPageSkeleton() {
  return (
    <div className="pt-2.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <QuizCardGridSkeleton cards={4} author />
    </div>
  );
}
