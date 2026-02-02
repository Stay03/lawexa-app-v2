import { cn } from '@/lib/utils';

interface ConversationListSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Loading skeleton for conversation list with fading effect
 */
function ConversationListSkeleton({ count = 5, className }: ConversationListSkeletonProps) {
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
            className="flex gap-4 overflow-hidden px-5 py-4"
            style={{ opacity }}
          >
            {/* Content skeleton */}
            <div className="min-w-0 flex-1">
              {/* Header row */}
              <div className="flex items-center gap-3">
                <div className="h-5 min-w-0 flex-1 animate-pulse rounded bg-muted" />
                <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
                  <div className="h-4 w-10 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-10 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                </div>
              </div>

              {/* Author row */}
              <div className="mt-2 flex items-center gap-2">
                <div className="h-5 w-5 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-3 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { ConversationListSkeleton };
