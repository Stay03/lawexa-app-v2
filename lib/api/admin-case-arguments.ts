// Admin Case Argument review queue — API service layer
// Backend: /api/admin/case-arguments (role:researcher)

import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from '@/types/admin-cases';
import type {
  ArgumentBulkApproveResult,
  CaseArgumentReviewItem,
  CaseArgumentsParams,
  CaseArgumentsSummary,
  RejectArgumentData,
  UpdateArgumentData,
} from '@/types/admin-case-arguments';

/**
 * List arguments. Unreviewed by default; booleans map to 0/1.
 *
 * `reviewed` and `rejected` are not opposites. A thrown-out row is
 * `reviewed: true` with a rejection stamp, so asking for rejected rows without
 * naming `reviewed` returns them whatever that flag says.
 */
async function getArguments(
  params: CaseArgumentsParams = {}
): Promise<PaginatedResponse<CaseArgumentReviewItem>> {
  const { reviewed, rejected, ...rest } = params;
  const response = await apiClient.get<PaginatedResponse<CaseArgumentReviewItem>>(
    '/admin/case-arguments',
    {
      params: {
        ...rest,
        reviewed: reviewed === undefined ? undefined : reviewed ? 1 : 0,
        rejected: rejected === undefined ? undefined : rejected ? 1 : 0,
      },
    }
  );
  return response.data;
}

/** Editorial dashboard numbers. `reviewed` excludes rejected rows. */
async function getArgumentsSummary(): Promise<ApiResponse<CaseArgumentsSummary>> {
  const response = await apiClient.get<ApiResponse<CaseArgumentsSummary>>(
    '/admin/case-arguments/summary'
  );
  return response.data;
}

/** One argument with full context. */
async function getArgument(
  id: number
): Promise<ApiResponse<CaseArgumentReviewItem>> {
  const response = await apiClient.get<ApiResponse<CaseArgumentReviewItem>>(
    `/admin/case-arguments/${id}`
  );
  return response.data;
}

/** Edit an argument (optionally approving via `reviewed: true`). */
async function updateArgument(
  id: number,
  data: UpdateArgumentData
): Promise<ApiResponse<CaseArgumentReviewItem>> {
  const response = await apiClient.patch<ApiResponse<CaseArgumentReviewItem>>(
    `/admin/case-arguments/${id}`,
    data
  );
  return response.data;
}

/** Approve an argument. Also clears any earlier rejection. */
async function approveArgument(
  id: number
): Promise<ApiResponse<CaseArgumentReviewItem>> {
  const response = await apiClient.post<ApiResponse<CaseArgumentReviewItem>>(
    `/admin/case-arguments/${id}/approve`
  );
  return response.data;
}

/**
 * Throw an argument out. FLAGS THE ROW, NEVER DELETES IT.
 *
 * Verified against the controller on 8 September 2026: reject writes
 * `rejected_at`, `rejected_by` and `reviewed`, and saves the same row. Its own
 * docblock records that it USED to hard-delete, and that the deletion took the
 * record of the mistake with it, so a case reopened later offered the same bad
 * submission again. Nothing under `case_arguments` is audited or soft-deleted,
 * which makes the kept row the only evidence of what the extraction got wrong.
 *
 * If this ever starts removing rows, stop and report it rather than working
 * around it here.
 */
async function rejectArgument(
  id: number,
  data: RejectArgumentData = {}
): Promise<ApiResponse<CaseArgumentReviewItem>> {
  const response = await apiClient.post<ApiResponse<CaseArgumentReviewItem>>(
    `/admin/case-arguments/${id}/reject`,
    data
  );
  return response.data;
}

/** Approve many at once. The server caps a batch; callers chunk to match. */
async function bulkApprove(
  ids: number[]
): Promise<ApiResponse<ArgumentBulkApproveResult>> {
  const response = await apiClient.post<ApiResponse<ArgumentBulkApproveResult>>(
    '/admin/case-arguments/bulk-approve',
    { ids }
  );
  return response.data;
}

export const adminCaseArgumentsApi = {
  getArguments,
  getArgumentsSummary,
  getArgument,
  updateArgument,
  approveArgument,
  rejectArgument,
  bulkApprove,
};
