// Admin File text-extraction observability — API service
import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from '@/types/admin-cases';
import type {
  FileExtraction,
  FileExtractionSummary,
  FileExtractionsParams,
} from '@/types/admin-file-extractions';

async function getExtractions(
  params: FileExtractionsParams
): Promise<PaginatedResponse<FileExtraction>> {
  const response = await apiClient.get<PaginatedResponse<FileExtraction>>(
    '/admin/file-extractions',
    { params }
  );
  return response.data;
}

async function getExtractionSummary(): Promise<ApiResponse<FileExtractionSummary>> {
  const response = await apiClient.get<ApiResponse<FileExtractionSummary>>(
    '/admin/file-extractions/summary'
  );
  return response.data;
}

export const adminFileExtractionsApi = {
  getExtractions,
  getExtractionSummary,
};
