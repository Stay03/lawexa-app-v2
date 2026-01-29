import { apiClient } from './client';
import type {
  ChatStartRequest,
  ChatStartResponse,
  ConversationResponse,
  ConversationsListResponse,
  ListConversationsParams
} from '@/types/chat';

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
  getConversation: async (id: string): Promise<ConversationResponse> => {
    const response = await apiClient.get<ConversationResponse>(`/conversations/${id}`);
    return response.data;
  },

  /**
   * List all conversations for the authenticated user
   */
  listConversations: async (params?: ListConversationsParams): Promise<ConversationsListResponse> => {
    const response = await apiClient.get<ConversationsListResponse>('/conversations', { params });
    return response.data;
  },
};
