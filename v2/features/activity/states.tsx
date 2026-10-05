'use client';

import Link from 'next/link';
import { History, LogIn, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCount } from '@/v2/shell/pager-model';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { SettingsState } from '@/v2/features/settings/SettingsState';
import { STACKED_ROW_HEIGHT, TABLE_COLUMNS, TABLE_ROW_HEIGHT } from './ActivityTable';
import { PER_PAGE } from './queries';

/**
 * The `/activity` states. Empty, error and signed-out are the settings
 * family's `SettingsState` (the screen is opened from Settings, and its
 * anatomy is the one every v2 page state shares: tile, title, one sentence,
 * one action). The skeleton is shaped like the live table: the count line,
 * the same header, the same columns, and rows of the same height.
 */

/** The screen's one heading: in the bar below `md:` (pushed screen), in the page from `md:`. */
export function ActivityHeading() {
  return (
    <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
      Activity
    </h1>
  );
}

/** Each skeleton row a little fainter than the one above, down to a floor. */
function rowOpacity(index: number): number {
  return Math.max(1 - index * 0.08, 0.2);
}

/**
 * A page of rows, as a skeleton: the count line ("35,115 questions"), then the
 * real table header over bars in the question, chat and date columns from
 * `md:`, or the stacked two-line rows below it. Every row is the height of a
 * loaded row (`TABLE_ROW_HEIGHT`, `STACKED_ROW_HEIGHT`), so the rows land
 * without moving anything.
 */
export function ActivityTableSkeleton({ rows = PER_PAGE }: { rows?: number }) {
  const indexes = Array.from({ length: rows }, (_, index) => index);
  return (
    <div aria-hidden>
      <div className="mb-2 flex h-4 items-center">
        <Skeleton className="h-3 w-24 rounded" />
      </div>
      <Table className="hidden table-fixed md:table">
        {TABLE_COLUMNS}
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">Question</TableHead>
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">Chat</TableHead>
            <TableHead className="h-10 text-right text-xs font-medium text-muted-foreground">Asked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {indexes.map((index) => (
            <TableRow
              key={index}
              className={cn(TABLE_ROW_HEIGHT, 'border-border/70 hover:bg-transparent')}
              style={{ opacity: rowOpacity(index) }}
            >
              <TableCell className="py-0">
                <Skeleton className={cn('h-3.5 rounded', index % 3 === 1 ? 'w-3/5' : 'w-4/5')} />
              </TableCell>
              <TableCell className="py-0">
                <Skeleton className="h-3 w-3/4 rounded" />
              </TableCell>
              <TableCell className="py-0">
                <Skeleton className="ml-auto h-3 w-24 rounded" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col divide-y divide-border/70 border-y border-border/70 md:hidden">
        {indexes.map((index) => (
          <div
            key={index}
            className={cn(STACKED_ROW_HEIGHT, 'flex flex-col justify-center gap-2 px-1')}
            style={{ opacity: rowOpacity(index) }}
          >
            <Skeleton className={cn('h-3.5 rounded', index % 3 === 1 ? 'w-3/5' : 'w-11/12')} />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The route and Suspense fallback: the heading and the list skeleton.
 * `app/v2/activity/loading.tsx` renders this same component, so route
 * boundary → Suspense fallback → live list is one shape.
 */
export function ActivityFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your activity
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a fallback is deleted, not
          reconciled, so nothing in it may hold focus. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-28 rounded-lg md:block" />
        <ActivityTableSkeleton />
      </div>
    </>
  );
}

/** Nothing asked yet. */
export function ActivityEmptyState() {
  return (
    <SettingsState
      icon={History}
      title="No questions yet"
      description="Every question you ask Lawexa is kept here, newest first."
      action={
        <Button asChild size="sm">
          <Link href="/">Ask a question</Link>
        </Button>
      }
    />
  );
}

/**
 * A page past the end: `?page=40` on a list of five pages, from an old link
 * or a hand-edited URL. The server answers it with no rows and the true last
 * page, so the way back names that page.
 */
export function ActivityPastEndState({
  lastPage,
  onGoTo,
}: {
  lastPage: number;
  onGoTo: (page: number) => void;
}) {
  return (
    <SettingsState
      icon={History}
      title="There is no page here"
      description={`Your questions end on page ${formatCount(lastPage)}.`}
      action={
        <Button variant="outline" size="sm" onClick={() => onGoTo(lastPage)}>
          Go to page {formatCount(lastPage)}
        </Button>
      }
    />
  );
}

/** A failed first load: distinct from empty, with a real retry. */
export function ActivityErrorState({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <SettingsState
      icon={TriangleAlert}
      tone="alarm"
      title="Your activity did not load"
      description="Check your connection and try again."
      action={
        <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** Signed out: the query never runs, so this replaces a skeleton that would never resolve. */
export function ActivitySignedOutState() {
  return (
    <SettingsState
      icon={LogIn}
      title="Sign in to see your activity"
      description="The questions you ask are kept here once you are signed in."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}
