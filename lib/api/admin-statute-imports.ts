// Admin AKN statute-import observability — API service
import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from '@/types/admin-cases';
import type {
  StatuteImport,
  StatuteImportSummary,
  StatuteImportsParams,
} from '@/types/admin-statute-imports';

async function getImports(
  params: StatuteImportsParams = {}
): Promise<PaginatedResponse<StatuteImport>> {
  const response = await apiClient.get<PaginatedResponse<StatuteImport>>(
    '/admin/statute-imports',
    { params }
  );
  return response.data;
}

async function getImportSummary(): Promise<ApiResponse<StatuteImportSummary>> {
  const response = await apiClient.get<ApiResponse<StatuteImportSummary>>(
    '/admin/statute-imports/summary'
  );
  return response.data;
}

export const adminStatuteImportsApi = {
  getImports,
  getImportSummary,
};
