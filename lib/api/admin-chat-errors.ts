// Admin chat error log — API service
import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from '@/types/admin-cases';
import type {
  ChatError,
  ChatErrorSummary,
  ChatErrorSummaryParams,
  ChatErrorsParams,
} from '@/types/admin-chat-errors';

async function getErrors(params: ChatErrorsParams): Promise<PaginatedResponse<ChatError>> {
  const response = await apiClient.get<PaginatedResponse<ChatError>>('/admin/chat-errors', {
    params,
  });
  return response.data;
}

async function getSummary(
  params: ChatErrorSummaryParams
): Promise<ApiResponse<ChatErrorSummary>> {
  const response = await apiClient.get<ApiResponse<ChatErrorSummary>>(
    '/admin/chat-errors/summary',
    { params }
  );
  return response.data;
}

export const adminChatErrorsApi = {
  getErrors,
  getSummary,
};
