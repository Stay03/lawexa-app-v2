'use client';

import { memo, useMemo } from 'react';
import Link from 'next/link';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { Compass } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChannelQuiz } from '@/types/channel-quiz';
import { MemberAvatar } from '@/v2/features/channels/ui/avatars';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { QuizMessage } from '../../ui/QuizMessage';
import { QuizErrorState } from '../../ui/states';
import { questionCountLabel, quizFrontHref } from '../model';
import { QuizTile } from '../QuizTile';
import { bestLabel, quizMinutesLabel, scenarioCountLabel } from '../rows-model';
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
 * ── ROWS ARE THE LIST GRAMMAR, WITH A FACE ─────────────────────────────────
 * Every public quiz is somebody's, so the row leads with the author's face
 * where the library row has a tile: on this list "who wrote it" is the
 * reason to open one. `creator` is nullable (an account that has gone), and a
 * missing author is a designed word, never a dereference.
 */
export function ExploreList() {
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
          {/* One card per quiz (picture 3, Stay, 23 October 2026): one
              column on a phone, two from `sm:` up. Three left a card too narrow
              for its size line, which wrapped onto a lone dot. */}
          <ul className="grid gap-3 sm:grid-cols-2">
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
  const scenarios = scenarioCountLabel(quiz.scenario_count);
  const minutes = quizMinutesLabel(quiz.total_seconds);
  const best = bestLabel(quiz.viewer_best_points);
  const author = quiz.is_mine ? 'You' : (quiz.creator?.name ?? 'Someone who has left');

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <Link
        href={quizFrontHref(quiz.uuid)}
        className={cn(
          'v2-interactive group flex h-full flex-col gap-3 rounded-2xl border-2 border-border bg-card p-3.5 shadow-[0_4px_0_var(--border)] transition-colors hover:border-primary/40',
          FOCUS_RING,
        )}
      >
        <span className="flex min-w-0 items-start gap-3">
          <QuizTile uuid={quiz.uuid} title={quiz.title} />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-[15px] leading-snug font-semibold text-foreground transition-colors group-hover:text-primary">
              {quiz.title}
            </span>
            {/* The size, never cut: the count, its scenarios, the minutes. */}
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              <span>{questionCountLabel(count)}</span>
              {scenarios ? <MetaDot>{scenarios}</MetaDot> : null}
              {minutes ? <MetaDot>{minutes}</MetaDot> : null}
            </span>
          </span>
        </span>
        {/* WHOSE, in full: on this list "who wrote it" is the reason to open
            one, so the name gets the line (it was cut to "Banner T…"). The
            reader's best sits at the other end once they have one. */}
        <span className="mt-auto flex min-w-0 items-center gap-2 text-xs">
          <MemberAvatar user={quiz.creator} className="size-5" />
          <span className="min-w-0 flex-1 truncate font-medium text-foreground/85">{author}</span>
          {best ? <span className="font-comfortaa shrink-0 font-bold text-primary">{best}</span> : null}
        </span>
      </Link>
    </li>
  );
});

/** A fact after the first on the size line, with its dot. */
function MetaDot({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      {children}
    </span>
  );
}

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
