import { AttemptResultsFallback } from '@/v2/features/quiz/solo/results/states';

/**
 * The `[attemptUuid]` SEGMENT boundary — the practice player's arrangement,
 * for the same reason (`app/v2/quiz/(practice)/[sessionUuid]/loading.tsx`
 * carries the full note).
 *
 * The dominant navigation into this segment is play → results (finishing an
 * attempt), and that transition is covered by THIS boundary alone — the
 * results route's own `loading.tsx` lives inside the changing segment and
 * cannot paint until that segment's shell arrives. Drawing the results shape
 * here is what makes the hand-off after every attempt move nothing. A cold
 * navigation INTO the play page shows it for one round trip before
 * `(play)/loading.tsx` takes over; the player itself draws the same results
 * shape while it sends a finished attempt on, so the beat reads as one wait.
 */
export default function QuizAttemptSegmentLoading() {
  return <AttemptResultsFallback />;
}
