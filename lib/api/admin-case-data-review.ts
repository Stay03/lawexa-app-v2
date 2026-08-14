// Admin Case Data Review — API service layer
// Backend: /api/admin/case-data-review (role:researcher)
//
// Read only. Nothing under this prefix writes, and the `fix` block on a row is
// a preview of what a write WOULD produce, not a write that happened.

import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from '@/types/admin-cases';
import type {
  CaseDataReviewParams,
  CaseDataReviewSummary,
  CaseReviewRow,
  DuplicatesPage,
  DuplicatesParams,
} from '@/types/admin-case-data-review';

/** Cases carrying a problem. Omitting `problem` returns every live case. */
async function getCases(
  params: CaseDataReviewParams = {}
): Promise<PaginatedResponse<CaseReviewRow>> {
  const { blocked, ...rest } = params;
  const response = await apiClient.get<PaginatedResponse<CaseReviewRow>>(
    '/admin/case-data-review',
    {
      params: {
        ...rest,
        // Tri-state: 1, 0, or absent. `undefined` is dropped by the client, so
        // omitting it asks for both, which is the honest default for a queue.
        blocked: blocked === undefined ? undefined : blocked ? 1 : 0,
      },
    }
  );
  return response.data;
}

/** Count per problem, with how many of each are blocked. */
async function getSummary(): Promise<ApiResponse<CaseDataReviewSummary>> {
  const response = await apiClient.get<ApiResponse<CaseDataReviewSummary>>(
    '/admin/case-data-review/summary'
  );
  return response.data;
}

/** Groups of cases that look like copies of each other, whole in one response. */
async function getDuplicates(
  params: DuplicatesParams = {}
): Promise<ApiResponse<DuplicatesPage>> {
  const response = await apiClient.get<ApiResponse<DuplicatesPage>>(
    '/admin/case-data-review/duplicates',
    { params }
  );
  return response.data;
}

export const adminCaseDataReviewApi = {
  getCases,
  getSummary,
  getDuplicates,
};
