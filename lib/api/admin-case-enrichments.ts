// Admin Case Enrichment monitoring — API service layer
// Backend: GET /api/admin/case-enrichments[/{id}|/summary] (role:admin)

import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from '@/types/admin-cases';
import type {
  CaseEnrichmentRun,
  CaseEnrichmentSummary,
  CaseEnrichmentsParams,
} from '@/types/admin-case-enrichments';

/**
 * List enrichment runs (newest first). `unmapped_outcomes` is sent as `1`.
 */
async function getEnrichments(
  params: CaseEnrichmentsParams = {}
): Promise<PaginatedResponse<CaseEnrichmentRun>> {
  const { unmapped_outcomes, ...rest } = params;
  const response = await apiClient.get<PaginatedResponse<CaseEnrichmentRun>>(
    '/admin/case-enrichments',
    {
      params: {
        ...rest,
        unmapped_outcomes: unmapped_outcomes ? 1 : undefined,
      },
    }
  );
  return response.data;
}

/** Fetch a single enrichment run by numeric id. */
async function getEnrichment(
  id: number
): Promise<ApiResponse<CaseEnrichmentRun>> {
  const response = await apiClient.get<ApiResponse<CaseEnrichmentRun>>(
    `/admin/case-enrichments/${id}`
  );
  return response.data;
}

/** Fetch the dashboard summary numbers. */
async function getEnrichmentSummary(): Promise<
  ApiResponse<CaseEnrichmentSummary>
> {
  const response = await apiClient.get<ApiResponse<CaseEnrichmentSummary>>(
    '/admin/case-enrichments/summary'
  );
  return response.data;
}

export const adminCaseEnrichmentsApi = {
  getEnrichments,
  getEnrichment,
  getEnrichmentSummary,
};
