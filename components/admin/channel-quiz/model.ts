import type { AdminChannelQuizAttemptListParams, AdminChannelQuizListParams } from '@/types/admin-channel-quizzes';

/**
 * The admin "Explore quizzes (new)" tab: the rules its pages share, kept pure so
 * each is tested (model.test.ts). Stay's pick, option A (30 October 2026,
 * thread e80a3d30): one admin Quiz area with two tabs, "Study quizzes (old)"
 * and "Explore quizzes (new)"; the new tab reads the channel quiz plays from
 * `admin/channel-quizzes` (Backend 8e877190, routes 9c0d50da).
 */

export const EXPLORE_BASE = '/admin/quiz/explore';
/** Where the old tab goes: its sessions list, the old pages' nearest match to Plays. */
export const STUDY_HOME = '/admin/quiz/sessions';

export type QuizAreaTab = 'study' | 'explore';
export type ExploreSection = 'plays' | 'quizzes' | 'totals';

/** Which of the area's two tabs a quiz page is under. */
export function quizAreaTab(pathname: string): QuizAreaTab {
  return pathname === EXPLORE_BASE || pathname.startsWith(`${EXPLORE_BASE}/`) ? 'explore' : 'study';
}

/** Which of the new tab's three views a page belongs to; one play counts as Plays, one quiz as Quizzes. */
export function exploreSection(pathname: string): ExploreSection {
  if (pathname.startsWith(`${EXPLORE_BASE}/quizzes`)) return 'quizzes';
  if (pathname.startsWith(`${EXPLORE_BASE}/totals`)) return 'totals';
  return 'plays';
}

export const EXPLORE_SECTIONS: readonly { id: ExploreSection; label: string; href: string }[] = [
  { id: 'plays', label: 'Plays', href: EXPLORE_BASE },
  { id: 'quizzes', label: 'Quizzes', href: `${EXPLORE_BASE}/quizzes` },
  { id: 'totals', label: 'Totals', href: `${EXPLORE_BASE}/totals` },
];

export const playHref = (uuid: string): string => `${EXPLORE_BASE}/plays/${uuid}`;
export const quizHref = (uuid: string): string => `${EXPLORE_BASE}/quizzes/${uuid}`;
/** The plays list filtered to one quiz or one player (by uuid; no name or email search in v1). */
export const playsForQuizHref = (uuid: string): string => `${EXPLORE_BASE}?quiz=${encodeURIComponent(uuid)}`;
export const playsForPlayerHref = (uuid: string): string => `${EXPLORE_BASE}?user=${encodeURIComponent(uuid)}`;

// ─── Filters in the URL ──────────────────────────────────────────────────────

export type PlayStatusFilter = 'finished' | 'unfinished';

export interface PlayListParams {
  page: number;
  per_page: number;
  quiz?: string;
  user?: string;
  status?: PlayStatusFilter;
  counts_for_board?: boolean;
  date_from?: string;
  date_to?: string;
}

const PER_PAGE_DEFAULT = 15;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const pageOf = (raw: string | null): number => Math.max(1, Number(raw) || 1);
const perPageOf = (raw: string | null): number => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : PER_PAGE_DEFAULT;
};
const uuidOf = (raw: string | null): string | undefined => (raw && UUID.test(raw) ? raw : undefined);
const dayOf = (raw: string | null): string | undefined => (raw && DAY.test(raw) ? raw : undefined);
const flagOf = (raw: string | null): boolean | undefined => (raw === '1' ? true : raw === '0' ? false : undefined);

/** The plays list's filters from the URL; anything malformed is dropped rather than sent. */
export function parsePlayParams(search: URLSearchParams): PlayListParams {
  const status = search.get('status');
  return {
    page: pageOf(search.get('page')),
    per_page: perPageOf(search.get('per_page')),
    quiz: uuidOf(search.get('quiz')),
    user: uuidOf(search.get('user')),
    status: status === 'finished' || status === 'unfinished' ? status : undefined,
    counts_for_board: flagOf(search.get('counts_for_board')),
    date_from: dayOf(search.get('date_from')),
    date_to: dayOf(search.get('date_to')),
  };
}

