import { cn } from '@/lib/utils';

interface NoteListSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Loading skeleton for note list with fading effect
 */
function NoteListSkeleton({ count = 5, className }: NoteListSkeletonProps) {
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
            {/* Thumbnail skeleton */}
            <div className="hidden shrink-0 sm:block">
              <div className="h-16 w-24 animate-pulse rounded-md bg-muted" />
            </div>

            {/* Content skeleton */}
            <div className="min-w-0 flex-1">
              {/* Header row */}
              <div className="flex items-center gap-3">
                <div className="h-4 min-w-0 flex-1 animate-pulse rounded bg-muted" />
                <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
                  <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
                  <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                </div>
              </div>

              {/* Author */}
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />

              {/* Preview */}
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted" />
              <div className="mt-1 h-3 w-3/4 animate-pulse rounded bg-muted" />

              {/* Tags */}
              <div className="mt-2 flex gap-1.5">
                <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { NoteListSkeleton };
