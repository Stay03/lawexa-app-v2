import { pointsLabel } from '../model';

/**
 * front-model: the words a quiz's page says about itself (quiz piece 3, Stay
 * and Arthur, October 2026): how often the reader has taken it, the scoring
 * note under Start, and the line Challenge a friend sends.
 */

/**
 * The challenger's attempt from a challenge link's `?from=`: a uuid, else
 * nothing (a mangled or hand-typed value reads no banner and sends no `from`).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function challengeFromParam(raw: string | null): string | null {
  return raw !== null && UUID.test(raw) ? raw : null;
}

/**
 * Whether the page offers Host a live quiz (Arthur's spec, 9 November 2026:
 * hosted in a Space, picked from outside one): to an account that may use
 * Spaces, for a quiz with questions to play (the server answers 422 for an
 * empty one). Which Space, and whether they host there, is the picker's.
 */
export function offersHostLive({
  spacesOpen,
  questionCount,
}: {
  spacesOpen: boolean;
  questionCount: number;
}): boolean {
  return spacesOpen && questionCount > 0;
}

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
