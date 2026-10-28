/**
 * Feedback type definitions for Phase 13 API
 */

// Content types that can have feedback attached
export type FeedbackContentType = 'case' | 'note' | 'statute';

// A single feedback category option for the checkbox list
export interface FeedbackCategory {
  id: string;
  label: string;
}

// User summary within a feedback response
export interface FeedbackUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

// Attachment within a feedback response
export interface FeedbackAttachment {
  id: number;
  url: string;
  filename: string;
  mime_type: string;
  size: number;
}

// POST /api/feedback request payload (before FormData conversion)
export interface SubmitFeedbackData {
  feedback_text: string;
  content_type?: FeedbackContentType;
  content_id?: number;
  attachments?: File[];
}

/** The reasons a quiz question may be reported for (Backend, 26 October 2026). */
export type QuizFeedbackReason = 'wrong_answer' | 'unclear_question' | 'typo' | 'outdated_law' | 'other';

/**
 * POST /api/feedback for one quiz question (Backend, 26 October 2026): a
 * practice question or an authored/AI quiz's by `content_uuid`, a quiz card in
 * a chat answer by the answer's `content_id`. `feedback_text` is optional when
 * a reason is given.
 */
export interface QuizQuestionFeedbackBody {
  feedback_text?: string;
  content_type: 'quiz_question' | 'channel_quiz_question' | 'message';
  content_uuid?: string;
  content_id?: number;
  context: {
    reasons: QuizFeedbackReason[];
    quiz_uuid?: string;
    session_uuid?: string;
    attempt_uuid?: string;
    /** The question's 0-based place, as the API gives it. */
    position?: number;
    /** A chat quiz card's 0-based place in its answer. */
    quiz_index?: number;
    question_text: string;
    chosen_option?: string;
    correct_option?: string;
  };
}

// POST /api/feedback response
export interface FeedbackResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    uuid: string;
    user: FeedbackUser;
    feedback_text: string;
    content_type: string | null;
    content_id: number | null;
    content: Record<string, unknown> | null;
    status: string;
    status_label: string;
    attachments: FeedbackAttachment[];
    resolved_by: FeedbackUser | null;
    resolved_at: string | null;
    moved_to_issues: boolean;
    created_at: string;
    updated_at: string;
  };
}

// Props for the FeedbackDialog context (passed from page)
export interface FeedbackContext {
  contentType: FeedbackContentType;
  contentId: number;
  contentTitle: string;
}

/* ── Chat rating: "How is Lawexa doing?" (Arthur, 19 October 2026) ──────── */

/** The banner's three answers. */
export type ChatRating = 'poor' | 'fine' | 'great';

/** Why an answer was poor; `text` goes with `something_else` only. */
export type ChatRatingReason =
  | 'wrong_citation'
  | 'missed_case_or_statute'
  | 'outdated_law'
  | 'didnt_answer'
  | 'too_slow'
  | 'something_else';

/** The moment that brought the banner up. */
/** `plan_ended`: the banner asks once on the first chat after a paid plan
 *  ran out, with no moment needed (Arthur, 28 October 2026, "B plus A"). */
export type ChatRatingTrigger = 'copy' | 'cited_case' | 'regenerate' | 'plan_ended';

/** POST /api/feedback, as a chat rating. */
export interface SubmitChatRatingData {
  rating: ChatRating;
  reason?: ChatRatingReason;
  text?: string;
  conversationId: string;
  /** The rated answer's saved id; never a question's. Omitted when unknown. */
  messageId: number | null;
  trigger: ChatRatingTrigger;
}

/** GET /api/feedback/chat-prompt. `next_at` is null when eligible, and also
 *  when the reader is too new to be asked (check again next session). */
export interface ChatPromptEligibility {
  eligible: boolean;
  next_at: string | null;
  /** `plan_ended` when the banner asks because a paid plan ran out (once,
   *  outside the 14 days); null otherwise. Absent from an older server. */
  moment?: 'plan_ended' | null;
}

/** "Why are you cancelling?" (POST /subscriptions/cancellation-feedback). */
export type CancellationReason = 'too_expensive' | 'not_used_enough' | 'missing_something' | 'other';

export interface CancellationFeedbackBody {
  reason: CancellationReason;
  /** Optional, and required for `other`; at most 2,000 characters. */
  details?: string;
}

/** One row of GET /admin/feedback/cancellations. */
export interface AdminCancellationFeedback {
  id: number;
  reason: CancellationReason;
  details: string | null;
  created_at: string;
  user: { id: number; name: string; email: string };
  plan: { id: number; name: string } | null;
  subscription: { id: number; status: string; cancelled_at: string | null; ends_at: string | null };
}

/** GET /admin/feedback/cancellations/summary. */
export interface AdminCancellationSummary {
  total: number;
  reasons: Record<CancellationReason, number>;
}
