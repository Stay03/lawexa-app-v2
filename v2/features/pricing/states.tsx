import { Skeleton } from '@/components/ui/skeleton';

/**
 * The pricing column: wide enough for four plan cards in one row on a desktop
 * (the grid steps from one to two to four by the column's own width, a
 * container query, so the sidebar's width is already accounted for).
 */
export const PRICING_COLUMN = 'mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:pt-8';

/**
 * The Pricing silhouette for the route's loading boundary: the title, the tab
 * row and the Plans panel, the tab most links open.
 */
export function PricingFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading pricing
      </span>
      <div aria-hidden inert className={`${PRICING_COLUMN} @container/pricing`}>
        <Skeleton className="h-10 w-40 rounded-lg" />
        <div className="mt-5 flex gap-6 border-b border-foreground/10 pb-3">
          <Skeleton className="h-5 w-12 rounded" />
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
        </div>
        <div className="pt-6">
          <PlanSkeletons />
        </div>
      </div>
    </>
  );
}

/** The Plans panel while the plans load: the period switch and four cards. */
export function PlansFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading plans
      </span>
      <div aria-hidden inert>
        <PlanSkeletons />
      </div>
    </>
  );
}

/** The Pay as you go panel while the pack price loads. */
export function PacksFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading message packs
      </span>
      <div aria-hidden inert className="h-80 w-full rounded-2xl ring-1 ring-foreground/10 p-8">
        <Skeleton className="h-7 w-40 rounded" />
        <Skeleton className="mt-3 h-4 w-32 rounded" />
        <Skeleton className="mt-8 h-12 w-36 rounded-lg" />
      </div>
    </>
  );
}

function PlanSkeletons() {
  return (
    <>
      <Skeleton className="mb-6 h-13 w-64 rounded-full md:h-11" />
      <div className="grid gap-4 @xl/pricing:grid-cols-2 @5xl/pricing:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-5 rounded-2xl p-5 ring-1 ring-foreground/10">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton className="h-4 w-44 max-w-full rounded" />
            </div>
            <Skeleton className="h-10 w-32 rounded-lg" />
            <div className="space-y-2.5 border-t border-foreground/10 pt-5">
              {Array.from({ length: 6 }, (_, line) => (
                <Skeleton key={line} className="h-4 w-full rounded" />
              ))}
            </div>
            <Skeleton className="h-11 w-full rounded-lg md:h-10" />
          </div>
        ))}
      </div>
    </>
  );
}
