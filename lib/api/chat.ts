import { apiClient } from './client';
import type { ChatStartRequest, ChatStartResponse, ConversationResponse } from '@/types/chat';

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

  /**
   * Get a conversation with all its messages
   */
  getConversation: async (id: number): Promise<ConversationResponse> => {
    const response = await apiClient.get<ConversationResponse>(`/conversations/${id}`);
    return response.data;
  },
};
