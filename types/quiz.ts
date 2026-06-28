/**
 * Quiz Mode type definitions.
 *
 * Phase 0 covers the **student** (player) contract only — see
 * docs/quiz/main-plan.md and docs/quiz/phases/phase-0-foundation/plan.md.
 * Admin-console types (moderation, generation, analytics) are added by their
 * own phases (3–5) to avoid speculative shapes.
 *
 * Conventions from the backend doc:
 * - Every response is the envelope `{ success, message, data }`; list responses
 *   add `pagination` + `links`.
 * - Sessions and questions are addressed by `uuid`; options by numeric `id`.
 * - Decimal fields (`score_percentage`) arrive as JSON **strings** — `parseFloat`
 *   them before doing math.
 */

import type { PaginationMeta, PaginationLinks } from './case';

// ----------------------------------------------------------------------------
// Shared enums / scalars
// ----------------------------------------------------------------------------

/** Session lifecycle. `completed` = user ended; `abandoned` = auto-expired (~24h). */
export type QuizSessionStatus = 'active' | 'completed' | 'abandoned';

/** Why a question was chosen for the user. Recorded for analytics; the player UI need not show it. */
export type QuizSourceTier = 'own' | 'same_topic_other' | 'widened' | 'recycled';

/** Difficulty 1–5, paired with a human label (`difficulty_label`). */
export type QuizDifficulty = 1 | 2 | 3 | 4 | 5;

// ----------------------------------------------------------------------------
// Served question (answers hidden)
// ----------------------------------------------------------------------------

/** An option as served during play — never carries `is_correct`/`explanation`. */
export interface QuizOption {
  id: number;
  position: number;
  option_text: string;
}

/** A question as served during play (answer hidden). */
export interface QuizQuestion {
  uuid: string;
  question_text: string;
  difficulty: QuizDifficulty;
  difficulty_label: string;
  options: QuizOption[];
}

/** The session object returned across start / current / answer / list / results. */
export interface QuizSession {
  uuid: string;
  status: QuizSessionStatus;
  served_count: number;
  answered_count: number;
  correct_count: number;
  /** Decimal string (e.g. "33.33") or null before the first answer. `parseFloat` to use. */
  score_percentage: string | null;
  started_at: string;
  /** Present on list / start / answer; omitted from the results payload. */
  last_activity_at?: string;
  completed_at: string | null;
}

/** The currently-served question wrapper (sequence + provenance + the question). */
export interface QuizServedQuestion {
  sequence: number;
  source_tier: QuizSourceTier;
  served_at: string;
  question: QuizQuestion;
}

/**
 * Payload of start / resume / current / answer.
 * `question` is `null` only on cold start (empty bank) — that is not an error.
 */
export interface QuizSessionData {
  session: QuizSession;
  question: QuizServedQuestion | null;
}

// ----------------------------------------------------------------------------
// Results (answers revealed — only after the session has ended)
// ----------------------------------------------------------------------------

/** An option in the results view, with correctness revealed. */
export interface QuizResultOption extends QuizOption {
  is_correct: boolean;
}

/** A question in the results view, with explanation + correct option revealed. */
export interface QuizResultQuestion {
  uuid: string;
  question_text: string;
  explanation: string | null;
  difficulty: QuizDifficulty;
  difficulty_label: string;
  options: QuizResultOption[];
}

/** One answered question in the results review. */
export interface QuizResultItem {
  sequence: number;
  source_tier: QuizSourceTier;
  /** The frozen grade for this answer. */
  was_correct: boolean;
  /** The option the user picked. */
  selected_option_id: number;
  time_spent_ms: number;
  /** True if an admin edited the question after this answer — show an "updated" note. */
  edited_since_answered: boolean;
  /** `null` if the source question was removed/archived — show a "[removed question]" placeholder. */
  question: QuizResultQuestion | null;
}

/** Payload of GET /results. Size the review by `session.answered_count`, not `served_count`. */
export interface QuizResultsData {
  session: QuizSession;
  questions: QuizResultItem[];
}

// ----------------------------------------------------------------------------
// Topics (optional picker)
// ----------------------------------------------------------------------------

/** A recently-studied topic. List is recency-ordered; sort by `rank` for primary-first. */
export interface QuizTopic {
  topic: string;
  topic_key: string;
  rank: number;
  course: string | null;
}

// ----------------------------------------------------------------------------
// Request params / bodies
// ----------------------------------------------------------------------------

/** Query params for GET /api/quizzes (my sessions). */
export interface QuizSessionListParams {
  page?: number;
  /** 1–100, default 15. */
  per_page?: number;
}

/** Body for POST /api/quizzes (start or resume). */
export interface StartQuizSessionData {
  /** Optional topic seed. Unknown topics are harmless — the ladder just widens. */
  topic?: string;
}

/** Body for POST /api/quizzes/{uuid}/answers. */
export interface SubmitQuizAnswerData {
  /** Must be an option `id` of the current served question. */
  option_id: number;
}

// ----------------------------------------------------------------------------
// Response envelopes
// ----------------------------------------------------------------------------

/** GET /api/quizzes — paginated past sessions. */
export interface QuizSessionListResponse {
  success: boolean;
  message: string;
  data: QuizSession[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

/** Start / resume (POST), current (GET /{uuid}), and answer (POST /answers) all share this. */
export interface QuizSessionResponse {
  success: boolean;
  message: string;
  data: QuizSessionData;
}

/**
 * POST /api/quizzes/{uuid}/end — the finalized session, no question.
 * Confirmed by backend (2026-06-28): the session is wrapped under `data.session`,
 * same shape as start/answer but with no `question` key.
 */
export interface QuizEndResponse {
  success: boolean;
  message: string;
  data: { session: QuizSession };
}

/** GET /api/quizzes/{uuid}/results — answers revealed (session must be ended). */
export interface QuizResultsResponse {
  success: boolean;
  message: string;
  data: QuizResultsData;
}

/** GET /api/quizzes/topics. */
export interface QuizTopicsResponse {
  success: boolean;
  message: string;
  data: QuizTopic[];
}

// ----------------------------------------------------------------------------
// My stats (GET /api/quizzes/stats) — the student's own progress
// ----------------------------------------------------------------------------
//
// Unlike the rest of the student API, these aggregates are PLAIN NUMBERS (not
// string-decimals), and the rate fields may be null (and score_trend []) before
// there is enough data.

/** One point on the score-trend chart (last 10 ended sessions, oldest→newest). */
export interface QuizScoreTrendPoint {
  completed_at: string;
  score_percentage: number;
}

export interface QuizStatsSessions {
  total: number;
  active: number;
  completed: number;
  abandoned: number;
  last_active_at: string | null;
  served: number;
  answered: number;
  correct: number;
}

export interface QuizStatsPerformance {
  /** Mean of finalized session scores; null before any are completed. */
  avg_score: number | null;
  /** correct ÷ answered, as a %; null if nothing answered yet. */
  accuracy: number | null;
  /** Mean think-time over answered questions, in ms; null if none. */
  avg_time_per_question_ms: number | null;
  score_trend: QuizScoreTrendPoint[];
}

export interface QuizStatsEngagement {
  completed: number;
  auto_abandoned: number;
  /** completed ÷ (completed + abandoned), as a %; null if neither. */
  completion_rate: number | null;
}

export interface QuizStatsData {
  sessions: QuizStatsSessions;
  performance: QuizStatsPerformance;
  engagement: QuizStatsEngagement;
}

/** GET /api/quizzes/stats. */
export interface QuizStatsResponse {
  success: boolean;
  message: string;
  data: QuizStatsData;
}
