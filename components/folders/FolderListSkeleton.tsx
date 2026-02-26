import { cn } from '@/lib/utils';

interface FolderListSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Loading skeleton for folder list with fading effect
 */
function FolderListSkeleton({ count = 5, className }: FolderListSkeletonProps) {
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
            className="flex items-center gap-3 px-5 py-4"
            style={{ opacity }}
          >
            {/* Icon skeleton */}
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted" />

            {/* Content skeleton */}
            <div className="min-w-0 flex-1">
              {/* Title + counts row */}
              <div className="flex items-center gap-3">
                <div className="h-4 min-w-0 flex-1 animate-pulse rounded bg-muted" />
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  <div className="h-4 w-14 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                </div>
              </div>
              {/* Author row */}
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { FolderListSkeleton };
