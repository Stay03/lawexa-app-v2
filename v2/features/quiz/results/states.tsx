import Link from 'next/link';
import { ClipboardList } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { QuizMessage } from '../ui/QuizMessage';

/**
 * The review surface's own states. The shared ones (verify email, load failure)
 * live in `../ui/states.tsx`.
 */

/**
 * The review skeleton — the summary card, the answer sheet, and one review card
 * at their real geometry.
 *
 * It deliberately does NOT reserve the breakdown card: that block hides itself
 * when a session met only one difficulty, so reserving it would guarantee a
 * collapse on every single-difficulty session. Reserving only what always
 * renders is the honest median (standards §8iv).
 */
export function ResultsSkeleton({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div aria-hidden className="flex flex-col gap-5">
      {/* Summary card: ring + headline + actions. */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Skeleton className={cn('size-28 shrink-0 rounded-full', bar)} />
          <div className="flex-1 space-y-2">
            <Skeleton className={cn('h-5 w-40 rounded', bar)} />
            <Skeleton className={cn('h-4 w-56 max-w-full rounded', bar)} />
            <div className="flex gap-1.5 pt-1">
              <Skeleton className={cn('h-5 w-24 rounded-full', bar)} />
              <Skeleton className={cn('h-5 w-24 rounded-full', bar)} />
            </div>
          </div>
          <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:flex-col">
            <Skeleton className={cn('h-8 w-full rounded-md sm:w-32', bar)} />
            <Skeleton className={cn('h-8 w-full rounded-md sm:w-32', bar)} />
          </div>
        </div>
      </div>

      {/* Answer sheet: legend row + a band of cells. */}
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className={cn('mb-3 h-4 w-28 rounded', bar)} />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className={cn('size-7 rounded-md', bar)} />
          ))}
        </div>
      </div>

      {/* One review card. */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <Skeleton className={cn('h-5 w-3/4 rounded', bar)} />
        <div className="mt-4 flex flex-col gap-2">
          {[1, 0.85, 0.65, 0.45].map((opacity, index) => (
            <Skeleton
              key={index}
              className={cn('h-11 w-full rounded-lg', bar)}
              style={{ opacity }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The stepper's own reserved shape — the answer sheet, the filter row and one
 * review card. It is the `<Suspense>` fallback `ReviewStepper` needs because
 * that component reads `useSearchParams()` (see its docblock), and it draws the
 * same three blocks so the boundary resolving moves nothing.
 */
export function ReviewStepperSkeleton() {
  return (
    // `inert` beside `aria-hidden`, like every other fallback here: a Suspense
    // fallback is DELETED when content arrives, so nothing in it may hold focus.
    <div aria-hidden inert className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="mb-3 h-4 w-28 animate-none rounded" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="size-7 animate-none rounded-md" />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-16 animate-none rounded" />
        <Skeleton className="h-8 w-56 animate-none rounded-full" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <Skeleton className="h-5 w-3/4 animate-none rounded" />
        <div className="mt-4 flex flex-col gap-2">
          {[1, 0.85, 0.65, 0.45].map((opacity, index) => (
            <Skeleton
              key={index}
              className="h-11 w-full animate-none rounded-lg"
              style={{ opacity }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A session that ended without a single answer. It is not an error and not
 * really an empty state either — the session genuinely happened, there is just
 * nothing to review — so it says exactly that and points at the one useful
 * next move.
 */
export function NoAnswersState() {
  return (
    <QuizMessage
      icon={ClipboardList}
      title="Nothing to review"
      description="This session ended before any question was answered, so there are no answers or explanations to show."
      action={
        <Button asChild size="sm">
          <Link href="/quiz">Start a new session</Link>
        </Button>
      }
    />
  );
}

/**
 * The review route's fallback (`app/v2/quiz/[sessionUuid]/results/loading.tsx`,
 * and the `[sessionUuid]` SEGMENT boundary) — the skeleton, held STILL, in the
 * shared column. This boundary covers an RSC payload rather than an API
 * request, so it reserves the shape without claiming a request is in flight.
 */
export function ResultsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your answers
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <ResultsSkeleton still />
      </div>
    </>
  );
}
