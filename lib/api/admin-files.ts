import { apiClient } from './client';
import type {
  AdminFileAnalyticsParams,
  AdminFileAnalyticsResponse,
  AdminFileListParams,
  AdminFileListResponse,
  AdminFileDetailResponse,
  AdminFileDeleteResponse,
  AdminFileDownloadResponse,
} from '@/types/admin-files';

/**
 * Admin files API service
 */
export const adminFilesApi = {
  /**
   * Get file analytics dashboard data
   */
  getAnalytics: async (
    params: AdminFileAnalyticsParams = {}
  ): Promise<AdminFileAnalyticsResponse> => {
    const response = await apiClient.get<AdminFileAnalyticsResponse>(
      '/admin/files/analytics',
      { params }
    );
    return response.data;
  },

  /**
   * Get paginated list of all files
   */
  getList: async (
    params: AdminFileListParams = {}
  ): Promise<AdminFileListResponse> => {
    const response = await apiClient.get<AdminFileListResponse>(
      '/admin/files',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          search: params.search || undefined,
          category: params.category || undefined,
          disk: params.disk || undefined,
          upload_status: params.upload_status || undefined,
          mime_type: params.mime_type || undefined,
          uploaded_by: params.uploaded_by || undefined,
          created_from: params.created_from || undefined,
          created_to: params.created_to || undefined,
          size_min: params.size_min || undefined,
          size_max: params.size_max || undefined,
          sort_by: params.sort_by || undefined,
          sort_order: params.sort_order || undefined,
        },
      }
    );
    return response.data;
  },

  /**
   * Get single file details
   */
  getById: async (id: number): Promise<AdminFileDetailResponse> => {
    const response = await apiClient.get<AdminFileDetailResponse>(
      `/admin/files/${id}`
    );
    return response.data;
  },

  /**
   * Delete a file
   */
  deleteFile: async (id: number): Promise<AdminFileDeleteResponse> => {
    const response = await apiClient.delete<AdminFileDeleteResponse>(
      `/admin/files/${id}`
    );
    return response.data;
  },

  /**
   * Get download URL for a file
   */
  getDownloadUrl: async (id: number): Promise<AdminFileDownloadResponse> => {
    const response = await apiClient.get<AdminFileDownloadResponse>(
      `/admin/files/${id}/download`
    );
    return response.data;
  },
};
