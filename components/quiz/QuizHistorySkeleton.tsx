import { Skeleton } from '@/components/ui/skeleton';

/** Loading placeholder for the history list. */
export function QuizHistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />
      ))}
    </div>
  );
}
