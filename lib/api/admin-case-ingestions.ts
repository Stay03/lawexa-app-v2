// Admin Case PDF ingestion observability — API service
import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from '@/types/admin-cases';
import type {
  CaseIngestion,
  CaseIngestionSummary,
  CaseIngestionsParams,
} from '@/types/admin-case-ingestions';

async function getIngestions(
  params: CaseIngestionsParams = {}
): Promise<PaginatedResponse<CaseIngestion>> {
  const response = await apiClient.get<PaginatedResponse<CaseIngestion>>(
    '/admin/case-ingestions',
    { params }
  );
  return response.data;
}

async function getIngestion(id: string): Promise<ApiResponse<CaseIngestion>> {
  const response = await apiClient.get<ApiResponse<CaseIngestion>>(
    `/admin/case-ingestions/${id}`
  );
  return response.data;
}

async function getIngestionSummary(): Promise<ApiResponse<CaseIngestionSummary>> {
  const response = await apiClient.get<ApiResponse<CaseIngestionSummary>>(
    '/admin/case-ingestions/summary'
  );
  return response.data;
}

export const adminCaseIngestionsApi = {
  getIngestions,
  getIngestion,
  getIngestionSummary,
};
