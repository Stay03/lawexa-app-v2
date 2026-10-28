import type { ChannelQuiz, QuizLeaderboard, QuizLeaderboardEntry, QuizListFilters } from '@/types/channel-quiz';

/**
 * home-model — what the Quiz home's filters and cards say about a quiz beyond
 * its title (Arthur's quiz home redesign, 25 October 2026, parts C and D on
 * Backend's quiz list parts 5 and 6). Pure, so the rules are tested here and
 * the screens only lay them out.
 */

/* ── The levels ───────────────────────────────────────────────────────────── */

/**
 * The levels a quiz can be set for, in the order every list shows them: the
 * sign-up form's levels, then law school and lawyer (Backend's
 * `App\Support\QuizLevels`, spelt exactly as a profile's level). Stay has not
 * yet confirmed this list (techlead, 27 October 2026), so this constant is the
 * one place the app holds it: the form offers it and the filters read it.
 */
export const QUIZ_LEVELS = [
  '100 Level',
  '200 Level',
  '300 Level',
  '400 Level',
  '500 Level',
  '600 Level',
  'Law School',
  'Lawyer',
] as const;

export function isQuizLevel(value: unknown): value is (typeof QUIZ_LEVELS)[number] {
  return typeof value === 'string' && (QUIZ_LEVELS as readonly string[]).includes(value);
}

/** The server's year range: 1960 to next year. */
export const QUIZ_MIN_YEAR = 1960;
export function quizMaxYear(now: Date): number {
  return now.getFullYear() + 1;
}

/** The server's topic length. Free text for now (Stay has not yet decided
 *  between free text and a fixed list). */
export const QUIZ_TOPIC_MAX_LENGTH = 100;

/** The longest topic filter and search the server takes; past them it is a 422. */
const TOPIC_FILTER_MAX_LENGTH = 255;
export const QUIZ_SEARCH_MAX_LENGTH = 100;

/**
 * The form's year field read: empty is no year; anything else must be a
 * whole year in the server's range, or the form says so before it saves.
 */
export function readQuizYear(
  text: string,
  maxYear: number,
): { year: number | null; problem: string | null } {
  const trimmed = text.trim();
  if (trimmed === '') return { year: null, problem: null };
  const year = /^\d{4}$/.test(trimmed) ? Number(trimmed) : NaN;
  if (Number.isNaN(year) || year < QUIZ_MIN_YEAR || year > maxYear) {
    return { year: null, problem: `The year must be from ${QUIZ_MIN_YEAR} to ${maxYear}, such as 2019.` };
  }
  return { year, problem: null };
}

/* ── The filters, in the address ──────────────────────────────────────────── */

/** The query-string keys the filters own. `search` is `useUrlSearch`'s. */
export const QUIZ_FILTER_PARAMS = ['search', 'year', 'level', 'topic'] as const;

/** Every filter cleared, as `replaceUrlParams` takes it. */
export const NO_QUIZ_FILTERS: Readonly<Record<(typeof QUIZ_FILTER_PARAMS)[number], null>> = {
  search: null,
  year: null,
  level: null,
  topic: null,
};

/**
 * The filters an address asks for. A value the server would refuse (a year
 * that is not a whole year, a level not in the list, an over-long topic) is
 * dropped here, so a hand-edited link shows the whole list, never a 422.
 */
export function parseQuizListFilters(params: { get(name: string): string | null }): QuizListFilters {
  const filters: QuizListFilters = {};
  const search = params.get('search')?.trim().slice(0, QUIZ_SEARCH_MAX_LENGTH).trim();
  if (search) filters.search = search;
  const year = params.get('year');
  // The year choices come from the server's own list; this only keeps a
  // hand-edited link from sending what it would refuse.
  if (year && /^\d{4}$/.test(year) && Number(year) >= QUIZ_MIN_YEAR) filters.year = Number(year);
  const level = params.get('level');
  if (isQuizLevel(level)) filters.level = level;
  const topic = params.get('topic')?.trim();
  if (topic && topic.length <= TOPIC_FILTER_MAX_LENGTH) filters.topic = topic;
  return filters;
}

/** Whether any choice is set (the search box says its own). */
export function hasFilterChoice(filters: QuizListFilters): boolean {
  return filters.year !== undefined || Boolean(filters.level) || Boolean(filters.topic);
}

/* ── What a card says ─────────────────────────────────────────────────────── */

/** "Land Law · 300 Level · 2025": what the quiz is about, or nothing. */
export function quizSubjectLabel(quiz: {
  topic?: string | null;
  level?: string | null;
  year?: number | null;
}): string | null {
  const parts = [quiz.topic?.trim() || null, quiz.level || null, quiz.year ? String(quiz.year) : null];
  const shown = parts.filter((part): part is string => part !== null);
  return shown.length > 0 ? shown.join(' · ') : null;
}

