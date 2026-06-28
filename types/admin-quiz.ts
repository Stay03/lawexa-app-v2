/**
 * Admin Quiz — question-moderation types (`/api/admin/quiz/questions/*`).
 * Phase 3. Reuses shared pagination + the `QuizDifficulty` scale from the student
 * types; generation/analytics types belong to Phases 4–5.
 */

import type { PaginationMeta, PaginationLinks } from './case';
import type { QuizDifficulty } from './quiz';

/** Servable vs hidden-from-quizzes. */
export type QuizQuestionStatus = 'approved' | 'archived';
/** How a question was generated. */
export type QuizSourceMode = 'content' | 'transcript';

export interface AdminQuizUserRef {
  id: number;
  name: string;
  email?: string;
}

/** A row in the admin questions list (`question_text` truncated to ~140 chars). */
export interface AdminQuizQuestionListItem {
  uuid: string;
  question_text: string;
  topic: string;
  topic_key: string;
  difficulty: QuizDifficulty;
  difficulty_label: string;
  status: QuizQuestionStatus;
  generated_for_user: AdminQuizUserRef | null;
  source_mode: QuizSourceMode;
  served_count: number;
  answered_count: number;
  /** Percentage 0–100, or null when never answered. */
  correct_rate: number | null;
  reviewed_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

/** An option in the admin view — admins see `is_correct`. */
export interface AdminQuizOption {
  id: number;
  position: number;
  option_text: string;
  is_correct: boolean;
}

/** Full question detail (includes soft-deleted). */
export interface AdminQuizQuestionDetail {
  uuid: string;
  question_text: string;
  explanation: string | null;
  difficulty: QuizDifficulty;
  difficulty_label: string;
  topic: string;
  topic_key: string;
  status: QuizQuestionStatus;
  course: string | null;
  generated_for_user: AdminQuizUserRef | null;
  source_conversation: { id: number; uuid: string } | null;
  generation_batch: {
    uuid: string;
    source_mode: QuizSourceMode;
    status: string;
  } | null;
  options: AdminQuizOption[];
  usage: {
    served: number;
    answered: number;
    correct: number;
    correct_rate: number | null;
  };
  moderation: {
    reviewed_by: { id: number; name: string } | null;
    reviewed_at: string | null;
    notes: string | null;
  };
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Sortable columns for the questions list (omit for newest-first default). */
export type AdminQuizQuestionSort =
  | 'served'
  | 'answered'
  | 'correct'
  | 'difficulty'
  | 'created_at'
  | 'reviewed_at';

export interface AdminQuizQuestionListParams {
  status?: QuizQuestionStatus;
  topic_key?: string;
  difficulty?: QuizDifficulty;
  generated_for_user_id?: number;
  source_mode?: QuizSourceMode;
  with_trashed?: boolean;
  date_from?: string;
  date_to?: string;
  sort?: AdminQuizQuestionSort;
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

/** PATCH body — exactly 4 options + a single `correct_index` (0–3). */
export interface UpdateAdminQuizQuestionData {
  question_text: string;
  explanation?: string | null;
  difficulty: QuizDifficulty;
  topic: string;
  options: string[];
  correct_index: number;
  moderation_notes?: string;
}

/** Optional body shared by approve / archive / restore / delete-trail. */
export interface AdminQuizModerationBody {
  moderation_notes?: string;
}

/** Bulk body — `ids` are question **uuids** (1–200). */
export interface AdminQuizBulkData {
  action: 'approve' | 'archive';
  ids: string[];
  moderation_notes?: string;
}

// ---- Response envelopes ----

export interface AdminQuizQuestionListResponse {
  success: boolean;
  message: string;
  data: AdminQuizQuestionListItem[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

export interface AdminQuizQuestionResponse {
  success: boolean;
  message: string;
  data: AdminQuizQuestionDetail;
}

export interface AdminQuizBulkResponse {
  success: boolean;
  message: string;
  data: { affected: number };
}

export interface AdminQuizDeleteResponse {
  success: boolean;
  message: string;
  data: null;
}

// ----------------------------------------------------------------------------
// Generation observability (Phase 4) — batches + summary
// ----------------------------------------------------------------------------

export type QuizBatchStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * Shared period contract for the period-aware admin endpoints (batch summary,
 * analytics, matching-health). Named ranges only — no `30d` shorthand. `date`
 * is required for `period=date`; `start_date`+`end_date` for `period=date_range`.
 */
export type AdminQuizPeriod =
  | 'today'
  | 'last_24_hours'
  | 'date'
  | 'this_week'
  | 'last_7_days'
  | 'this_month'
  | 'last_30_days'
  | 'date_range';

export interface AdminQuizPeriodParams {
  period?: AdminQuizPeriod;
  date?: string;
  start_date?: string;
  end_date?: string;
}

/**
 * A row in the generation-batches list. Numeric/cost fields are nullable —
 * queued / running / skipped / failed batches may not have generated anything yet.
 */
export interface AdminQuizBatchListItem {
  uuid: string;
  user: AdminQuizUserRef | null;
  source_mode: QuizSourceMode;
  status: QuizBatchStatus;
  questions_generated: number | null;
  total_tokens: number | null;
  /** Decimal string, e.g. "0.012345" — parseFloat to use. */
  token_cost: string | null;
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  error: string | null;
}

/** A question produced by a batch (compact). */
export interface AdminQuizBatchQuestionRef {
  uuid: string;
  question_text: string;
  difficulty: QuizDifficulty;
  topic: string;
  status: QuizQuestionStatus;
}

/** Full batch detail — adds the token breakdown, provenance, and its questions. */
export interface AdminQuizBatchDetail extends AdminQuizBatchListItem {
  source_conversation: { id: number; uuid: string } | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  classifier_request_id: string | null;
  questions: AdminQuizBatchQuestionRef[];
}

export interface AdminQuizBatchSummary {
  period: { start: string; end: string };
  totals: {
    batches: number;
    completed: number;
    failed: number;
    running: number;
    skipped: number;
    /** Batches stuck `running` past the stale threshold right now. */
    stuck_now: number;
    success_rate: number;
    questions_generated: number;
    total_tokens: number;
    /** Decimal string. */
    total_cost: string;
    avg_duration_ms: number;
  };
  coverage: { content: number; transcript: number; content_ratio: number };
}

export interface AdminQuizBatchListParams {
  user_id?: number;
  status?: QuizBatchStatus;
  source_mode?: QuizSourceMode;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

export interface AdminQuizBatchListResponse {
  success: boolean;
  message: string;
  data: AdminQuizBatchListItem[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

export interface AdminQuizBatchResponse {
  success: boolean;
  message: string;
  data: AdminQuizBatchDetail;
}

export interface AdminQuizBatchSummaryResponse {
  success: boolean;
  message: string;
  data: AdminQuizBatchSummary;
}

// ----------------------------------------------------------------------------
// Usage analytics + matching-health + per-user profile (Phase 5)
// ----------------------------------------------------------------------------

/** Server-derived chart granularity (echoed only by the analytics endpoint). */
export type AdminQuizGranularity = 'hour' | 'day';

/**
 * A usage stat card: a value plus its prior-period delta. `change_percent` is
 * **null** when there's no baseline to compare against (render as "—").
 */
export interface AdminQuizStatCardData {
  value: number;
  change_percent: number | null;
}

/**
 * A point on a usage time-series. `date` is a `YYYY-MM-DD` string for `day`
 * granularity, or an **integer hour index** (e.g. `1`) for `hour` granularity —
 * format it off the echoed `granularity`, never assume a timestamp.
 */
export interface AdminQuizSessionsPoint {
  date: string | number;
  count: number;
}

export interface AdminQuizAvgScorePoint {
  date: string | number;
  avg_score: number;
}

export interface AdminQuizTopTopic {
  topic_key: string;
  topic: string;
  serves: number;
}

export interface AdminQuizScoreBucket {
  bucket: string;
  count: number;
}

/** `GET /api/admin/quiz/analytics` — period-aware usage dashboard. */
export interface AdminQuizAnalytics {
  period: {
    start: string;
    end: string;
    comparison_start: string;
    comparison_end: string;
  };
  granularity: AdminQuizGranularity;
  stat_cards: {
    sessions_started: AdminQuizStatCardData;
    active_users: AdminQuizStatCardData;
    completed_sessions: AdminQuizStatCardData;
    abandoned_sessions: AdminQuizStatCardData;
    completion_rate: AdminQuizStatCardData;
    avg_score: AdminQuizStatCardData;
    avg_time_per_question_ms: AdminQuizStatCardData;
  };
  charts: {
    sessions_over_time: AdminQuizSessionsPoint[];
    avg_score_over_time: AdminQuizAvgScorePoint[];
  };
  tables: {
    top_topics: AdminQuizTopTopic[];
    score_distribution: AdminQuizScoreBucket[];
  };
}

/** A row in the matching-health topic-coverage table (all-time, not period-bound). */
export interface AdminQuizTopicCoverageRow {
  topic_key: string;
  topic: string;
  questions: number;
  contributors: number;
  cross_user: boolean;
}

/**
 * `GET /api/admin/quiz/matching-health`. Serve stats are period-aware; bank/topic
 * coverage is all-time. The three rates are **null** when there are no serves.
 */
export interface AdminQuizMatchingHealth {
  period: { start: string; end: string };
  stat_cards: {
    total_serves: number;
    tier2_cross_user_rate: number | null;
    recycle_rate: number | null;
    own_rate: number | null;
    bank_size: number;
    topic_coverage: number;
    cross_user_topics: number;
  };
  tier_breakdown: {
    own: number;
    same_topic_other: number;
    widened_own: number;
    widened_other: number;
    recycled: number;
  };
  topic_coverage: AdminQuizTopicCoverageRow[];
}

/** `GET /api/admin/users/{user_uuid}/quiz` — one student's quiz profile. */
export interface AdminUserQuizProfile {
  sessions: {
    total: number;
    active: number;
    completed: number;
    abandoned: number;
    last_active_at: string | null;
    served: number;
    answered: number;
    correct: number;
  };
  performance: {
    avg_score: number | null;
    avg_time_per_question_ms: number | null;
    /** Oldest→newest session scores (plain numbers) for a sparkline. */
    score_trend: number[];
  };
  engagement: {
    completed: number;
    auto_abandoned: number;
    completion_rate: number | null;
  };
  generation: {
    questions: number;
    batches: number;
    completed_batches: number;
    failed_batches: number;
    /** Decimal string (admin-only cost) — parse with `formatTokenCost`. */
    total_cost: string;
    topics: string[];
  };
  topics_quizzed: {
    distinct: number;
    reached_via_cross_user: boolean;
  };
}

// ---- Response envelopes ----

export interface AdminQuizAnalyticsResponse {
  success: boolean;
  message: string;
  data: AdminQuizAnalytics;
}

export interface AdminQuizMatchingHealthResponse {
  success: boolean;
  message: string;
  data: AdminQuizMatchingHealth;
}

export interface AdminUserQuizProfileResponse {
  success: boolean;
  message: string;
  data: AdminUserQuizProfile;
}
