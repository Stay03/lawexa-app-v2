import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { QuizMessage } from '../ui/QuizMessage';

/**
 * The stats surface's own states. The shared ones (verify email, load failure)
 * live in `../ui/states.tsx`.
 */

/** The stats loading shape — four tiles, the chart card, two summary blocks. */
export function StatsSkeleton({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div aria-hidden className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className={cn('h-[92px] rounded-xl', bar)} />
        ))}
      </div>
      <Skeleton className={cn('h-64 rounded-xl', bar)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className={cn('h-32 rounded-xl', bar)} />
        <Skeleton className={cn('h-32 rounded-xl', bar)} />
      </div>
    </div>
  );
}

/**
 * NO HISTORY AT ALL. Distinct from "a metric has no value yet" — that case
 * still shows the tiles, with em dashes. This one means there is nothing to
 * describe, so it offers the only thing that would change that.
 */
export function StatsEmptyState() {
  return (
    <QuizMessage
      icon={BarChart3}
      tone="accent"
      title="No progress to show yet"
      description="Finish a practice session and this page fills in: your average score, how accurate you are, and how your scores move over time."
      action={
        <Button asChild size="sm">
          <Link href="/quiz">Start practising</Link>
        </Button>
      }
    />
  );
}

/**
 * The stats route's fallback (`app/v2/quiz/stats/loading.tsx`) — the heading
 * rendered FOR REAL (static chrome waits on nothing) over the STILL skeleton
 * for the regions that genuinely are waiting.
 */
export function StatsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your progress
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <StatsHeading />
        <StatsSkeleton still />
      </div>
    </>
  );
}

/** Static chrome — identical in the live screen and in the route fallback. */
export function StatsHeading() {
  return (
    <div className="mb-5 space-y-1">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Your progress
      </h1>
      <p className="text-sm text-muted-foreground">
        Across every practice session on this account.
      </p>
    </div>
  );
}
