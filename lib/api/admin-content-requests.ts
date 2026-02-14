import { apiClient } from './client';
import type {
  ContentRequestListResponse,
  ContentRequestResponse,
  AdminContentRequestsParams,
  UpdateStatusData,
  FulfillData,
  RejectData,
} from '@/types/content-request';

/**
 * Admin Content Requests API service for Phase 14 admin endpoints
 * Requires researcher+ role for all operations
 */
export const adminContentRequestsApi = {
  /**
   * Get paginated list of all content requests from all users (researcher+ only)
   */
  getAdminList: async (params: AdminContentRequestsParams = {}): Promise<ContentRequestListResponse> => {
    const response = await apiClient.get<ContentRequestListResponse>('/admin/content-requests', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        status: params.status || undefined,
        type: params.type || undefined,
        sort: params.sort || undefined,
        direction: params.direction || undefined,
        search: params.search || undefined,
      },
    });
    return response.data;
  },

  /**
   * Get single content request by UUID (owner or researcher+ only)
   */
  getByUuid: async (uuid: string): Promise<ContentRequestResponse> => {
    const response = await apiClient.get<ContentRequestResponse>(`/content-requests/${uuid}`);
    return response.data;
  },

  /**
   * Update content request status (researcher+ only)
   */
  updateStatus: async (uuid: string, data: UpdateStatusData): Promise<ContentRequestResponse> => {
    const response = await apiClient.put<ContentRequestResponse>(
      `/content-requests/${uuid}/status`,
      {
        status: data.status,
      }
    );
    return response.data;
  },

  /**
   * Fulfill content request by linking created content (researcher+ only)
   * Returns 409 if already fulfilled or rejected
   */
  fulfill: async (uuid: string, data: FulfillData): Promise<ContentRequestResponse> => {
    const response = await apiClient.put<ContentRequestResponse>(
      `/content-requests/${uuid}/fulfill`,
      {
        created_content_type: data.created_content_type,
        created_content_id: data.created_content_id,
      }
    );
    return response.data;
  },

  /**
   * Reject content request with reason (researcher+ only)
   * Returns 409 if already fulfilled or rejected
   */
  reject: async (uuid: string, data: RejectData): Promise<ContentRequestResponse> => {
    const response = await apiClient.put<ContentRequestResponse>(
      `/content-requests/${uuid}/reject`,
      {
        rejection_reason: data.rejection_reason,
      }
    );
    return response.data;
  },
};
