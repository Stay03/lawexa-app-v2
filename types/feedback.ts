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
