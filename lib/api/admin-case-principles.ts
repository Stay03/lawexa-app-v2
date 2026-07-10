// Admin Case Principle review queue — API service layer
// Backend: /api/admin/case-principles (role:researcher)

import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from '@/types/admin-cases';
import type {
  BulkApproveResult,
  CasePrincipleReviewItem,
  CasePrinciplesParams,
  CasePrinciplesSummary,
  UpdatePrincipleData,
} from '@/types/admin-case-principles';

/** List principles. Unreviewed by default; `reviewed` maps to 0/1. */
async function getPrinciples(
  params: CasePrinciplesParams = {}
): Promise<PaginatedResponse<CasePrincipleReviewItem>> {
  const { reviewed, ...rest } = params;
  const response = await apiClient.get<PaginatedResponse<CasePrincipleReviewItem>>(
    '/admin/case-principles',
    {
      params: {
        ...rest,
        reviewed: reviewed === undefined ? undefined : reviewed ? 1 : 0,
      },
    }
  );
  return response.data;
}

/** Editorial dashboard numbers. */
async function getPrinciplesSummary(): Promise<ApiResponse<CasePrinciplesSummary>> {
  const response = await apiClient.get<ApiResponse<CasePrinciplesSummary>>(
    '/admin/case-principles/summary'
  );
  return response.data;
}

/** One principle with full context. */
async function getPrinciple(
  id: number
): Promise<ApiResponse<CasePrincipleReviewItem>> {
  const response = await apiClient.get<ApiResponse<CasePrincipleReviewItem>>(
    `/admin/case-principles/${id}`
  );
  return response.data;
}

/** Edit a principle (optionally approving via `reviewed: true`). */
async function updatePrinciple(
  id: number,
  data: UpdatePrincipleData
): Promise<ApiResponse<CasePrincipleReviewItem>> {
  const response = await apiClient.patch<ApiResponse<CasePrincipleReviewItem>>(
    `/admin/case-principles/${id}`,
    data
  );
  return response.data;
}

/** Approve a principle — publishes it and indexes its text. */
async function approvePrinciple(
  id: number
): Promise<ApiResponse<CasePrincipleReviewItem>> {
  const response = await apiClient.post<ApiResponse<CasePrincipleReviewItem>>(
    `/admin/case-principles/${id}/approve`
  );
  return response.data;
}

/** Reject (hard-delete) a bad extraction. */
async function rejectPrinciple(id: number): Promise<ApiResponse<null>> {
  const response = await apiClient.post<ApiResponse<null>>(
    `/admin/case-principles/${id}/reject`
  );
  return response.data;
}

/** Approve up to 100 principles at once. */
async function bulkApprove(
  ids: number[]
): Promise<ApiResponse<BulkApproveResult>> {
  const response = await apiClient.post<ApiResponse<BulkApproveResult>>(
    '/admin/case-principles/bulk-approve',
    { ids }
  );
  return response.data;
}

export const adminCasePrinciplesApi = {
  getPrinciples,
  getPrinciplesSummary,
  getPrinciple,
  updatePrinciple,
  approvePrinciple,
  rejectPrinciple,
  bulkApprove,
};
