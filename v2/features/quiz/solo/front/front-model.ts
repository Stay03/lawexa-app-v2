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

/** Start's two ways to play (Arthur's A, f730f71c, 14 November 2026), for whoever may host. */
export const START_SOLO = { label: 'Play solo', hint: 'On your own, for your best score' } as const;
/** Hosted in a Space, for anyone, or by link (live quiz without a Space): the place is the dialog's choice. */
export const START_LIVE = { label: 'Host live', hint: 'Everyone plays at once, on their own phone' } as const;

/**
 * Whether the page offers Host a live quiz: to any signed-in account, guests
 * not (Stay's decision 1, thread 12341975, 14 November 2026: "any signed-in
 * person can host a public game"), for a quiz with questions to play (the
 * server answers 422 for an empty one). Whether a Space is among the places
 * is the dialog's (`spacesOpen`).
 */
export function offersHostLive({ mayHost, questionCount }: { mayHost: boolean; questionCount: number }): boolean {
  return mayHost && questionCount > 0;
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
