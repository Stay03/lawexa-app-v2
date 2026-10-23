import { Skeleton } from '@/components/ui/skeleton';

/**
 * The solo results surface's column and loading shape, in design B1.
 *
 * THE COLUMN IS `LIST_COLUMN`'S MEASURE AS A FULL-HEIGHT FLEX COLUMN, so the
 * bottom row (Take it again, Challenge a friend) can sit on the bottom edge
 * however short the page is, and stick there once the review below is open
 * (`LIST_COLUMN_DOCKED`'s note on `min-h-full`). `v2-solo` carries the B1
 * tokens (`../solo-quiz.css`) to everything inside.
 */
export const RESULTS_COLUMN =
  'v2-solo mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-16 pt-5 sm:pt-6';

/**
 * The results skeleton at the live screen's geometry: the greeting, the big
 * number, its label, the three-cell stat row, the comparison line, the fold
 * row, and the two buttons at the bottom. It pulses in every caller, the
 * route and segment fallbacks and the player's hand-off included.
 */
export function AttemptResultsSkeleton() {
  return (
    <div aria-hidden className="flex flex-1 flex-col">
      <div className="flex flex-col items-center pt-10 sm:pt-14">
        <Skeleton className="h-6 w-48 rounded" />
        <Skeleton className="mt-5 h-[84px] w-52 rounded-xl" />
        <Skeleton className="mt-3 h-3 w-14 rounded" />
        <div className="mt-8 flex w-full max-w-[330px] divide-x divide-border">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2 px-1.5">
              <Skeleton className="h-6 w-10 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-5 h-3.5 w-56 max-w-full rounded" />
      </div>

      <Skeleton className="mt-11 h-[74px] w-full rounded-2xl" />

      <div className="mt-auto flex flex-wrap gap-2.5 pt-8">
        <Skeleton className="h-14 flex-1 basis-40 rounded-2xl" />
        <Skeleton className="h-14 flex-1 basis-40 rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * "See your answers" at the live page's geometry (`AnswersStepper`): the
 * heading row, two rows of ten number cells, the three filter pills, the
 * question with two tiles and its Why, and the bar at the bottom.
 */
export function AttemptAnswersSkeleton() {
  return (
    <div aria-hidden className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-40 rounded" />
        <Skeleton className="h-3.5 w-20 rounded" />
      </div>
      <div className="mt-4 grid grid-cols-10 gap-1.5">
        {Array.from({ length: 20 }, (_, index) => (
          <Skeleton key={index} className="h-8 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-3 h-9 w-52 rounded-full" />
      <div className="mt-5 border-t border-border/60 pt-4">
        <Skeleton className="h-3.5 w-28 rounded" />
        <Skeleton className="mt-3 h-5 w-full rounded" />
        <Skeleton className="mt-2 h-5 w-2/3 rounded" />
        <Skeleton className="mt-4 h-16 w-full rounded-2xl" />
        <Skeleton className="mt-2.5 h-16 w-full rounded-2xl" />
        <Skeleton className="mt-4 h-3 w-10 rounded" />
        <Skeleton className="mt-2 h-4 w-full rounded" />
      </div>
      <div className="mt-auto flex items-center gap-3 pt-8">
        <Skeleton className="h-12 w-24 rounded-full" />
        <Skeleton className="mx-auto h-4 w-16 rounded" />
        <Skeleton className="h-12 w-24 rounded-2xl" />
      </div>
    </div>
  );
}

/** The answers route's fallback: the skeleton, in the results column. */
export function AttemptAnswersFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your answers
      </span>
      <div aria-hidden inert className={RESULTS_COLUMN}>
        <AttemptAnswersSkeleton />
      </div>
    </>
  );
}

/**
 * The results route's fallback (`app/v2/quiz/(solo)/attempts/[attemptUuid]/
 * results/loading.tsx`, and the `[attemptUuid]` SEGMENT boundary): the
 * skeleton, in the results column.
 */
export function AttemptResultsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your results
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={RESULTS_COLUMN}>
        <AttemptResultsSkeleton />
      </div>
    </>
  );
}
