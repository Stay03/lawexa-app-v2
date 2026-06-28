'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, History, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInfiniteQuizSessions } from '@/lib/hooks/useQuiz';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import { extractApiError } from '@/lib/utils/api-error';
import { QuizHistoryItem } from './QuizHistoryItem';
import { QuizHistorySkeleton } from './QuizHistorySkeleton';
import { QuizMessage } from './QuizMessage';

/** Paginated list of the user's past quiz sessions (infinite scroll). */
export function QuizHistory() {
  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver();
  const query = useInfiniteQuizSessions({ per_page: 15 });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Auto-fetch the next page when the sentinel scrolls into view.
  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const sessions = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Quiz history</h1>
          <p className="text-sm text-muted-foreground">
            Your past practice sessions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/quiz/stats">
              <BarChart3 className="h-4 w-4" />
              Stats
            </Link>
          </Button>
          <Button asChild>
            <Link href="/quiz">
              <Play className="h-4 w-4" />
              Practice
            </Link>
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <QuizHistorySkeleton />
      ) : query.isError ? (
        <QuizMessage
          icon={<History className="h-7 w-7" />}
          title="We couldn't load your history"
          description={extractApiError(query.error).message}
          action={<Button onClick={() => query.refetch()}>Try again</Button>}
        />
      ) : sessions.length === 0 ? (
        <QuizMessage
          icon={<History className="h-7 w-7" />}
          title="No sessions yet"
          description="Once you start practising, your past sessions show up here."
          action={
            <Button asChild>
              <Link href="/quiz">Start practising</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {sessions.map((session) => (
              <QuizHistoryItem key={session.uuid} session={session} />
            ))}
          </div>
          {/* Infinite-scroll sentinel */}
          <div ref={loadMoreRef} aria-hidden className="h-1" />
          {query.isFetchingNextPage && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
