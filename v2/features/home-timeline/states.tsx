import Link from 'next/link';
import { WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { updatesLabel } from './row-model';
import type { TimelineType } from './types';

/**
 * The timeline's states. The skeleton is the row's own shape (a 20px lead, a
 * title bar, a meta bar, a time stub) under a day heading, so the hand-off to
 * the rows moves nothing; the rows then fade in over it. Empty is one quiet
 * line. Error is the page state every v2 list uses (`conversations/list/states.tsx`):
 * a quiet icon tile, one title, one line, and Try again.
 */

/**
 * The header (Stay's references, 24 October 2026): "Activity", what the tab
 * shows in one grey line, and today's count in a quiet pill on the right,
 * left out when nothing happened today or the count is not known yet. The
 * route fallback draws the same header without the count, so nothing moves
 * when the list arrives.
 */
export function TimelineHeading({ type, updates = 0 }: { type: TimelineType; updates?: number }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What&rsquo;s happening in your {type === 'study' ? 'Study' : 'Work'} Spaces
        </p>
      </div>
      {updates > 0 ? (
        <span className="mt-1 shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground tabular-nums">
          {updatesLabel(updates)}
        </span>
      ) : null}
    </header>
  );
}

/** The rows fade down the stack, as the other v2 list skeletons do. */
const ROW_FADE = ['opacity-100', 'opacity-90', 'opacity-75', 'opacity-60', 'opacity-45', 'opacity-30'] as const;

function TimelineRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex min-h-14 items-start gap-3 px-3 py-2.5', className)}>
      <Skeleton className="size-5 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 pt-[3px]">
          <Skeleton className="h-3.5 w-1/2 rounded" />
          <Skeleton className="ml-auto h-3 w-8 shrink-0 rounded" />
        </div>
        <Skeleton className="mt-[7px] h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}

/** The first load: a day heading over the row skeletons. */
export function TimelineSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="mb-1.5 h-4 w-14 rounded" />
      {ROW_FADE.map((fade) => (
        <TimelineRowSkeleton key={fade} className={fade} />
      ))}
    </div>
  );
}

/** The next page, at the end of the list while it loads. */
export function TimelineNextPageSkeleton() {
  return (
    <div aria-hidden className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <TimelineRowSkeleton />
      <TimelineRowSkeleton className="opacity-50" />
    </div>
  );
}

/**
 * Nothing has happened yet (fix 9): one line saying what shows here, and a
 * quiet way to the Spaces it comes from (`/spaces?type=`, the Spaces list's
 * own filter). Outline, never gold.
 */
export function TimelineEmptyState({ type }: { type: TimelineType }) {
  const label = type === 'study' ? 'Study' : 'Work';
  return (
    <div className="flex flex-col items-start gap-3 px-3 py-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <p className="text-sm text-muted-foreground">
        Files, folders, chats and people from your {label} Spaces show here as they happen.
      </p>
      <Button asChild variant="outline" size="sm" className="rounded-full bg-transparent hover:bg-secondary">
        <Link href={`/spaces?type=${type}`}>Go to your {label} Spaces</Link>
      </Button>
    </div>
  );
}

/** The first page failed. A server that said why is quoted. */
export function TimelineErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <WifiOff className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">Couldn&apos;t load what happened</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {message?.trim() || 'Something went wrong while loading your Spaces. Please try again.'}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** A later page failed: the rows stay, and one quiet line offers the retry. */
export function TimelinePageError({ onRetry }: { onRetry: () => void }) {
  return (
    <p className="flex items-center justify-center gap-1 py-6 text-xs text-muted-foreground">
      Couldn&apos;t load more.
      <Button variant="ghost" size="xs" onClick={onRetry}>
        Try again
      </Button>
    </p>
  );
}
