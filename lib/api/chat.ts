import { apiClient } from './client';
import type { ChatStartRequest, ChatStartResponse } from '@/types/chat';

/**
 * Chat API service
 */
export const chatApi = {
  /**
   * Start a new chat message with streaming enabled
   */
  start: async (params: ChatStartRequest): Promise<ChatStartResponse> => {
    const response = await apiClient.post<ChatStartResponse>('/chat', params);
    return response.data;
  },
};
