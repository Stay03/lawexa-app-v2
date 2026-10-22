import { Skeleton } from '@/components/ui/skeleton';

/**
 * The solo play surface's column and loading shape, in design B1.
 *
 * THE COLUMN IS A FULL-HEIGHT FLEX COLUMN, and that is load-bearing twice
 * over: the header sticks to the top of the shell's one scroll container
 * (so no top padding, the practice player's rule), and the reveal sheet
 * sticks to the BOTTOM — a `sticky bottom-0` element can never travel past
 * its containing block, so the column has to be as tall as the scroll
 * region even when the question is short (`LIST_COLUMN_DOCKED`'s note).
 * `v2-solo` carries the B1 tokens (`../solo-quiz.css`) to everything inside.
 */
export const SOLO_PLAY_COLUMN = 'v2-solo mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-6';

/** The play skeleton at the live screen's geometry: the title line and the
 *  points, six segments, the thin rail, the kicker, a two-line question and
 *  four tiles. It pulses in the route fallback and on the screen's own
 *  pending beat alike. */
export function AttemptPlayerSkeleton() {
  return (
    <div aria-hidden>
      <div className="flex items-center justify-between gap-3 pt-3 pb-2.5">
        <Skeleton className="h-4 w-44 rounded" />
        <Skeleton className="h-4 w-14 rounded" />
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-2.5 flex-1 rounded-full" />
        ))}
      </div>
      <div className="mt-2.5 flex h-5 items-center gap-3">
        <Skeleton className="h-[3px] flex-1 rounded-full" />
        <Skeleton className="h-3 w-8 rounded" />
      </div>
      <div className="pt-8">
        <Skeleton className="h-3.5 w-20 rounded" />
        <Skeleton className="mt-3 h-8 w-full rounded" />
        <Skeleton className="mt-2 h-8 w-2/3 rounded" />
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {[1, 0.85, 0.65, 0.45].map((opacity, index) => (
          <Skeleton key={index} className="h-16 rounded-2xl" style={{ opacity }} />
        ))}
      </div>
    </div>
  );
}

/**
 * The play route's fallback (`app/v2/quiz/(solo)/attempts/[attemptUuid]/
 * (play)/loading.tsx`): the skeleton, in the play column.
 */
export function AttemptPlayerFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your quiz
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={SOLO_PLAY_COLUMN}>
        <AttemptPlayerSkeleton />
      </div>
    </>
  );
}
