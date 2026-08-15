'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { QuizSession } from '@/types/quiz';
import { useV2Session } from '@/v2/runtime/session-context';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { isVerificationBlocked, needsEmailVerification } from '../model';
import { quizQueries } from '../queries';
import { QuizMessage } from '../ui/QuizMessage';
import { SessionRow } from '../ui/SessionRow';
import {
  QuizErrorState,
  SessionListSkeleton,
  SessionNextPageSkeleton,
} from '../ui/states';
import { VerifyEmailState } from '../ui/VerifyEmailState';

/**
 * HistoryScreen — `/quiz/history`, every practice session this account has.
 *
 * The list is rendered in the ORDER THE SERVER RETURNS IT and the UI claims
 * nothing more: we have never observed a populated response, so "newest first"
 * would be a guess printed as a fact. Each row carries its own date, which is
 * what a reader actually needs to place it.
 *
 * ── THE SENTINEL IS ROOTED IN THE SHELL, NOT THE VIEWPORT ───────────────────
 * This list lives inside `.v2-shell__content`, the shell's ONE scroll
 * container. An IntersectionObserver with the default viewport root expands its
 * `rootMargin` against the viewport box while the nested scroller still clips
 * the target with its plain rect — so the prefetch band silently disappears and
 * the next page only loads at the exact bottom. `useShellScrollRoot` hands the
 * observer the real scroller, which is what makes the early load work.
 *
 * ── THE HEADING IS STATIC CHROME ────────────────────────────────────────────
 * Title, description and the "Practise" action wait on no request, so they
 * render for real on the first frame and the route fallback draws them for real
 * too (standards §8i). Only the ROWS are ever a skeleton.
 *
 * ── ROWS ARE THE SHARED COMPONENT ───────────────────────────────────────────
 * Exactly the same `SessionRow` the hub renders, so the two lists cannot drift
 * on what a session looks like or where it leads (active → resume, ended →
 * review).
 */
export function HistoryScreen() {
  const session = useV2Session();
  const { userId: viewerId } = session;

  useEffect(() => {
    setHeaderContext({ title: 'Quiz history', confidential: false });
    return () => clearHeaderContext();
  }, []);

  // Never send a request the snapshot already knows will 403 — see the hub.
  const snapshotUnverified = needsEmailVerification(session);

  const query = useInfiniteQuery({
    ...quizQueries.historyInfinite({ viewerId }),
    enabled: !snapshotUnverified,
  });

  const pages = query.data?.pages;
  const sessions = useMemo<QuizSession[]>(
    () => pages?.flatMap((page) => page.data) ?? [],
    [pages],
  );

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  const verificationBlocked =
    snapshotUnverified || isVerificationBlocked(query.error);

  const showSkeleton = query.isPending;
  const showError = query.isError && sessions.length === 0;
  const showEmpty = !showSkeleton && !showError && sessions.length === 0;

  return (
    <div className={LIST_COLUMN}>
      <HistoryHeading />

      {verificationBlocked ? (
        <VerifyEmailState />
      ) : showSkeleton ? (
        <SessionListSkeleton rows={6} />
      ) : showError ? (
        <QuizErrorState
          title="Couldn't load your history"
          description="Your past sessions are still there — the list just did not load."
          onRetry={() => void query.refetch()}
        />
      ) : showEmpty ? (
        <QuizMessage
          icon={History}
          title="No sessions yet"
          description="Once you have practised, every session shows up here with its score and the answers you can review."
          action={
            <Button asChild size="sm">
              <Link href="/quiz">Start practising</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border/60">
            {sessions.map((item, index) => (
              <SessionRow key={item.uuid} session={item} index={index} />
            ))}
          </ul>

          <div ref={sentinelRef} className="pt-1">
            {query.isFetchingNextPage ? (
              <SessionNextPageSkeleton />
            ) : !query.hasNextPage && sessions.length > 5 ? (
              <p className="py-6 text-center text-xs text-muted-foreground/70">
                No more sessions
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

/** Static chrome — identical in the live screen and in the route fallback. */
function HistoryHeading() {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Quiz history
        </h1>
        <p className="text-sm text-muted-foreground">
          Every practice session on this account.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/quiz/stats"
          className={cn(
            'v2-interactive inline-flex min-h-9 items-center rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            FOCUS_RING,
          )}
        >
          Your progress
        </Link>
        <Link
          href="/quiz"
          className={cn(
            'v2-interactive inline-flex min-h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
            FOCUS_RING,
          )}
        >
          Practise
        </Link>
      </div>
    </div>
  );
}

/**
 * The history route's fallback (`app/v2/quiz/history/loading.tsx`) — the SAME
 * heading, rendered for real, over the row skeleton. The heading waits on
 * nothing, so skeletoning it would be a lie that also delays it; the rows do
 * wait, and they pulse here exactly as they do in the live screen. This
 * boundary covers an RSC payload rather than a query, but the reader cannot
 * tell those apart, so the wait keeps one appearance throughout.
 */
export function HistoryFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your quiz history
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <HistoryHeading />
        <SessionListSkeleton rows={6} />
      </div>
    </>
  );
}
