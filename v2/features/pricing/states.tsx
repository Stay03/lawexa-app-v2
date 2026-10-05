import { Skeleton } from '@/components/ui/skeleton';

/** The pricing column: wider than settings, because two plan cards sit side by side. */
export const PRICING_COLUMN = 'mx-auto w-full max-w-3xl px-4 pb-16 pt-4 sm:pt-6';

/**
 * The Pricing silhouette: the heading from `md:` up, the period switch, four
 * plan cards (two a row from `sm:`, the live count on 5 October 2026), the
 * message-pack row and the two closing lines. A guest gets no pack row, so the
 * page ends one block sooner and nothing above it moves.
 */
export function PricingFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading plans
      </span>
      <div aria-hidden inert className={PRICING_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-20 rounded-lg md:block" />
        <Skeleton className="mb-5 h-13 w-64 rounded-full md:h-11" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-5 rounded-2xl p-5 ring-1 ring-foreground/10">
              <div className="space-y-2">
                <Skeleton className="h-6 w-28 rounded" />
                <Skeleton className="h-4 w-52 rounded" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-9 w-32 rounded-lg" />
                <Skeleton className="h-4 w-44 rounded" />
              </div>
              <Skeleton className="h-11 w-full rounded-lg md:h-10" />
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Skeleton className="mb-2 h-4 w-28 rounded" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
        <div className="mt-6 space-y-2 px-1">
          <Skeleton className="h-3.5 w-64 rounded" />
          <Skeleton className="h-3.5 w-80 max-w-full rounded" />
        </div>
      </div>
    </>
  );
}