export type QuizSort = 'plays' | 'players' | 'created_at' | 'last_played';
/** The server sorts by `created_at` when no sort is sent, so Newest is the default shown. */
export const DEFAULT_QUIZ_SORT: QuizSort = 'created_at';
export const QUIZ_SORTS: readonly { id: QuizSort; label: string }[] = [
  { id: 'created_at', label: 'Newest' },
  { id: 'last_played', label: 'Last played' },
  { id: 'plays', label: 'Most plays' },
  { id: 'players', label: 'Most players' },
];

export interface QuizListParams {
  page: number;
  per_page: number;
  search?: string;
  visibility?: string;
  year?: number;
  level?: string;
  sort?: QuizSort;
  include_deleted?: boolean;
}

/** The quizzes list's filters from the URL. */
export function parseQuizParams(search: URLSearchParams): QuizListParams {
  const sort = search.get('sort');
  const year = Number(search.get('year'));
  const text = search.get('search')?.trim();
  return {
    page: pageOf(search.get('page')),
    per_page: perPageOf(search.get('per_page')),
    search: text ? text.slice(0, 100) : undefined,
    visibility: search.get('visibility') || undefined,
    year: Number.isInteger(year) && year > 0 ? year : undefined,
    level: search.get('level') || undefined,
    sort: QUIZ_SORTS.some((s) => s.id === sort) ? (sort as QuizSort) : undefined,
    include_deleted: search.get('include_deleted') === '1' ? true : undefined,
  };
}

/**
 * The URL after a filter change: empty values come out, and the page goes back
 * to 1 unless the change is the page itself (as the sessions page does).
 */
export function nextSearch(
  current: URLSearchParams,
  updates: Record<string, string | number | boolean | undefined>,
  resetPage = true,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === '') next.delete(key);
    else next.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  if (resetPage) next.delete('page');
  return next.toString();
}

/** The query the API takes for a play filter: booleans as 1 or 0, nothing empty. */
export function playQuery(params: PlayListParams): AdminChannelQuizAttemptListParams {
  const out: AdminChannelQuizAttemptListParams = { page: params.page, per_page: params.per_page };
  if (params.quiz) out.quiz = params.quiz;
  if (params.user) out.user = params.user;
  if (params.status) out.status = params.status;
  if (params.counts_for_board !== undefined) out.counts_for_board = params.counts_for_board ? 1 : 0;
  if (params.date_from) out.date_from = params.date_from;
  if (params.date_to) out.date_to = params.date_to;
  return out;
}

/** The query the API takes for a quiz filter. */
export function quizQuery(params: QuizListParams): AdminChannelQuizListParams {
  const out: AdminChannelQuizListParams = { page: params.page, per_page: params.per_page };
  if (params.search) out.search = params.search;
  if (params.visibility) out.visibility = params.visibility;
  if (params.year) out.year = params.year;
  if (params.level) out.level = params.level;
  if (params.sort) out.sort = params.sort;
  if (params.include_deleted) out.include_deleted = 1;
  return out;
}

// ─── What a row says ─────────────────────────────────────────────────────────

/** A percent from the API (a number, or a decimal string like "33.33"), rounded; `—` for none. */
export function percentLabel(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? `${Math.round(n)}%` : '—';
}

/** A play's length; `—` while it isn't finished (the server sends null then). */
export function durationLabel(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Finished or not, from the play's `finished_at`. */
export function playStatusLabel(finishedAt: string | null | undefined): 'Finished' | 'Not finished' {
  return finishedAt ? 'Finished' : 'Not finished';
}

/** Right of scored, as the score column shows it, e.g. "7/10"; `—` while the play isn't finished. */
export function rightOfScored(correct: number | null, scored: number): string {
  return correct === null ? '—' : `${correct}/${scored}`;
}

/** A question in one play, as the play page says it. */
export type AnswerOutcome = 'removed' | 'unanswered' | 'right' | 'wrong';

export function answerOutcome(question: { removed: boolean; answered: boolean; is_correct: boolean | null }): AnswerOutcome {
  if (question.removed) return 'removed';
  if (!question.answered) return 'unanswered';
  return question.is_correct ? 'right' : 'wrong';
}

export const ANSWER_OUTCOME_LABELS: Readonly<Record<AnswerOutcome, string>> = {
  removed: 'Question removed',
  unanswered: 'Not answered',
  right: 'Right',
  wrong: 'Wrong',
};

/** A count with its word, singular for one: "1 play", "3 plays", "1 quiz", "2 quizzes". */
export function countLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** A response time in ms, as "4.2s"; `—` for none. */
export function responseTimeLabel(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}
