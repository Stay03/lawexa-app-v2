import { Skeleton } from '@/components/ui/skeleton';

/** Loading placeholder for the results screen (hero + answer sheet + stepper). */
export function QuizResultsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      {/* hero summary */}
      <Skeleton className="h-40 w-full rounded-2xl" />
      {/* breakdown / answer sheet */}
      <Skeleton className="h-28 w-full rounded-2xl" />
      {/* review controls */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-44 rounded-full" />
      </div>
      {/* current question card */}
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
