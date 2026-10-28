// Admin feedback — the "Why are you cancelling?" answers (Backend 53252e35)
import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from '@/types/admin-cases';
import type { AdminCancellationFeedback, AdminCancellationSummary, CancellationReason } from '@/types/feedback';

export interface AdminCancellationParams {
  reason?: CancellationReason;
  plan_id?: number;
  /** A date, `YYYY-MM-DD`, UTC; both ends are kept. */
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

async function getCancellations(
  params: AdminCancellationParams,
): Promise<PaginatedResponse<AdminCancellationFeedback>> {
  const response = await apiClient.get<PaginatedResponse<AdminCancellationFeedback>>(
    '/admin/feedback/cancellations',
    { params },
  );
  return response.data;
}

/** How many answers gave each reason, under the same filters (the page is ignored). */
async function getCancellationSummary(
  params: Omit<AdminCancellationParams, 'page' | 'per_page'>,
): Promise<ApiResponse<AdminCancellationSummary>> {
  const response = await apiClient.get<ApiResponse<AdminCancellationSummary>>(
    '/admin/feedback/cancellations/summary',
    { params },
  );
  return response.data;
}

export const adminFeedbackApi = {
  getCancellations,
  getCancellationSummary,
};
