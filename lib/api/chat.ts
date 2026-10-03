import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type {
  ChatStartRequest,
  ChatStartResponse,
  ChatReferenceType,
  ConversationResponse,
  ConversationsListResponse,
  ConversationStatusResponse,
  ListConversationsParams,
  ListMessagesParams,
  MessagesListResponse,
  DocumentUploadResponse,
  ApiMessage,
} from '@/types/chat';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * The query flags that make a chat's answers smaller, for the callers that
 * ask (v2). Without them each answer is exactly as v1 has always received it.
 *  - `lazyResults`: the transcript leaves out each step's result
 *    (`results=lazy`); a step fetches its own with getToolResult.
 *  - `withoutMessages`: the status check leaves out the messages
 *    (`messages=none`), for a caller that reads only the status.
 */
export function chatQueryParams(options?: {
  lazyResults?: boolean;
  withoutMessages?: boolean;
}): Record<string, string> | undefined {
  const params: Record<string, string> = {};
  if (options?.lazyResults) params.results = 'lazy';
  if (options?.withoutMessages) params.messages = 'none';
  return Object.keys(params).length > 0 ? params : undefined;
}

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
  getConversation: async (id: string, options?: { lazyResults?: boolean }): Promise<ConversationResponse> => {
    const response = await apiClient.get<ConversationResponse>(`/conversations/${id}`, {
      params: chatQueryParams(options),
    });
    return response.data;
  },

  /**
   * One step's result, left out of a lazy chat download. Same access rule as
   * opening the chat.
   */
  getToolResult: async (conversationId: string, messageId: number): Promise<ApiResponse<ApiMessage>> => {
    const response = await apiClient.get<ApiResponse<ApiMessage>>(
      `/conversations/${conversationId}/messages/${messageId}/result`,
    );
    return response.data;
  },

  /**
   * Get conversation status (for recovery from dropped SSE connections)
   */
  getStatus: async (id: string, options?: { withoutMessages?: boolean }): Promise<ConversationStatusResponse> => {
    const response = await apiClient.get<ConversationStatusResponse>(`/conversations/${id}/status`, {
      params: chatQueryParams(options),
    });
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
   * Delete a conversation for the authenticated user. The server refuses a
   * conversation that runs a Radar, with a `message` saying why.
   */
  /**
   * Rename a chat (`PATCH /conversations/{id}` with `{ title }`), owner only.
   * The contract asked of backend on 3 October 2026 (long-list #12); the
   * answer carries the stored title.
   */
  renameConversation: async (id: string, title: string): Promise<ApiResponse<{ id: string; title: string }>> => {
    const response = await apiClient.patch<ApiResponse<{ id: string; title: string }>>(`/conversations/${id}`, { title });
    return response.data;
  },

  deleteConversation: async (id: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/conversations/${id}`);
    return response.data;
  },

  /**
   * List the authenticated user's conversations about a single piece of content.
   * Owner-scoped and paginated, same envelope as `listConversations`. Powers the
   * "Related conversations" list in the floating chat panel.
   *
   * case/note/statute/radar use the nested per-content route; radar_scan has no
   * nested route, so it goes through the `?reference_type=` filter on the flat
   * conversations endpoint.
   */
  listContentConversations: async (
    contentType: ChatReferenceType,
    id: string,
    params?: ListConversationsParams,
  ): Promise<ConversationsListResponse> => {
    if (contentType === 'radar_scan') {
      const response = await apiClient.get<ConversationsListResponse>('/conversations', {
        params: { ...params, reference_type: 'radar_scan', reference: id },
      });
      return response.data;
    }
    const pathMap = {
      case: 'cases',
      note: 'notes',
      statute: 'statutes',
      radar: 'radars',
    } as const;
    const response = await apiClient.get<ConversationsListResponse>(
      `/${pathMap[contentType]}/${id}/conversations`,
      { params },
    );
    return response.data;
  },

  /**
   * List the authenticated user's messages across all conversations.
   * Each item includes its parent conversation (uuid + title).
   */
  listMessages: async (params?: ListMessagesParams): Promise<MessagesListResponse> => {
    const response = await apiClient.get<MessagesListResponse>('/messages', { params });
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
    // Token in the Authorization header, never in the address (addresses end up
    // in logs and history). Still a raw fetch, for the reasons above.
    const url = `${API_BASE_URL}/api/chat/stream/${executionId}/cancel`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore — the SSE stream will still deliver a terminal event regardless,
      // and the watchdog will recover if anything is truly stuck.
    }
  },
};
