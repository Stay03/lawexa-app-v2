'use client';

import { Quote, SearchX, WifiOff, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthorityRowSkeleton } from '../detail/AuthorityList';

/**
 * The "See all" panel's states: the same three-state contract as every v2
 * list (standards §8iv). Skeleton rows are the case page's own row silhouette,
 * because the rows are the case page's own rows.
 */

/** The first page in flight: rows fading down the stack, the list language
 *  the other v2 lists share. */
export function CitedByListSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col divide-y divide-border/60">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.09) }}>
          <AuthorityRowSkeleton />
        </div>
      ))}
    </div>
  );
}

/** The next page in flight, at the sentinel. */
export function NextPageSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col divide-y divide-border/60 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <AuthorityRowSkeleton />
      <div style={{ opacity: 0.6 }}>
        <AuthorityRowSkeleton />
      </div>
      <div style={{ opacity: 0.3 }}>
        <AuthorityRowSkeleton />
      </div>
    </div>
  );
}

/** The chip rows' place while the first page (which carries the filter
 *  lists) is in flight. */
export function FilterChipsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {[
        ['w-20', 'w-44', 'w-36', 'w-40'],
        ['w-20', 'w-16', 'w-16', 'w-16', 'w-16'],
      ].map((widths, row) => (
        <div key={row} className="flex gap-1.5 overflow-hidden">
          {widths.map((width, index) => (
            <Skeleton key={index} className={`h-8 shrink-0 rounded-full ${width}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PanelState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <Icon className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** The list came back empty with nothing narrowing it. The panel opens only
 *  on a case the payload says is cited, so this is the endpoint disagreeing
 *  with the count, and it says so plainly rather than drawing a blank. */
export function CitedByEmptyState() {
  return (
    <PanelState
      icon={Quote}
      title="No citing cases to show"
      description="The library has no later judgments citing this case right now."
    />
  );
}

/** Nothing matches the search and filters. Shown only when something narrows
 *  the list, so there is always something to clear. */
export function CitedByNoMatchState({ onClear }: { onClear: () => void }) {
  return (
    <PanelState
      icon={SearchX}
      title="No citing cases match"
      description="Try another name or citation, or a different court or year."
      action={
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear search and filters
        </Button>
      }
    />
  );
}

export function CitedByErrorState({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <PanelState
      icon={WifiOff}
      title="Couldn't load the citing cases"
      description="Something went wrong while loading this list. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          Try again
        </Button>
      }
    />
  );
}
