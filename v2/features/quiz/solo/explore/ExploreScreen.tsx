'use client';

import { memo, useMemo } from 'react';
import Link from 'next/link';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight, Compass } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDayLabel } from '@/lib/utils/collab';
import type { ChannelQuiz } from '@/types/channel-quiz';
import { MemberAvatar } from '@/v2/features/channels/ui/avatars';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { QuizMessage } from '../../ui/QuizMessage';
import { QuizErrorState } from '../../ui/states';
import { questionCountLabel, quizFrontHref } from '../model';
import { soloQuizQueries } from '../queries';

/**
 * ExploreScreen — `/quiz/explore`, every public quiz, for anyone.
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
 * ── ROWS ARE THE LIST GRAMMAR, WITH A FACE ─────────────────────────────────
 * Every public quiz is somebody's, so the row leads with the author's face
 * where the library row has a tile: on this list "who wrote it" is the
 * reason to open one. `creator` is nullable (an account that has gone), and a
 * missing author is a designed word, never a dereference.
 */
export function ExploreScreen() {
  const { userId: viewerId } = useV2Session();

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
    <div className={LIST_COLUMN}>
      <ExploreHeading />

      {/* The ONE live region for this surface — see the library. */}
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
          <ul className="flex flex-col divide-y divide-border/60">
            {quizzes.map((quiz, index) => (
              <ExploreRow key={quiz.uuid} quiz={quiz} index={index} />
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
    </div>
  );
}

/** Static chrome — identical in the live screen and in the route fallback. */
function ExploreHeading() {
  return (
    <div className="mb-3 space-y-1">
      {/* ONE TITLE PER SCREEN, AT EVERY WIDTH: the bar carries "Explore
          quizzes" below `md:` (`pushed-route.ts`). */}
      <h1 className="sr-only md:not-sr-only md:text-xl md:font-semibold md:tracking-tight md:text-foreground">
        Explore quizzes
      </h1>
      <p className="text-sm text-muted-foreground">
        Public quizzes from verified authors. Open one to take it.
      </p>
    </div>
  );
}

/** One public quiz: the author's face, the title, a line of description, and
 *  what it is. `memo` because the list grows a page at a time. */
const ExploreRow = memo(function ExploreRow({
  quiz,
  index,
}: {
  quiz: ChannelQuiz;
  /** Staggers the entrance for the first screenful only. */
  index: number;
}) {
  const count = quiz.question_count ?? quiz.questions?.length ?? 0;

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <Link
        href={quizFrontHref(quiz.uuid)}
        className={cn(
          'v2-interactive group flex min-h-11 items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/50',
          FOCUS_RING,
        )}
      >
        <MemberAvatar user={quiz.creator} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[15px] font-medium text-foreground transition-colors group-hover:text-primary sm:line-clamp-1">
            {quiz.title}
          </span>
          {quiz.description && (
            <span className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {quiz.description}
            </span>
          )}
          <span className="mt-1 flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground">
            {/* LEAD — whose, and how long. The name truncates; the count never
                gives, it is the fact that says what the quiz is. */}
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="min-w-0 truncate">
                {quiz.is_mine ? 'you' : (quiz.creator?.name ?? 'Someone who has left')}
              </span>
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <span className="shrink-0">{questionCountLabel(count)}</span>
            </span>
            {/* TRAIL — when it was written, right-anchored. */}
            <span className="shrink-0 tabular-nums">
              {formatDayLabel(quiz.created_at)}
            </span>
          </span>
        </span>
        <ChevronRight
          aria-hidden
          className="mt-2.5 size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </li>
  );
});

/** One skeleton row at `ExploreRow`'s geometry: a face, three text lines. */
function ExploreRowSkeleton() {
  return (
    <div className="flex min-h-11 items-start gap-3 px-2 py-3">
      <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-3/5 rounded" />
        <Skeleton className="h-3.5 w-4/5 rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-2/5 rounded" />
          <Skeleton className="ml-auto h-3 w-12 shrink-0 rounded" />
        </div>
      </div>
    </div>
  );
}

/** The initial-load skeleton, in the shared v2 list fade. It pulses in the
 *  route fallback too. */
export function ExploreListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.16) }}>
          <ExploreRowSkeleton />
        </div>
      ))}
    </div>
  );
}

function ExploreNextPageSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <ExploreRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <ExploreRowSkeleton />
      </div>
    </div>
  );
}

/**
 * The explore route's fallback (`app/v2/quiz/explore/loading.tsx`): the SAME
 * heading, drawn for real, over the row skeleton, so route boundary → live
 * list is one continuous shape.
 */
export function ExploreFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading quizzes
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <ExploreHeading />
        <ExploreListSkeleton />
      </div>
    </>
  );
}
