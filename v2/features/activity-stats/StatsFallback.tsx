import { Skeleton } from '@/components/ui/skeleton';

/**
 * The stats page's column, heading and loading shape, in their own file so the
 * route's loading boundary ships none of the screen's queries (the
 * `FolderDetailFallback` reason). Nothing here may import the screen.
 */

/** The Profile screen's measure. */
export const STATS_COLUMN = 'mx-auto w-full max-w-2xl px-4 pb-16 pt-4 sm:pt-6';

/** A pushed screen: the bar carries the title below `md:`, the page from `md:` (`ActivityHeading`). */
export function StatsHeading() {
  return (
    <h1 className="sr-only md:not-sr-only md:mb-5 md:block md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
      Your stats
    </h1>
  );
}

/** The live page's blocks at their live heights, so nothing moves when the numbers land. */
export function StatsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your stats
      </span>
      <div aria-hidden inert className={STATS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-36 rounded-lg md:block" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-[5.25rem] rounded-2xl" />
          <Skeleton className="h-[5.25rem] rounded-2xl" />
        </div>
        <div className="mt-8 flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-9 w-64 rounded-full" />
        </div>
        <Skeleton className="mt-3 h-[7.5rem] w-full rounded-xl" />
      </div>
    </>
  );
}
