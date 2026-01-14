import { cn } from '@/lib/utils';

interface CaseDetailSkeletonProps {
  className?: string;
}

/**
 * Loading skeleton for case detail page
 */
function CaseDetailSkeleton({ className }: CaseDetailSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Back button skeleton */}
      <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />

      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-32 animate-pulse rounded-full bg-muted" />
        </div>
      </div>

      {/* Metadata skeleton */}
      <div className="flex flex-wrap gap-2">
        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export { CaseDetailSkeleton };
