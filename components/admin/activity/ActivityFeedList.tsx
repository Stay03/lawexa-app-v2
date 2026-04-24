'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityFeedRow } from './ActivityFeedRow';
import type { ActivityFeedResponse, ActivityFeedRow as Row } from '@/types/admin-activity';

interface ActivityFeedListProps {
  pages: ActivityFeedResponse[] | undefined;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean | undefined;
  onLoadMore: () => void;
  error: Error | null;
  topSentinelRef?: React.Ref<HTMLDivElement>;
}

export function ActivityFeedList({
  pages,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  error,
  topSentinelRef,
}: ActivityFeedListProps) {
  const rows = useMemo<Row[]>(() => {
    if (!pages) return [];
    const seen = new Set<number>();
    const out: Row[] = [];
    for (const page of pages) {
      for (const row of page.data) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row);
      }
    }
    return out;
  }, [pages]);

  if (isLoading && !rows.length) {
    return (
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
        Failed to load activity. Please try again.
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
        No activity matches the current filters.
      </div>
    );
  }

  return (
    <div>
      <div ref={topSentinelRef} aria-hidden className="h-px w-full" />
      <div className="divide-y">
        {rows.map((row) => (
          <ActivityFeedRow key={row.id} row={row} />
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
      {!hasNextPage && rows.length > 10 && (
        <div className="pt-4 text-center text-xs text-muted-foreground">
          End of feed
        </div>
      )}
    </div>
  );
}
