'use client';

import Link from 'next/link';
import { History, LogIn, SearchX, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchPosition } from '@/v2/search-position';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { SearchFieldShape } from '@/v2/shell/SearchField';
import { SettingsState } from '@/v2/features/settings/SettingsState';

/**
 * The `/activity` states. Empty, error and signed-out are the settings
 * family's `SettingsState` (the screen is opened from Settings, and its
 * anatomy is the one every v2 page state shares: tile, title, one sentence,
 * one action). The skeleton is shaped like the live list: a day heading, then
 * runs of a tile and a title over indented question lines.
 */

/** The screen's one heading: in the bar below `md:` (pushed screen), in the page from `md:`. */
export function ActivityHeading() {
  return (
    <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
      Activity
    </h1>
  );
}

/** One run, as a skeleton: the tile and title line, then `lines` indented questions. */
function RunSkeleton({ lines }: { lines: number }) {
  return (
    <div>
      <div className="flex min-h-11 items-center gap-3 px-3 py-2">
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <Skeleton className="h-3.5 w-1/2 rounded" />
      </div>
      {lines > 0 ? (
        <div className="ml-[1.875rem] border-l border-border/70 pl-1">
          {Array.from({ length: lines }).map((_, index) => (
            <div key={index} className="flex min-h-11 items-center gap-3 px-3 py-2">
              <Skeleton className="h-3 flex-1 rounded" />
              <Skeleton className="h-3 w-12 shrink-0 rounded" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A day of runs, as a skeleton. */
function DaySkeleton({ runs }: { runs: readonly number[] }) {
  return (
    <div>
      <Skeleton className="mx-3 mb-1.5 mt-1 h-3 w-16 rounded" />
      {runs.map((lines, index) => (
        <RunSkeleton key={index} lines={lines} />
      ))}
    </div>
  );
}

/**
 * The first-load skeleton. Progressive opacity down the stack, as the
 * conversations list does, so the shape suggests a list without promising
 * exactly how many rows will land.
 */
export function ActivityListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      <DaySkeleton runs={[2, 0]} />
      <div style={{ opacity: 0.6 }}>
        <DaySkeleton runs={[3]} />
      </div>
      <div style={{ opacity: 0.3 }}>
        <DaySkeleton runs={[1]} />
      </div>
    </div>
  );
}

/** The skeleton at the sentinel while the next page is in flight. */
export function NextPageSkeleton() {
  return (
    <div aria-hidden className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <RunSkeleton lines={1} />
      <div style={{ opacity: 0.5 }}>
        <RunSkeleton lines={1} />
      </div>
    </div>
  );
}

/**
 * The route and Suspense fallback: the heading, the search field's still
 * shape WHERE IT WILL LAND (the dock by default), and the list skeleton.
 * `app/v2/activity/loading.tsx` renders this same component, so route
 * boundary → Suspense fallback → live list is one shape.
 */
export function ActivityFallback() {
  const searchAtTop = useSearchPosition() === 'top';
  return (
    <>
      <span role="status" className="sr-only">
        Loading your activity
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a fallback is deleted, not
          reconciled, so nothing in it may hold focus. */}
      <div aria-hidden inert className={LIST_COLUMN_DOCKED}>
        <Skeleton className="mb-5 hidden h-8 w-28 rounded-lg md:block" />
        {searchAtTop ? <SearchFieldShape className="mb-4" /> : null}
        <ActivityListSkeleton />
        {searchAtTop ? null : (
          <ScreenDock>
            <ScreenDockSearch>
              <SearchFieldShape />
            </ScreenDockSearch>
          </ScreenDock>
        )}
      </div>
    </>
  );
}

/** Nothing asked yet, or nothing matching the search. */
export function ActivityEmptyState({
  search,
  onClear,
}: {
  /** The active (trimmed) search, or '' when unfiltered. */
  search: string;
  onClear: () => void;
}) {
  if (search) {
    return (
      <SettingsState
        icon={SearchX}
        title="No questions found"
        description={`None of your questions mention “${search}”.`}
        action={
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear search
          </Button>
        }
      />
    );
  }
  return (
    <SettingsState
      icon={History}
      title="No questions yet"
      description="Every question you ask Lawexa is kept here, by day."
      action={
        <Button asChild size="sm">
          <Link href="/">Ask a question</Link>
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
