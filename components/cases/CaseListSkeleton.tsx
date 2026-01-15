import { cn } from '@/lib/utils';

interface CaseListSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Loading skeleton for case list with fading effect
 */
function CaseListSkeleton({ count = 5, className }: CaseListSkeletonProps) {
  // Opacity values: first items fully visible, progressively fading out
  const opacityValues = [1, 0.8, 0.5, 0.25, 0.1];

  return (
    <div
      className={cn(
        'divide-y divide-border/50 overflow-hidden rounded-lg',
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => {
        const opacity = opacityValues[i] ?? 0.25;

        return (
          <div
            key={i}
            className="flex flex-col gap-3 px-5 py-4 overflow-hidden"
            style={{ opacity }}
          >
            {/* Header row */}
            <div className="flex items-center gap-3">
              <div className="h-4 min-w-0 flex-1 animate-pulse rounded bg-muted" />
              <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
                <div className="h-5 w-8 animate-pulse rounded bg-muted" />
                <div className="h-5 w-10 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </div>
            </div>
            {/* Principles preview */}
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            {/* Tags */}
            <div className="flex gap-1.5">
              <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { CaseListSkeleton };