const NUMBER = new Intl.NumberFormat('en-US');

/** "1 player", "128 players"; nothing before the first. */
export function playersLabel(count: number | null | undefined): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return null;
  return `${NUMBER.format(count)} ${count === 1 ? 'player' : 'players'}`;
}

/** "#12 of 128". The count is left out when it is unknown or smaller than
 *  the rank (a board read before the count caught up). */
export function rankLabel(rank: number, playerCount?: number | null): string {
  const shown = `#${NUMBER.format(rank)}`;
  return typeof playerCount === 'number' && playerCount >= rank
    ? `${shown} of ${NUMBER.format(playerCount)}`
    : shown;
}

/** "11,405". */
export function scoreLabel(points: number): string {
  return NUMBER.format(Math.round(points));
}

/**
 * How the board is ranked, said where it is shown (Arthur: "make the scoring
 * rules transparent ... a friendly benchmark rather than a definitive measure
 * of knowledge").
 */
export const BOARD_RULES_NOTE =
  'Ranked by each player’s best score. Right answers score more the faster they come. Playing again can raise a best, so treat this as a friendly benchmark.';

/** The board's empty sentence. */
export const BOARD_EMPTY_NOTE = 'No one has finished this quiz yet. Be the first on the board.';

/** "Lagos campus · 300 Level": what a signed-in reader sees under a player's name. */
export function playerDetailLabel(user: { institution?: string; level?: string }): string | null {
  const parts = [user.institution, user.level].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * The line beside the reader's place on the board and on their results
 * (Arthur's reference, 28 October 2026: "#4 You are doing better than 60% of
 * other players!"): the share of the OTHER players they are ahead of, from
 * the server's `players_behind` (Techlead, 28 October 2026: a rank cannot say
 * it when players tie; two players level at the top are both 1 of 2 and
 * neither beats anyone). No percentage when there is no one else, when the
 * count is missing (an older server) or when no one is behind them.
 */
export function standingLine(
  playersBehind: number | null | undefined,
  playerCount: number,
  rank?: number,
): string | null {
  if (playerCount <= 1) return 'You’re the only player so far.';
  if (typeof playersBehind !== 'number' || !Number.isFinite(playersBehind)) return null;
  const others = playerCount - 1;
  if (playersBehind >= others) return 'You’re top of the board.';
  if (playersBehind <= 0) return rank === 1 ? 'You’re level at the top of the board.' : 'Play again to climb the board.';
  // Never "better than 100%" while someone is level with or ahead of them.
  const share = Math.min(99, Math.round((playersBehind / others) * 100));
  return share > 0 ? `You’re doing better than ${share}% of other players.` : 'Play again to climb the board.';
}

/**
 * Whether a board row is the reader's own. By the player (`viewer.user`), so
 * two players tied on rank and points are never both "you"; an older server
 * without `viewer.user` falls back to the rank and points.
 */
export function isViewerEntry(
  viewer: Pick<NonNullable<QuizLeaderboard['viewer']>, 'rank' | 'points' | 'user'> | null,
  entry: Pick<QuizLeaderboardEntry, 'rank' | 'points' | 'user'>,
): boolean {
  if (!viewer) return false;
  if (viewer.user) return viewer.user.uuid === entry.user.uuid;
  return entry.rank === viewer.rank && entry.points === viewer.points;
}

/** The tags in order: topic, level, year; the size after them on the quiz page, or alone when there are none. */
export function quizTagList(
  quiz: Pick<ChannelQuiz, 'topic' | 'level' | 'year' | 'question_count' | 'questions' | 'total_seconds'>,
  facts = false,
): string[] {
  const about = [quiz.topic, quiz.level, quiz.year ? String(quiz.year) : null].filter(
    (tag): tag is string => Boolean(tag && tag.trim()),
  );
  const count = quiz.question_count ?? quiz.questions?.length ?? 0;
  const seconds = quiz.total_seconds;
  const size = [
    count > 0 ? `${count} ${count === 1 ? 'question' : 'questions'}` : null,
    typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? `${Math.max(1, Math.ceil(seconds / 60))} min` : null,
  ].filter((tag): tag is string => Boolean(tag));
  return about.length === 0 ? size : facts ? [...about, ...size] : about;
}

/**
 * Where a player studies, short enough for the podium's narrow column
 * (Arthur, 28 October 2026: "the university in the podium is cut off ... Can
 * it be just the campus"): a Law School campus as the part after its dash or
 * comma ("Nigerian Law School – Lagos Campus" is "Lagos Campus"; profiles
 * also spell it "Nigeria Law School"), a university as it is. The rows under
 * the podium keep the whole name.
 */
export function podiumInstitution(institution: string): string {
  const campus = institution.match(/^(?:the\s+)?Nigerian?\s+Law\s+School\s*[,–—-]\s*(.+)$/i)?.[1]?.trim();
  return campus ? campus : institution;
}
