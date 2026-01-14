import { cn } from '@/lib/utils';

interface CaseListSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Loading skeleton for case list
 */
function CaseListSkeleton({ count = 5, className }: CaseListSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export { CaseListSkeleton };
