import { apiClient } from './client';
import type {
  ChatStartRequest,
  ChatStartResponse,
  ConversationResponse,
  ConversationsListResponse,
  ConversationStatusResponse,
  ListConversationsParams,
  DocumentUploadResponse
} from '@/types/chat';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
   * Get conversation status (for recovery from dropped SSE connections)
   */
  getStatus: async (id: string): Promise<ConversationStatusResponse> => {
    const response = await apiClient.get<ConversationStatusResponse>(`/conversations/${id}/status`);
    return response.data;
  },

  /**
   * List all conversations for the authenticated user
   */
  listConversations: async (params?: ListConversationsParams): Promise<ConversationsListResponse> => {
    const response = await apiClient.get<ConversationsListResponse>('/conversations', { params });
    return response.data;
  },

  /**
   * Cancel a streaming execution. Fire-and-forget.
   *
   * Uses raw `fetch` (not `apiClient`) because:
   *  - The endpoint requires query-param auth (same as the SSE endpoint), matching
   *    the backend's explicit example.
   *  - We don't want the axios response interceptor's 401 redirect to fire on a
   *    call that races the SSE stream closing.
   *
   * A 200 response only means "cancel accepted", NOT "stream stopped". The stream
   * is only stopped when the terminal `cancelled` (or `completed`/`error`/`timeout`)
   * SSE event arrives on the existing EventSource connection. Callers MUST keep
   * the EventSource open after calling this.
   */
  cancelStream: async (executionId: string, token: string): Promise<void> => {
    const encodedToken = encodeURIComponent(token);
    const url = `${API_BASE_URL}/api/chat/stream/${executionId}/cancel?token=${encodedToken}`;
    try {
      await fetch(url, { method: 'POST' });
    } catch {
      // Ignore — the SSE stream will still deliver a terminal event regardless,
      // and the watchdog will recover if anything is truly stuck.
    }
  },
};
