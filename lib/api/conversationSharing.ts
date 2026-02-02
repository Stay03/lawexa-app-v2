import { apiClient } from './client';
import type {
  SharedConversationsResponse,
  TrendingConversationsResponse,
  SharedConversationsParams,
  TrendingConversationsParams,
  ConversationVisibilityResponse,
} from '@/types/chat';

/**
 * Conversation Sharing API service
 */
export const conversationSharingApi = {
  /**
   * Publish a conversation (make it public)
   */
  publish: async (conversationId: string): Promise<ConversationVisibilityResponse> => {
    const response = await apiClient.post<ConversationVisibilityResponse>(
      `/conversations/${conversationId}/publish`
    );
    return response.data;
  },

  /**
   * Unpublish a conversation (make it private)
   */
  unpublish: async (conversationId: string): Promise<ConversationVisibilityResponse> => {
    const response = await apiClient.post<ConversationVisibilityResponse>(
      `/conversations/${conversationId}/unpublish`
    );
    return response.data;
  },

  /**
   * Toggle conversation visibility between public and private
   */
  toggleVisibility: async (conversationId: string): Promise<ConversationVisibilityResponse> => {
    const response = await apiClient.post<ConversationVisibilityResponse>(
      `/conversations/${conversationId}/toggle-visibility`
    );
    return response.data;
  },

  /**
   * Get list of public shared conversations (paginated)
   */
  getShared: async (params: SharedConversationsParams = {}): Promise<SharedConversationsResponse> => {
    const response = await apiClient.get<SharedConversationsResponse>('/shared-conversations', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        sort_by: params.sort_by,
        sort_order: params.sort_order,
      },
    });
    return response.data;
  },

  /**
   * Get trending public conversations
   */
  getTrending: async (params: TrendingConversationsParams = {}): Promise<TrendingConversationsResponse> => {
    const response = await apiClient.get<TrendingConversationsResponse>('/trending/conversations', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        time_range: params.time_range,
      },
    });
    return response.data;
  },
};
