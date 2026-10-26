import { apiClient } from './client';
import type { SubmitFeedbackData, FeedbackResponse, QuizQuestionFeedbackBody } from '@/types/feedback';

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
};
