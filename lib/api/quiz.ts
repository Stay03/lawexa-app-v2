import { apiClient } from './client';
import type {
  QuizSessionListParams,
  QuizSessionListResponse,
  StartQuizSessionData,
  QuizSessionResponse,
  SubmitQuizAnswerData,
  QuizEndResponse,
  QuizResultsResponse,
  QuizTopicsResponse,
  QuizStatsResponse,
} from '@/types/quiz';

/**
 * Quiz Mode — student (player) API service for `/api/quizzes/*`.
 *
 * Every endpoint needs a verified-email Bearer session (the shared `apiClient`
 * attaches the token). The player UI is additionally gated to soft-launch roles
 * via `canAccessQuizPlayer` (see lib/utils/quiz-access.ts).
 */
export const quizApi = {
  /** List my past quiz sessions (paginated, newest first). */
  listSessions: async (
    params: QuizSessionListParams = {}
  ): Promise<QuizSessionListResponse> => {
    const response = await apiClient.get<QuizSessionListResponse>('/quizzes', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
      },
    });
    return response.data;
  },

  /**
   * Start a new session, or resume the open one — the canonical "open quiz"
   * action. `201` = new session with the first question served; `200` = resumed
   * with the existing current question.
   */
  startSession: async (
    data: StartQuizSessionData = {}
  ): Promise<QuizSessionResponse> => {
    const response = await apiClient.post<QuizSessionResponse>('/quizzes', {
      topic: data.topic || undefined,
    });
    return response.data;
  },

  /** Get a session's current state + current unanswered question (rehydrate the play screen). */
  getSession: async (sessionUuid: string): Promise<QuizSessionResponse> => {
    const response = await apiClient.get<QuizSessionResponse>(
      `/quizzes/${sessionUuid}`
    );
    return response.data;
  },

  /** Submit an answer; returns the updated live score + the next question (answer still hidden). */
  submitAnswer: async (
    sessionUuid: string,
    data: SubmitQuizAnswerData
  ): Promise<QuizSessionResponse> => {
    const response = await apiClient.post<QuizSessionResponse>(
      `/quizzes/${sessionUuid}/answers`,
      data
    );
    return response.data;
  },

  /** End the session and finalize the score. Idempotent (safe to call twice). */
  endSession: async (sessionUuid: string): Promise<QuizEndResponse> => {
    const response = await apiClient.post<QuizEndResponse>(
      `/quizzes/${sessionUuid}/end`
    );
    return response.data;
  },

  /** Results with answers + explanations revealed. Requires the session to be ended (else `409`). */
  getResults: async (sessionUuid: string): Promise<QuizResultsResponse> => {
    const response = await apiClient.get<QuizResultsResponse>(
      `/quizzes/${sessionUuid}/results`
    );
    return response.data;
  },

  /** Recent distinct topics for the optional topic picker. */
  getTopics: async (): Promise<QuizTopicsResponse> => {
    const response = await apiClient.get<QuizTopicsResponse>('/quizzes/topics');
    return response.data;
  },

  /** The authenticated student's own progress stats (for the reports view). */
  getStats: async (): Promise<QuizStatsResponse> => {
    const response = await apiClient.get<QuizStatsResponse>('/quizzes/stats');
    return response.data;
  },
};
