'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { Compass, SearchX } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ChannelQuiz } from '@/types/channel-quiz';
import { useV2Session } from '@/v2/runtime/session-context';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { useUrlSearch } from '@/v2/runtime/use-url-search';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { QuizFilters } from '../../home/QuizFilters';
import { QuizMessage } from '../../ui/QuizMessage';
import { QuizErrorState } from '../../ui/states';
import { hasFilterChoice, NO_QUIZ_FILTERS, parseQuizListFilters } from '../home-model';
import { EXPLORE_CARD_GRID, ExploreQuizCard, ExploreQuizCardGridSkeleton } from './ExploreQuizCard';
import '../solo-quiz.css';
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
 * ── THE SAME SMALL CARD, WITH ITS AUTHOR AND ITS BOARD ─────────────────────
 * The grid Stay picked (version C, 23 October 2026), the card My quizzes uses
 * (`QuizCard`), with what Arthur's quiz home redesign (25 October 2026) asks
 * of an Explore card: who wrote it, with the verified tick; its topic, level
 * and year; how many have played; the score to beat and, apart from it, the
 * reader's own best and rank; and a Take quiz. `creator` is nullable (an
 * account that has gone), and a missing author is a designed word, never a
 * dereference. A quiz someone has finished has a leaderboard button in the
 * card's corner, which opens the full board over the list.
 *
 * ── SEARCH AND FILTERS ─────────────────────────────────────────────────────
 * `QuizFilters`, in the address (`?search=&topic=&level=&year=`). A filtered
 * list keeps the rows on screen, dimmed, while the next one is read, and a
 * filter that leaves nothing says so with a way back.
 */
export function ExploreList() {
  const { userId: viewerId } = useV2Session();
  const search = useUrlSearch('search');
  const filters = parseQuizListFilters(useSearchParams());

  const query = useInfiniteQuery({
    ...soloQuizQueries.explore({ viewerId }, filters),
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
  const narrowed = Boolean(filters.search) || hasFilterChoice(filters);

  return (
    <>
      <ExploreLede />
      <QuizFilters search={search} filters={filters} options={pages?.[0]?.filters} />

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
      ) : showEmpty && narrowed ? (
        <QuizMessage
          icon={SearchX}
          title="No quizzes match"
          description="Try other words, or clear the filters to see every public quiz."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                search.onClear();
                replaceUrlParams(NO_QUIZ_FILTERS);
              }}
            >
              Clear search and filters
            </Button>
          }
        />
      ) : showEmpty ? (
        <QuizMessage
          icon={Compass}
          title="No public quizzes yet"
          description="Quizzes that verified authors publish to everyone show up here. There is nothing to take just yet."
        />
      ) : (
        <>
          <ul
            className={cn(
              EXPLORE_CARD_GRID,
              'transition-opacity duration-150',
              query.isPlaceholderData && 'opacity-60',
            )}
          >
            {quizzes.map((quiz) => (
              <ExploreQuizCard key={quiz.uuid} quiz={quiz} />
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

/** What the tab holds, in one line (Arthur, 25 October 2026). Static chrome:
 *  the home's fallback draws it too. */
export function ExploreLede() {
  return (
    <p className="mb-3 text-sm text-muted-foreground">
      Test your knowledge, learn something new and track your progress.
    </p>
  );
}

/** The initial-load skeleton, in the card grid's shape. It pulses in the
 *  route fallback too. */
export function ExploreListSkeleton() {
  return <ExploreQuizCardGridSkeleton />;
}

function ExploreNextPageSkeleton() {
  return (
    <div className="pt-2.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <ExploreQuizCardGridSkeleton cards={3} />
    </div>
  );
}
