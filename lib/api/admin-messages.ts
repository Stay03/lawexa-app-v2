// Admin Global Message Feed - API Service Layer
// Backs GET /api/admin/messages — cursor-paginated cross-user feed.

import { apiClient } from './client';
import type {
  AdminMessageListParams,
  AdminMessageListResponse,
} from '@/types/admin-messages';

async function list(
  params: AdminMessageListParams = {}
): Promise<AdminMessageListResponse> {
  // Axios serializes array params as `role[]=user&role[]=assistant` — matches
  // Laravel's expected `role[]` / `sent_via[]`.
  const response = await apiClient.get<AdminMessageListResponse>(
    '/admin/messages',
    { params }
  );
  return response.data;
}

export const adminMessagesApi = { list };
