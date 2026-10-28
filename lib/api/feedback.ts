import { apiClient } from './client';
import type {
  ChatPromptEligibility,
  FeedbackResponse,
  QuizQuestionFeedbackBody,
  SubmitChatRatingData,
  SubmitFeedbackData,
} from '@/types/feedback';

/**
 * Feedback API service for Phase 13 endpoints
 */
export const feedbackApi = {
  /**
   * Submit feedback with optional attachments
   */
  submit: async (data: SubmitFeedbackData): Promise<FeedbackResponse> => {
    const formData = new FormData();
    formData.append('feedback_text', data.feedback_text);
    if (data.content_type) {
      formData.append('content_type', data.content_type);
    }
    if (data.content_id !== undefined) {
      formData.append('content_id', String(data.content_id));
    }
    if (data.attachments) {
      data.attachments.forEach((file) => {
        formData.append('attachments[]', file);
      });
    }
    const response = await apiClient.post<FeedbackResponse>('/feedback', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * One quiz question's report (Backend, 26 October 2026): JSON, with the
   * question named by `content_uuid` (or a chat answer by `content_id`) and
   * what the reader saw in `context`.
   */
  submitQuizQuestion: async (body: QuizQuestionFeedbackBody): Promise<FeedbackResponse> => {
    const response = await apiClient.post<FeedbackResponse>('/feedback', body);
    return response.data;
  },

  /**
   * A chat rating from the "How is Lawexa doing?" banner. Same endpoint as a
   * report; the rating, reason and trigger are its own fields. A plan_ended
   * ask on a screen with no chat names none (Backend 0c7bb3c2 takes that for
   * trigger plan_ended only).
   */
  submitChatRating: async (data: SubmitChatRatingData): Promise<FeedbackResponse> => {
    const response = await apiClient.post<FeedbackResponse>('/feedback', {
      rating: data.rating,
      ...(data.reason ? { reason: data.reason } : {}),
      ...(data.reason === 'something_else' && data.text ? { text: data.text } : {}),
      ...(data.conversationId !== null ? { content_type: 'conversation', content_id: data.conversationId } : {}),
      ...(data.messageId !== null ? { message_id: data.messageId } : {}),
      trigger: data.trigger,
    });
    return response.data;
  },

  /** Whether the banner may ask this reader now (the 14 days and the new-user rule). */
  chatPrompt: async (): Promise<ChatPromptEligibility> => {
    const response = await apiClient.get<{ data: ChatPromptEligibility }>('/feedback/chat-prompt');
    return response.data.data;
  },

  /** The banner appeared ("shown") or was closed ("closed"): either starts the 14 days. */
  chatPromptSeen: async (action: 'shown' | 'closed'): Promise<void> => {
    await apiClient.post('/feedback/chat-prompt/seen', { action });
  },
};
