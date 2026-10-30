import { apiClient } from './client';
import type {
  AdminChannelQuiz,
  AdminChannelQuizAttempt,
  AdminChannelQuizAttemptDetail,
  AdminChannelQuizAttemptListParams,
  AdminChannelQuizDetail,
  AdminChannelQuizListParams,
  AdminChannelQuizOne,
  AdminChannelQuizPage,
  AdminChannelQuizTotals,
  AdminChannelQuizTotalsParams,
  AdminChannelQuizUserPage,
} from '@/types/admin-channel-quizzes';

/**
 * Admin "Explore quizzes (new)": the channel quiz plays, read only
 * (`/api/admin/channel-quizzes/*`, `role:admin`; Backend 8e877190, routes
 * 9c0d50da). The (admin) layout's AdminGuard gates the UI.
 */
export const adminChannelQuizzesApi = {
  listAttempts: async (params: AdminChannelQuizAttemptListParams = {}): Promise<AdminChannelQuizPage<AdminChannelQuizAttempt>> => {
    const response = await apiClient.get<AdminChannelQuizPage<AdminChannelQuizAttempt>>('/admin/channel-quizzes/attempts', { params });
    return response.data;
  },

  getAttempt: async (uuid: string): Promise<AdminChannelQuizOne<AdminChannelQuizAttemptDetail>> => {
    const response = await apiClient.get<AdminChannelQuizOne<AdminChannelQuizAttemptDetail>>(`/admin/channel-quizzes/attempts/${uuid}`);
    return response.data;
  },

  listQuizzes: async (params: AdminChannelQuizListParams = {}): Promise<AdminChannelQuizPage<AdminChannelQuiz>> => {
    const response = await apiClient.get<AdminChannelQuizPage<AdminChannelQuiz>>('/admin/channel-quizzes', { params });
    return response.data;
  },

  getQuiz: async (uuid: string): Promise<AdminChannelQuizOne<AdminChannelQuizDetail>> => {
    const response = await apiClient.get<AdminChannelQuizOne<AdminChannelQuizDetail>>(`/admin/channel-quizzes/${uuid}`);
    return response.data;
  },

  getTotals: async (params: AdminChannelQuizTotalsParams = {}): Promise<AdminChannelQuizOne<AdminChannelQuizTotals>> => {
    const response = await apiClient.get<AdminChannelQuizOne<AdminChannelQuizTotals>>('/admin/channel-quizzes/totals', { params });
    return response.data;
  },

  /** One person's plays with their summary; `404` for an unknown user. */
  listUserAttempts: async (userUuid: string, params: AdminChannelQuizAttemptListParams = {}): Promise<AdminChannelQuizUserPage> => {
    const response = await apiClient.get<AdminChannelQuizUserPage>(`/admin/users/${userUuid}/channel-quizzes`, { params });
    return response.data;
  },
};
