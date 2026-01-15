import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface CaseDetailSkeletonProps {
  className?: string;
}

/**
 * Loading skeleton for case detail page matching new layout
 */
function CaseDetailSkeleton({ className }: CaseDetailSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header skeleton */}
      <div className="space-y-4">
        {/* Title */}
        <div className="h-8 w-4/5 animate-pulse rounded bg-muted" />
        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-36 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
        </div>
        {/* Tags */}
        <div className="flex gap-2">
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
        </div>
      </div>

      {/* Principles card skeleton */}
      <Card className="border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <div className="h-5 w-36 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>

      {/* Body card skeleton */}
      <Card>
        <CardHeader className="pb-3">
          <div className="h-5 w-28 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>

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

      {/* Judges skeleton */}
      <div className="space-y-2 rounded-lg bg-muted/30 p-4">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-5 w-64 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export { CaseDetailSkeleton };
