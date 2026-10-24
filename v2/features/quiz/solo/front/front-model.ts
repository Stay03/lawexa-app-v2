import { pointsLabel } from '../model';

/**
 * front-model: the words a quiz's page says about itself (quiz piece 3, Stay
 * and Arthur, October 2026): how often the reader has taken it, the scoring
 * note under Start, and the line Challenge a friend sends.
 */

/** "Taken 3 times", "Taken once"; nothing before the first finished attempt. */
export function takenLabel(attempts: number | null | undefined): string | null {
  if (typeof attempts !== 'number' || attempts <= 0) return null;
  return attempts === 1 ? 'Taken once' : `Taken ${attempts} times`;
}

/**
 * The scoring note under Start (Arthur, 24 October 2026: short and plain, no
 * dash). Said once, small, by an info mark.
 */
export const FRONT_SCORING_NOTE = 'Right answers score up to 1,000 points. The faster you answer, the more you keep.';

/**
 * The line "Challenge a friend" sends with the quiz's link: the viewer's best
 * to beat once they have one, else the quiz itself.
 */
export function frontChallengeText(title: string | null, best: number | null | undefined): string {
  const name = title?.trim() || 'this quiz';
  return typeof best === 'number' && best > 0
    ? `I scored ${pointsLabel(best)} points on ${name}. Can you beat me?`
    : `Try ${name} on Lawexa. How many can you get right?`;
}
