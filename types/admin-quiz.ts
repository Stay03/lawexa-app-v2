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

export interface AdminQuizQuestionListParams {
  status?: QuizQuestionStatus;
  topic_key?: string;
  difficulty?: QuizDifficulty;
  generated_for_user_id?: number;
  source_mode?: QuizSourceMode;
  with_trashed?: boolean;
  date_from?: string;
  date_to?: string;
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
