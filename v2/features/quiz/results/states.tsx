import Link from 'next/link';
import { ClipboardList } from 'lucide-react';

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
 *
 * It pulses in every caller, the route fallback included (standards §8i). A
 * wait is a wait: the reader cannot tell an RSC payload from a query, so one
 * appearance carries the whole load rather than changing halfway through.
 */
export function ResultsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      {/* Summary card: ring + headline + actions. */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Skeleton className="size-28 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-4 w-56 max-w-full rounded" />
            <div className="flex gap-1.5 pt-1">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
          <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:flex-col">
            <Skeleton className="h-8 w-full rounded-md sm:w-32" />
            <Skeleton className="h-8 w-full rounded-md sm:w-32" />
          </div>
        </div>
      </div>

      {/* Answer sheet: legend row + a band of cells. */}
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="mb-3 h-4 w-28 rounded" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="size-7 rounded-md" />
          ))}
        </div>
      </div>

      {/* One review card. */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <Skeleton className="h-5 w-3/4 rounded" />
        <div className="mt-4 flex flex-col gap-2">
          {[1, 0.85, 0.65, 0.45].map((opacity, index) => (
            <Skeleton
              key={index}
              className="h-11 w-full rounded-lg"
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
 *
 * It pulses, like every other wait in v2 (standards §8i). A boundary wait and a
 * query wait are the same event to the reader, so freezing one of them would
 * only print a seam into the middle of the load.
 */
export function ReviewStepperSkeleton() {
  return (
    // `inert` beside `aria-hidden`, like every other fallback here: a Suspense
    // fallback is DELETED when content arrives, so nothing in it may hold focus.
    <div aria-hidden inert className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="mb-3 h-4 w-28 rounded" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="size-7 rounded-md" />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-8 w-56 rounded-full" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <Skeleton className="h-5 w-3/4 rounded" />
        <div className="mt-4 flex flex-col gap-2">
          {[1, 0.85, 0.65, 0.45].map((opacity, index) => (
            <Skeleton
              key={index}
              className="h-11 w-full rounded-lg"
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
 * and the `[sessionUuid]` SEGMENT boundary) — the skeleton, in the shared
 * column. This boundary covers an RSC payload rather than an API request, and
 * it pulses all the same: the reader sees one wait, so the wait keeps one
 * appearance.
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
        <ResultsSkeleton />
      </div>
    </>
  );
}
