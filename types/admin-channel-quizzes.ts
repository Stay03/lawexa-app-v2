/**
 * Admin "Explore quizzes (new)": the channel quiz plays, read only, under
 * `/api/admin/channel-quizzes` and `/api/admin/users/{uuid}/channel-quizzes`
 * (Backend 8e877190, routes 9c0d50da; Stay's option A, thread e80a3d30).
 * People appear by uuid and name only, never by id or email.
 */

import type { PaginationLinks, PaginationMeta } from './case';

export interface AdminChannelQuizPerson {
  uuid: string;
  name: string;
}

/** A quiz as a play row names it. */
export interface AdminChannelQuizRef {
  uuid: string;
  title: string;
  visibility: string;
  year: number | null;
  level: string | null;
  topic: string | null;
}

/** A quiz as a play names it; `deleted` once the quiz is soft-deleted. */
export interface AdminChannelQuizPlayQuiz extends AdminChannelQuizRef {
  deleted: boolean;
}

/**
 * One play. While it isn't finished, `finished_at`, `duration_seconds`,
 * `score_percent`, `correct_count` and `points` are null. Percents are numbers
 * (JSON drops a ".0", so 50.0 arrives as 50).
 */
export interface AdminChannelQuizAttempt {
  uuid: string;
  quiz: AdminChannelQuizPlayQuiz | null;
  player: AdminChannelQuizPerson | null;
  question_count: number;
  scored_count: number;
  correct_count: number | null;
  points: number | null;
  score_percent: number | null;
  reveal_mode: string | null;
  counts_for_board: boolean;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
}

/**
 * One question of a play, in order. `answered: false` is a question the player
 * never reached; `removed: true` one since deleted (its `position` and
 * `question` are then null).
 */
export interface AdminChannelQuizAttemptQuestion {
  position: number | null;
  question: string | null;
  answered: boolean;
  chosen: string | null;
  correct_answer: string | null;
  is_correct: boolean | null;
  points: number | null;
  response_ms: number | null;
  answered_at: string | null;
  removed: boolean;
}

export interface AdminChannelQuizAttemptDetail extends AdminChannelQuizAttempt {
  questions: AdminChannelQuizAttemptQuestion[];
}

/** One quiz with its play numbers. The averages count finished plays only. */
export interface AdminChannelQuiz extends AdminChannelQuizRef {
  author: AdminChannelQuizPerson | null;
  question_count: number;
  plays: number;
  finished_plays: number;
  players: number;
  completion_rate: number | null;
  average_score_percent: number | null;
  last_played_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

/** A question's numbers across every play of its quiz, so the hard ones show. */
export interface AdminChannelQuizQuestionStat {
  position: number | null;
  question: string | null;
  answers: number;
  correct: number;
  percent_correct: number | null;
}

export interface AdminChannelQuizDetail extends AdminChannelQuiz {
  questions: AdminChannelQuizQuestionStat[];
}

export interface AdminChannelQuizUserSummary {
  plays: number;
  finished_plays: number;
  average_score_percent: number | null;
  quizzes_made: number;
}

export interface AdminChannelQuizTotalsDay {
  date: string;
  plays: number;
  finished: number;
}

/** Create with Lawexa runs in the range, by status; always all four. */
export interface AdminChannelQuizSourceRuns {
  reading: number;
  writing: number;
  done: number;
  failed: number;
}

export interface AdminChannelQuizTotals {
  date_from: string;
  date_to: string;
  plays: number;
  finished_plays: number;
  players: number;
  completion_rate: number | null;
  average_score_percent: number | null;
  /** Every day of the range, with no gaps. */
  by_day: AdminChannelQuizTotalsDay[];
  quizzes_created: number;
  create_with_lawexa: AdminChannelQuizSourceRuns;
  live_games_finished: number;
}

// ─── Requests and envelopes ──────────────────────────────────────────────────

export interface AdminChannelQuizAttemptListParams {
  page?: number;
  per_page?: number;
  quiz?: string;
  user?: string;
  status?: 'finished' | 'unfinished';
  counts_for_board?: 0 | 1;
  date_from?: string;
  date_to?: string;
}

export interface AdminChannelQuizListParams {
  page?: number;
  per_page?: number;
  search?: string;
  visibility?: string;
  year?: number;
  level?: string;
  sort?: 'plays' | 'players' | 'created_at' | 'last_played';
  include_deleted?: 0 | 1;
}

export interface AdminChannelQuizTotalsParams {
  date_from?: string;
  date_to?: string;
}

/** The old admin lists' envelope (techlead 68d75035, point 2). */
export interface AdminChannelQuizPage<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

export interface AdminChannelQuizOne<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AdminChannelQuizUserPage extends AdminChannelQuizPage<AdminChannelQuizAttempt> {
  summary: AdminChannelQuizUserSummary;
}
