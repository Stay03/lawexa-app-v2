import { Skeleton } from '@/components/ui/skeleton';
import { PhaseRow } from '@/v2/features/channels/quiz/ui';
import { PLAYER_COLUMN } from '../../player/states';

/**
 * The solo play surface's loading shapes. The practice player's `PLAYER_COLUMN`
 * (no top padding, for a sticky bar) is reused; the shape differs: a quiz
 * title line, the bar, the timer row, the question and up to four tiles in
 * the channel game's two-column grid.
 */

/** The play skeleton at the live screen's geometry. It pulses in the route
 *  fallback and on the screen's own pending beat alike. */
export function AttemptPlayerSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="mt-4 h-4 w-48 rounded" />
      <div className="-mx-4 mt-2 flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <Skeleton className="h-5 w-32 rounded" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <div className="flex flex-col gap-5 pt-6">
        <PhaseRow>
          <Skeleton className="h-1.5 flex-1 rounded-full" />
          <Skeleton className="h-4 w-8 rounded" />
        </PhaseRow>
        <div className="space-y-2">
          <Skeleton className="h-6 w-full rounded" />
          <Skeleton className="h-6 w-2/3 rounded" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 0.85, 0.65, 0.45].map((opacity, index) => (
            <Skeleton key={index} className="h-16 rounded-xl" style={{ opacity }} />
          ))}
        </div>
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
      <div aria-hidden inert className={PLAYER_COLUMN}>
        <AttemptPlayerSkeleton />
      </div>
    </>
  );
}
