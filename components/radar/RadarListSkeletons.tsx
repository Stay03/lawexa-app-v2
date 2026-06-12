import { Skeleton } from '@/components/ui/skeleton';

const FADE_OPACITIES = [1, 0.8, 0.55, 0.3, 0.15];

interface SkeletonListProps {
  count?: number;
}

function RadarCardSkeleton({ count = 4 }: SkeletonListProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border bg-card p-5"
          style={{ opacity: FADE_OPACITIES[index] ?? 0.15 }}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <div className="ml-auto">
              <Skeleton className="size-8 rounded-lg" />
            </div>
          </div>
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-4 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function ScanRowSkeleton({ count = 5 }: SkeletonListProps) {
  return (
    <div className="divide-y divide-border/50">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 px-3 py-4"
          style={{ opacity: FADE_OPACITIES[index] ?? 0.15 }}
        >
          <Skeleton className="size-2 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

export { RadarCardSkeleton, ScanRowSkeleton };
