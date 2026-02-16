import { apiClient } from './client';
import type {
  ChatStartRequest,
  ChatStartResponse,
  ConversationResponse,
  ConversationsListResponse,
  ListConversationsParams,
  DocumentUploadResponse
} from '@/types/chat';

/**
 * Chat API service
 */
export const chatApi = {
  /**
   * Upload a PDF document for chat attachment
   */
  uploadDocument: async (file: File): Promise<DocumentUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<DocumentUploadResponse>(
      '/files/documents',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

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
