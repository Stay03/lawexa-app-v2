import { questionCountLabel } from './model';

/**
 * rows-model — what a quiz card says beyond its title, in the small-card
 * version Stay picked (C, 23 October 2026): one fact line ("10 questions · 5
 * min"), the reader's own best ("Best 2,553") or "Not taken", and the tile's
 * colour. Pure, so the rules are tested here and the card only lays them out.
 *
 * A fact the server does not send is left out: a card read before
 * `total_seconds` arrives says the count alone, and one read before
 * `viewer_best_points` arrives says nothing about a best.
 */

/** Whole minutes from the quiz's summed question timers, rounded up, at least 1. */
function wholeMinutes(totalSeconds: number | null | undefined): number | null {
  if (typeof totalSeconds !== 'number' || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  return Math.max(1, Math.ceil(totalSeconds / 60));
}

/** "about 3 min", the quiz front's length pill. */
export function quizMinutesLabel(totalSeconds: number | null | undefined): string | null {
  const minutes = wholeMinutes(totalSeconds);
  return minutes === null ? null : `about ${minutes} min`;
}

/** The card's one fact line: "10 questions · 5 min", or the count alone. */
export function quizFactsLabel(count: number, totalSeconds: number | null | undefined): string {
  const minutes = wholeMinutes(totalSeconds);
  return minutes === null ? questionCountLabel(count) : `${questionCountLabel(count)} · ${minutes} min`;
}

/** "1 scenario", "2 scenarios"; nothing when there are none. The quiz front says it. */
export function scenarioCountLabel(count: number | null | undefined): string | null {
  if (typeof count !== 'number' || count <= 0) return null;
  return `${count} ${count === 1 ? 'scenario' : 'scenarios'}`;
}

/** "Best 2,553": the reader's best finished score here; nothing before their first. */
export function bestLabel(points: number | null | undefined): string | null {
  if (typeof points !== 'number' || !Number.isFinite(points)) return null;
  return `Best ${Math.round(points).toLocaleString('en-US')}`;
}

/**
 * The card's bottom right: the best once there is one, "Not taken" when the
 * server says the reader has none (`null`) and the reader has an account to
 * hold one, and nothing when the field is absent or no one is signed in.
 */
export function bestOrNotTaken(
  points: number | null | undefined,
  signedIn: boolean,
): { label: string; taken: boolean } | null {
  const best = bestLabel(points);
  if (best) return { label: best, taken: true };
  if (points === null && signedIn) return { label: 'Not taken', taken: false };
  return null;
}

/** The tile's four colours, one per quiz and stable across renders and devices. */
export const QUIZ_TONES = ['blue', 'gold', 'coral', 'green'] as const;
export type QuizTone = (typeof QUIZ_TONES)[number];

export function quizTone(uuid: string): QuizTone {
  let hash = 0;
  for (let index = 0; index < uuid.length; index += 1) hash = (hash * 31 + uuid.charCodeAt(index)) >>> 0;
  return QUIZ_TONES[hash % QUIZ_TONES.length];
}

/** The tile's letter: the title's first letter or digit, upper case; "Q" when it has none. */
export function quizInitial(title: string): string {
  const match = title.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : 'Q';
}
