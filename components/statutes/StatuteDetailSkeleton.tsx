import { cn } from '@/lib/utils';

interface StatuteDetailSkeletonProps {
  className?: string;
}

/**
 * Loading skeleton for statute detail page
 */
function StatuteDetailSkeleton({ className }: StatuteDetailSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header skeleton */}
      <div className="space-y-4">
        {/* Title */}
        <div className="h-8 w-4/5 animate-pulse rounded bg-muted" />
        {/* Short title */}
        <div className="h-5 w-2/5 animate-pulse rounded bg-muted" />
        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-36 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
        </div>
      </div>

      {/* Actions row skeleton */}
      <div className="flex gap-2">
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Preamble card skeleton */}
      <div className="space-y-3 rounded-lg border border-border/50 p-6">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>

      {/* Metadata grid skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="space-y-2 rounded-lg bg-muted/30 p-4"
            style={{ opacity: 1 - i * 0.1 }}
          >
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-5 w-28 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Node tree skeleton */}
      <div className="space-y-1">
        {[
          { indent: 0, opacity: 1 },
          { indent: 1, opacity: 0.9 },
          { indent: 1, opacity: 0.8 },
          { indent: 2, opacity: 0.7 },
          { indent: 0, opacity: 0.6 },
          { indent: 1, opacity: 0.5 },
          { indent: 1, opacity: 0.35 },
          { indent: 2, opacity: 0.2 },
        ].map((row, i) => (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded py-3"
            style={{ opacity: row.opacity, paddingLeft: `${row.indent * 24 + 16}px` }}
          >
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            {row.indent > 0 && (
              <div className="h-3 w-full max-w-sm animate-pulse rounded bg-muted" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export { StatuteDetailSkeleton };
