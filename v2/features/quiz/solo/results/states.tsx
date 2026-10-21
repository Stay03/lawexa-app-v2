import { Skeleton } from '@/components/ui/skeleton';
import { LIST_COLUMN } from '@/v2/shell/page-columns';

/**
 * The solo results surface's loading shapes: the headline card and two
 * question cards at their real geometry. Two cards is the honest median for
 * a quiz of a few questions (standards §8iv: reserve near the middle, never
 * at the cap). It pulses in every caller, the route and segment fallbacks
 * included.
 */
export function AttemptResultsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      {/* Headline card: ring + headline + actions. */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Skeleton className="size-28 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-4 w-56 max-w-full rounded" />
            <Skeleton className="h-4 w-40 max-w-full rounded" />
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
          </div>
          <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:flex-col">
            <Skeleton className="h-8 w-full rounded-4xl sm:w-32" />
            <Skeleton className="h-9 w-full rounded-full sm:w-24" />
          </div>
        </div>
      </div>

      <Skeleton className="h-4 w-24 rounded" />

      {[1, 0.6].map((opacity, index) => (
        <div
          key={index}
          className="rounded-xl border border-border bg-card p-4 sm:p-5"
          style={{ opacity }}
        >
          <Skeleton className="h-5 w-3/4 rounded" />
          <Skeleton className="mt-2.5 h-3 w-24 rounded" />
          <div className="mt-4 flex flex-col gap-2">
            {[1, 0.85, 0.65].map((rowOpacity, rowIndex) => (
              <Skeleton
                key={rowIndex}
                className="h-11 w-full rounded-lg"
                style={{ opacity: rowOpacity }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The results route's fallback (`app/v2/quiz/(solo)/attempts/[attemptUuid]/
 * results/loading.tsx`, and the `[attemptUuid]` SEGMENT boundary): the
 * skeleton, in the shared column.
 */
export function AttemptResultsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your results
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <AttemptResultsSkeleton />
      </div>
    </>
  );
}
