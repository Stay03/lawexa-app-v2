import { apiClient } from './client';
import type { SubmitFeedbackData, FeedbackResponse } from '@/types/feedback';

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
};
