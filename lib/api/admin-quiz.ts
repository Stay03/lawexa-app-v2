import { apiClient } from './client';
import type {
  AdminQuizQuestionListParams,
  AdminQuizQuestionListResponse,
  AdminQuizQuestionResponse,
  UpdateAdminQuizQuestionData,
  AdminQuizModerationBody,
  AdminQuizBulkData,
  AdminQuizBulkResponse,
  AdminQuizDeleteResponse,
} from '@/types/admin-quiz';

/**
 * Admin Quiz — question-moderation API service (`/api/admin/quiz/questions/*`).
 * Requires `role:admin`; the (admin) layout's AdminGuard gates the UI.
 */
export const adminQuizApi = {
  listQuestions: async (
    params: AdminQuizQuestionListParams = {}
  ): Promise<AdminQuizQuestionListResponse> => {
    const response = await apiClient.get<AdminQuizQuestionListResponse>(
      '/admin/quiz/questions',
      { params }
    );
    return response.data;
  },

  getQuestion: async (uuid: string): Promise<AdminQuizQuestionResponse> => {
    const response = await apiClient.get<AdminQuizQuestionResponse>(
      `/admin/quiz/questions/${uuid}`
    );
    return response.data;
  },

  updateQuestion: async (
    uuid: string,
    data: UpdateAdminQuizQuestionData
  ): Promise<AdminQuizQuestionResponse> => {
    const response = await apiClient.patch<AdminQuizQuestionResponse>(
      `/admin/quiz/questions/${uuid}`,
      data
    );
    return response.data;
  },

  approveQuestion: async (
    uuid: string,
    body: AdminQuizModerationBody = {}
  ): Promise<AdminQuizQuestionResponse> => {
    const response = await apiClient.post<AdminQuizQuestionResponse>(
      `/admin/quiz/questions/${uuid}/approve`,
      body
    );
    return response.data;
  },

  archiveQuestion: async (
    uuid: string,
    body: AdminQuizModerationBody = {}
  ): Promise<AdminQuizQuestionResponse> => {
    const response = await apiClient.post<AdminQuizQuestionResponse>(
      `/admin/quiz/questions/${uuid}/archive`,
      body
    );
    return response.data;
  },

  restoreQuestion: async (
    uuid: string,
    body: AdminQuizModerationBody = {}
  ): Promise<AdminQuizQuestionResponse> => {
    const response = await apiClient.post<AdminQuizQuestionResponse>(
      `/admin/quiz/questions/${uuid}/restore`,
      body
    );
    return response.data;
  },

  deleteQuestion: async (uuid: string): Promise<AdminQuizDeleteResponse> => {
    const response = await apiClient.delete<AdminQuizDeleteResponse>(
      `/admin/quiz/questions/${uuid}`
    );
    return response.data;
  },

  /** Bulk approve/archive by question uuid (1–200). */
  bulk: async (data: AdminQuizBulkData): Promise<AdminQuizBulkResponse> => {
    const response = await apiClient.post<AdminQuizBulkResponse>(
      '/admin/quiz/questions/bulk',
      data
    );
    return response.data;
  },
};
