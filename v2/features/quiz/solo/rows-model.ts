/**
 * rows-model — what a quiz row says beyond its title, in the words of the
 * redesign Stay approved (23 October 2026, pictures 2 and 3): the size ("6
 * questions · 1 scenario · about 3 min"), the reader's own best ("Best
 * 2,553"), when it was edited ("Edited 21 Oct"), and the tile's colour. Pure,
 * so the rules are tested here and the rows only lay them out.
 *
 * Each fact the server does not send is `null`, and a `null` fact is simply
 * not drawn: `viewer_best_points`, `viewer_attempts_count`, `total_seconds`
 * and `scenario_count` arrive with backend's quiz fields, and a row read
 * before them shows the count and the date alone.
 */

/** "about 3 min" from the quiz's summed question timers, rounded up, at least 1. */
export function quizMinutesLabel(totalSeconds: number | null | undefined): string | null {
  if (typeof totalSeconds !== 'number' || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  return `about ${Math.max(1, Math.ceil(totalSeconds / 60))} min`;
}

/** "1 scenario", "2 scenarios"; nothing when there are none. */
export function scenarioCountLabel(count: number | null | undefined): string | null {
  if (typeof count !== 'number' || count <= 0) return null;
  return `${count} ${count === 1 ? 'scenario' : 'scenarios'}`;
}

/** "Best 2,553": the reader's best finished score here; nothing before their first. */
export function bestLabel(points: number | null | undefined): string | null {
  if (typeof points !== 'number' || !Number.isFinite(points)) return null;
  return `Best ${Math.round(points).toLocaleString('en-US')}`;
}

const SHORT_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const SHORT_DAY_YEAR = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Whether two dates fall on the same local calendar day. */
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * "Edited today", "Edited yesterday", "Edited 21 Oct", or "Edited 21 Oct
 * 2025" in another year: short enough to share a phone line with who can
 * take the quiz, which the weekday-and-month form never did (the chip it
 * squeezed, audit, 23 October 2026).
 */
export function editedLabel(iso: string, now: Date): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  if (sameDay(date, now)) return 'Edited today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Edited yesterday';
  return `Edited ${(date.getFullYear() === now.getFullYear() ? SHORT_DAY : SHORT_DAY_YEAR).format(date)}`;
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
