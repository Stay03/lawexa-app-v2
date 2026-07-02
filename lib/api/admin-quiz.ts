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
  AdminQuizBatchListParams,
  AdminQuizBatchListResponse,
  AdminQuizBatchResponse,
  AdminQuizBatchSummaryResponse,
  AdminQuizPeriodParams,
  AdminQuizAnalyticsResponse,
  AdminQuizMatchingHealthResponse,
  AdminUserQuizProfileResponse,
  AdminQuizSessionListParams,
  AdminQuizSessionListResponse,
  AdminQuizSessionResponse,
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

  /**
   * Quiz questions generated for a specific course (by slug). Same shape and
   * filters as listQuestions, pre-scoped to the course. Note: this endpoint
   * validates `per_page` (1–100) and rejects out-of-range values with 422.
   */
  listCourseQuestions: async (
    slug: string,
    params: AdminQuizQuestionListParams = {}
  ): Promise<AdminQuizQuestionListResponse> => {
    const response = await apiClient.get<AdminQuizQuestionListResponse>(
      `/admin/courses/${slug}/quiz-questions`,
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

  deleteQuestion: async (
    uuid: string,
    body: AdminQuizModerationBody = {}
  ): Promise<AdminQuizDeleteResponse> => {
    const response = await apiClient.delete<AdminQuizDeleteResponse>(
      `/admin/quiz/questions/${uuid}`,
      { data: body }
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

  // ---- Generation observability ----

  listBatches: async (
    params: AdminQuizBatchListParams = {}
  ): Promise<AdminQuizBatchListResponse> => {
    const response = await apiClient.get<AdminQuizBatchListResponse>(
      '/admin/quiz/batches',
      { params }
    );
    return response.data;
  },

  getBatch: async (uuid: string): Promise<AdminQuizBatchResponse> => {
    const response = await apiClient.get<AdminQuizBatchResponse>(
      `/admin/quiz/batches/${uuid}`
    );
    return response.data;
  },

  /** Period-aware generation totals + coverage. */
  getBatchSummary: async (
    params: AdminQuizPeriodParams = {}
  ): Promise<AdminQuizBatchSummaryResponse> => {
    const response = await apiClient.get<AdminQuizBatchSummaryResponse>(
      '/admin/quiz/batches/summary',
      { params }
    );
    return response.data;
  },

  // ---- Analytics, matching-health, per-user (Phase 5) ----

  /** Period-aware usage dashboard (stat cards + charts + tables). */
  getAnalytics: async (
    params: AdminQuizPeriodParams = {}
  ): Promise<AdminQuizAnalyticsResponse> => {
    const response = await apiClient.get<AdminQuizAnalyticsResponse>(
      '/admin/quiz/analytics',
      { params }
    );
    return response.data;
  },

  /** Period-aware serve stats + all-time bank/topic coverage. */
  getMatchingHealth: async (
    params: AdminQuizPeriodParams = {}
  ): Promise<AdminQuizMatchingHealthResponse> => {
    const response = await apiClient.get<AdminQuizMatchingHealthResponse>(
      '/admin/quiz/matching-health',
      { params }
    );
    return response.data;
  },

  /** One student's quiz profile by user uuid (`404` if unknown). */
  getUserQuizProfile: async (
    userUuid: string
  ): Promise<AdminUserQuizProfileResponse> => {
    const response = await apiClient.get<AdminUserQuizProfileResponse>(
      `/admin/users/${userUuid}/quiz`
    );
    return response.data;
  },

  // ---- Sessions (admin read access) ----

  /** Every user's sessions, filterable by user/status/date (rows include `user`). */
  listSessions: async (
    params: AdminQuizSessionListParams = {}
  ): Promise<AdminQuizSessionListResponse> => {
    const response = await apiClient.get<AdminQuizSessionListResponse>(
      '/admin/quiz/sessions',
      { params }
    );
    return response.data;
  },

  /** One user's sessions (rows omit `user`). `404` for an unknown user. */
  listUserSessions: async (
    userUuid: string,
    params: AdminQuizSessionListParams = {}
  ): Promise<AdminQuizSessionListResponse> => {
    const response = await apiClient.get<AdminQuizSessionListResponse>(
      `/admin/users/${userUuid}/quiz/sessions`,
      { params }
    );
    return response.data;
  },

  /** One session's answer-by-answer detail (any user, even an active session). */
  getSession: async (
    sessionUuid: string
  ): Promise<AdminQuizSessionResponse> => {
    const response = await apiClient.get<AdminQuizSessionResponse>(
      `/admin/quiz/sessions/${sessionUuid}`
    );
    return response.data;
  },
};
