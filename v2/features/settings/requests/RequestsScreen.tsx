'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Inbox, LogIn, Plus, RotateCw, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { ContentRequest } from '@/types/content-request';
import { useV2Session } from '@/v2/runtime/session-context';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { SETTINGS_BLOCK, SETTINGS_COLUMN } from '../SettingsList';
import { SettingsState } from '../SettingsState';
import { contentHref, flattenRequests, formatDay, openContentLabel, requestHref, typeWord } from './model';
import { NewRequestPanel } from './NewRequestPanel';
import { requestsQueries } from './queries';
import { RequestStatusPill, RequestTypeTile } from './RequestStatus';
import { NextPageSkeleton, RequestsFallback } from './states';

/**
 * RequestsScreen — v2 `/content-requests`, opened from Settings: everything the
 * reader asked the research team for, newest first, with where each request
 * stands. v1's "My Requests" page, in the settings design.
 *
 * v1's status tabs do not come across: the list is one person's requests, a
 * handful for nearly everybody, and the status is on every row.
 *
 * A guest can read the list (the server answers it for any account) but cannot
 * ask (the POST is 403 for guests), so the New request button is not offered.
 */
export function RequestsScreen() {
  const { signedIn, userId: viewerId, role } = useV2Session();
  const canAsk = signedIn && role !== 'guest';
  const query = useInfiniteQuery({ ...requestsQueries.list(viewerId), enabled: signedIn });
  const panel = useUrlOverlay('panel', { canOpen: { new: canAsk } });

  const pages = query.data?.pages;
  const rows = useMemo(() => flattenRequests(pages), [pages]);

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  const newRequest = canAsk ? (
    <Button size="sm" className="shrink-0" onClick={() => panel.show('new')}>
      <Plus aria-hidden className="size-4" />
      New request
    </Button>
  ) : null;

  const overlay = canAsk ? (
    <NewRequestPanel key={panel.keyFor('new')} viewerId={viewerId} {...panel.bind('new')} />
  ) : null;

  if (!signedIn) {
    return (
      <Column>
        <SettingsState
          icon={LogIn}
          title="Sign in to see your requests"
          description="The cases and notes you ask us for are listed here once you are signed in."
          action={
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          }
        />
      </Column>
    );
  }

  if (query.isPending) return <RequestsFallback />;

  if (query.isError) {
    const apiError = extractApiError(query.error);
    return (
      <Column>
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="Your requests did not load"
          description={
            apiError.status >= 400 && apiError.status < 500
              ? apiError.message
              : 'Check your connection and try again.'
          }
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RotateCw aria-hidden className={cn('size-4', query.isFetching && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      </Column>
    );
  }

  if (rows.length === 0) {
    return (
      <Column>
        <SettingsState
          icon={Inbox}
          title="You haven't asked for anything yet"
          description={
            canAsk
              ? "Can't find a case or a note? Ask us for it and our research team will work on adding it."
              : 'Requests need a Lawexa account. Once you have one, you can ask us for a case or a note.'
          }
          action={newRequest}
        />
        {overlay}
      </Column>
    );
  }

  return (
    <Column>
      <div className="mb-5 flex items-center gap-3 px-1">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">
          What you asked our research team for, and where each one stands.
        </p>
        {newRequest}
      </div>

      <ul className={SETTINGS_BLOCK}>
        {rows.map((request) => (
          <RequestRow key={request.uuid} request={request} />
        ))}
      </ul>

      {/* Sentinel and end-cap: while more pages exist this sits under the last
          row; once everything is loaded the quiet end-cap takes its place. */}
      <div ref={sentinelRef} className="pt-1">
        {query.isFetchingNextPage ? (
          <NextPageSkeleton />
        ) : !query.hasNextPage && rows.length > 3 ? (
          <p className="py-6 text-center text-xs text-muted-foreground/70">No more requests</p>
        ) : null}
      </div>

      {overlay}
    </Column>
  );
}

function Column({ children }: { children: React.ReactNode }) {
  return (
    <div className={SETTINGS_COLUMN}>
      <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
        My requests
      </h1>
      {children}
    </div>
  );
}

/**
 * One request: the whole row opens it, and a fulfilled one with content to
 * open carries a second, separate control for that (two links side by side,
 * never one inside the other).
 */
function RequestRow({ request }: { request: ContentRequest }) {
  const href = contentHref(request);
  const day = formatDay(request.created_at);
  return (
    <li className="flex items-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <Link
        href={requestHref(request.uuid)}
        className={cn(
          'group v2-interactive flex min-h-[4.5rem] min-w-0 flex-1 items-center gap-3.5 py-3 pl-4',
          href ? 'pr-2' : 'pr-4',
          'transition-colors duration-150 hover:bg-foreground/[0.04] motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        )}
      >
        <RequestTypeTile type={request.type} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[15px] leading-snug font-medium text-foreground">
            {request.title}
          </span>
          <span className="flex min-w-0 items-center gap-2 text-[13px] leading-snug text-muted-foreground">
            <RequestStatusPill request={request} />
            <span className="truncate">
              {typeWord(request.type)}
              {day ? ` · ${day}` : null}
            </span>
          </span>
        </span>
      </Link>
      {href ? (
        <Button asChild size="sm" variant="outline" className="mr-3 shrink-0 bg-background">
          <Link href={href} aria-label={`${openContentLabel(request.created_content_type)}: ${request.created_content?.title ?? request.title}`}>
            Open
          </Link>
        </Button>
      ) : null}
    </li>
  );
}
