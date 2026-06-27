import { Skeleton } from '@/components/ui/skeleton';

/** Loading placeholder for the results screen (score ring + review list). */
export function QuizResultsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-32 w-32 rounded-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
