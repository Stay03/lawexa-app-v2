// Admin Statutes - API Service Layer
// Handles all API calls for statute management and AKN imports

import { apiClient } from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  StatuteImport,
  AdminStatute,
  AdminStatuteDetail,
  ImportAknData,
  AdminStatutesParams,
  AdminStatuteImportsParams,
} from '@/types/admin-statutes';

/******************************************************************************
                                AKN Import
******************************************************************************/

/**
 * Upload an AKN XML file and start async import
 * Returns 202 with a tracking UUID
 */
async function importAkn(
  data: ImportAknData
): Promise<ApiResponse<StatuteImport>> {
  const formData = new FormData();
  formData.append('file', data.file);
  if (data.title) formData.append('title', data.title);
  if (data.year) formData.append('year', String(data.year));
  if (data.country_id) formData.append('country_id', String(data.country_id));

  const response = await apiClient.post<ApiResponse<StatuteImport>>(
    '/statutes/import-akn',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

/**
 * Get paginated list of user's imports (most recent first)
 */
async function getImports(
  params: AdminStatuteImportsParams = {}
): Promise<PaginatedResponse<StatuteImport>> {
  const response = await apiClient.get<PaginatedResponse<StatuteImport>>(
    '/statutes/import-akn',
    { params }
  );
  return response.data;
}

/**
 * Poll import status by UUID
 */
async function getImportStatus(
  uuid: string
): Promise<ApiResponse<StatuteImport>> {
  const response = await apiClient.get<ApiResponse<StatuteImport>>(
    `/statutes/import-akn/${uuid}/status`
  );
  return response.data;
}

/**
 * Cancel a pending or processing import
 */
async function cancelImport(
  uuid: string
): Promise<ApiResponse<StatuteImport>> {
  const response = await apiClient.post<ApiResponse<StatuteImport>>(
    `/statutes/import-akn/${uuid}/cancel`
  );
  return response.data;
}

/**
 * Delete an import record (completed or failed only)
 */
async function deleteImportRecord(
  uuid: string
): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/statutes/import-akn/${uuid}`
  );
  return response.data;
}

/******************************************************************************
                                Statutes CRUD
******************************************************************************/

/**
 * Get paginated list of statutes with filters
 */
async function getStatutes(
  params: AdminStatutesParams = {}
): Promise<PaginatedResponse<AdminStatute>> {
  const response = await apiClient.get<PaginatedResponse<AdminStatute>>(
    '/statutes',
    { params }
  );
  return response.data;
}

/**
 * Get single statute by slug
 */
async function getStatute(
  slug: string
): Promise<ApiResponse<AdminStatuteDetail>> {
  const response = await apiClient.get<ApiResponse<AdminStatuteDetail>>(
    `/statutes/${slug}`
  );
  return response.data;
}

/**
 * Soft-delete a statute
 */
async function deleteStatute(id: number): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/statutes/${id}`
  );
  return response.data;
}

/******************************************************************************
                                Export
******************************************************************************/

export const adminStatutesApi = {
  // AKN Import
  importAkn,
  getImports,
  getImportStatus,
  cancelImport,
  deleteImportRecord,

  // Statutes
  getStatutes,
  getStatute,
  deleteStatute,
};
