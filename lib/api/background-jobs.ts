import { apiClient } from './client';
import type { BackgroundJobListResponse, BackgroundJobResponse } from '@/types/background-jobs';

/**
 * Background jobs REST client (Backend's shapes 063d9cc3,
 * docs/api/background-jobs-shapes.md). Like the rest of `lib/api`, every
 * method returns the raw `{ success, message, data }` envelope.
 */
export const backgroundJobsApi = {
  /**
   * The jobs the reader started in this chat, running and ended, oldest
   * first. `404` unless the chat is theirs or a Space chat they are an active
   * member of; never a confidential, channel or Radar chat.
   */
  list: async (conversationUuid: string): Promise<BackgroundJobListResponse> => {
    const response = await apiClient.get<BackgroundJobListResponse>(
      `/conversations/${conversationUuid}/background-jobs`,
    );
    return response.data;
  },

  /**
   * Stop a running job, or one that ended before Lawexa answered it (`wake`
   * pending): Lawexa is then not woken with it. `422` when there is nothing to
   * cancel any more (already cancelled, or Lawexa already answered); `404` for
   * someone else's job or a deleted chat.
   */
  cancel: async (jobUuid: string): Promise<BackgroundJobResponse> => {
    const response = await apiClient.post<BackgroundJobResponse>(`/background-jobs/${jobUuid}/cancel`, {});
    return response.data;
  },
};
