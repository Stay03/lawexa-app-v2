import { Skeleton } from '@/components/ui/skeleton';

/** Loading placeholder for the play screen (header + question + 4 options). */
export function QuizPlaySkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-between py-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-7 w-28" />
      </div>
      <div className="space-y-2 pt-4">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-7 w-1/2" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[60px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
