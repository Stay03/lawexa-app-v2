'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { RadarListItem, RadarStatus } from '@/types/radar';
import { useV2Session } from '@/v2/runtime/session-context';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { radarsQueries } from '../queries';
import { RadarTabs, type RadarTab } from '../RadarTabs';
import { RadarRow } from './RadarRow';
import {
  RadarListSkeleton,
  RadarNextPageSkeleton,
  RadarsEmptyState,
  RadarsErrorState,
  RadarsFirstRunState,
  RadarsGuestState,
  RadarsSignedOutState,
} from './states';

/**
 * RadarsBrowser — the `/radars` body, and the `useSearchParams` consumer (so
 * it lives under the Suspense boundary in `RadarsScreen`).
 *
 * ── THE URL IS THE STATE ────────────────────────────────────────────────────
 * The status tab lives in `?status=` (absent = Active), written with the
 * LOUD native-history write (`replaceUrlParams`) exactly like the cases list's
 * view tabs: `/radars` is a static segment, the server page reads no
 * `searchParams`, and each tab is a shareable URL that Back restores. (The
 * radar DETAIL page writes its URL state QUIETLY instead — it sits under a
 * dynamic `[radarUuid]` segment where loud writes trip the Next-16 restore
 * walk; see `url-params.ts` and the detail screen's docblock.)
 *
 * ── WHO CAN READ THIS ───────────────────────────────────────────────────────
 * Radar is an ACCOUNT feature: v1 gates every radar query on a real signed-in
 * user (guests excluded — scans debit plan AI messages a guest doesn't have).
 * The v2 gate is the same fact expressed through the session context, with a
 * designed state per audience instead of a 401 → error screen.
 */

const STATUS_TABS: readonly RadarTab<RadarStatus>[] = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'archived', label: 'Archived' },
];

const PANEL_ID = 'radars-list-panel';

/** Stable empty-rows reference — a fresh `[]` per render would churn the memo. */
const NO_RADARS: readonly RadarListItem[] = [];

function parseStatus(raw: string | null): RadarStatus {
  return raw === 'paused' || raw === 'archived' ? raw : 'active';
}

export function RadarsBrowser() {
  const { signedIn, userId: viewerId, role } = useV2Session();
  const searchParams = useSearchParams();
  const status = parseStatus(searchParams.get('status'));
  const canUseRadar = signedIn && role !== 'guest';

  // Frozen at mount for the relative-time labels — the list refetches on
  // every visit (`REFETCH_ON_VISIT`), so the clock and the data move together.
  const [now] = useState(() => Date.now());

  const query = useInfiniteQuery({
    ...radarsQueries.infiniteList({ status, viewerId }),
    enabled: canUseRadar,
  });

  const pages = query.data?.pages;
  const radars = useMemo<readonly RadarListItem[]>(
    () => pages?.flatMap((page) => page.data) ?? NO_RADARS,
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

  const setStatus = (next: RadarStatus) => {
    replaceUrlParams({ status: next === 'active' ? null : next });
  };

  if (!signedIn) {
    return (
      <div className={LIST_COLUMN}>
        <RadarsSignedOutState />
      </div>
    );
  }
  if (!canUseRadar) {
    return (
      <div className={LIST_COLUMN}>
        <RadarsGuestState />
      </div>
    );
  }

  const showSkeleton = query.isPending;
  const showError = query.isError && radars.length === 0;
  const showEmpty = !showSkeleton && !showError && radars.length === 0;

  return (
    <div className={LIST_COLUMN}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <RadarTabs
          tabs={STATUS_TABS}
          value={status}
          onChange={setStatus}
          ariaLabel="Filter radars by status"
          panelId={PANEL_ID}
        />
        <Link
          href="/radars/new"
          className={cn(
            'v2-interactive inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
            FOCUS_RING,
          )}
        >
          <Plus aria-hidden className="size-4" />
          New radar
        </Link>
      </div>

      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={`${PANEL_ID}-tab-${status}`}
      >
        {showSkeleton ? (
          <RadarListSkeleton />
        ) : showError ? (
          <RadarsErrorState onRetry={() => void query.refetch()} />
        ) : showEmpty ? (
          status === 'active' ? (
            <RadarsFirstRunState />
          ) : (
            <RadarsEmptyState status={status} />
          )
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border/60">
              {radars.map((radar, index) => (
                <RadarRow
                  key={radar.uuid}
                  radar={radar}
                  index={index}
                  now={now}
                />
              ))}
            </ul>

            <div ref={sentinelRef} className="pt-1">
              {query.isFetchingNextPage ? (
                <RadarNextPageSkeleton />
              ) : !query.hasNextPage && radars.length > 5 ? (
                <p className="py-6 text-center text-xs text-muted-foreground/70">
                  No more radars
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
