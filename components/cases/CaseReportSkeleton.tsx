import { cn } from '@/lib/utils';

/******************************************************************************
                               Types
******************************************************************************/

interface ICaseReportSkeletonProps {
  className?: string;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Loading skeleton for full case report page
 */
function CaseReportSkeleton({ className }: ICaseReportSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Back button skeleton */}
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />

      {/* Document container skeleton */}
      <div className="space-y-8 rounded-lg bg-card p-6 sm:p-8 md:p-10 lg:p-12 shadow-sm">
        {/* Header skeleton */}
        <div className="space-y-4 text-center border-b pb-6">
          {/* Title */}
          <div className="h-8 w-3/4 mx-auto animate-pulse rounded bg-muted" />
          {/* Subtitle */}
          <div className="h-4 w-32 mx-auto animate-pulse rounded bg-muted" />
          {/* Meta */}
          <div className="flex justify-center gap-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          </div>
          {/* Citation */}
          <div className="h-4 w-40 mx-auto animate-pulse rounded bg-muted" />
          {/* Tags */}
          <div className="flex justify-center gap-2 pt-2">
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
          </div>
        </div>

        {/* Judges skeleton */}
        <div className="text-center py-2">
          <div className="h-4 w-64 mx-auto animate-pulse rounded bg-muted" />
        </div>

        {/* Full judgment skeleton - multiple paragraphs */}
        <div className="space-y-6">
          {/* Section heading */}
          <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          {/* Paragraphs */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>

        {/* Footer skeleton */}
        <div className="pt-4 border-t">
          <div className="h-px w-full bg-muted mb-4" />
          <div className="h-3 w-48 mx-auto animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

/******************************************************************************
                               Export
******************************************************************************/

export { CaseReportSkeleton };
export type { ICaseReportSkeletonProps };
