import { apiClient } from './client';
import type {
  AdminLawyerConnectListParams,
  AdminLawyerConnectListResponse,
  AdminLawyerConnectDetailResponse,
  AdminLawyerConnectAnalyticsParams,
  AdminLawyerConnectAnalyticsResponse,
} from '@/types/admin-lawyer-connect';

/**
 * Admin lawyer connection request API service
 * Requires admin+ role for all operations
 */
export const adminLawyerConnectApi = {
  /**
   * List all connection requests with filtering, sorting, and pagination
   */
  getList: async (
    params: AdminLawyerConnectListParams = {}
  ): Promise<AdminLawyerConnectListResponse> => {
    const response = await apiClient.get<AdminLawyerConnectListResponse>(
      '/admin/lawyer-connection-requests',
      {
        params: {
          status: params.status,
          lawyer_uuid: params.lawyer_uuid,
          sort_by: params.sort_by ?? 'created_at',
          sort_order: params.sort_order ?? 'desc',
          per_page: params.per_page ?? 15,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  /**
   * Get a single connection request by its ID
   */
  getById: async (id: number): Promise<AdminLawyerConnectDetailResponse> => {
    const response = await apiClient.get<AdminLawyerConnectDetailResponse>(
      `/admin/lawyer-connection-requests/${id}`
    );
    return response.data;
  },

  /**
   * Get all connection requests for a specific lawyer by UUID
   */
  getLawyerRequests: async (
    uuid: string,
    params: Omit<AdminLawyerConnectListParams, 'lawyer_uuid' | 'sort_by'> = {}
  ): Promise<AdminLawyerConnectListResponse> => {
    const response = await apiClient.get<AdminLawyerConnectListResponse>(
      `/admin/lawyer-connection-requests/lawyer/${uuid}`,
      {
        params: {
          status: params.status,
          sort_order: params.sort_order ?? 'desc',
          per_page: params.per_page ?? 15,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  /**
   * Get analytics dashboard data for connection requests
   */
  getAnalytics: async (
    params: AdminLawyerConnectAnalyticsParams = {}
  ): Promise<AdminLawyerConnectAnalyticsResponse> => {
    const response = await apiClient.get<AdminLawyerConnectAnalyticsResponse>(
      '/admin/lawyer-connection-requests/analytics',
      {
        params: {
          period: params.period ?? 'last_30_days',
          start_date: params.start_date,
          end_date: params.end_date,
        },
      }
    );
    return response.data;
  },
};
