import { apiClient } from './client';
import type {
  AdminLawyerVerificationsParams,
  LawyerVerificationsListResponse,
  LawyerVerificationDetailResponse,
  LawyerVerificationStatsResponse,
  ApproveVerificationData,
  RejectVerificationData,
} from '@/types/admin-lawyer-verification';

/**
 * Admin Lawyer Verification API service
 * Base: /api/admin/lawyer-verifications
 * Requires: Bearer token, admin role
 */
export const adminLawyerVerificationsApi = {
  /**
   * GET /api/admin/lawyer-verifications/stats
   * Returns verification counts by status: { total, pending, approved, rejected }
   */
  getStats: async (): Promise<LawyerVerificationStatsResponse> => {
    const response = await apiClient.get<LawyerVerificationStatsResponse>(
      '/admin/lawyer-verifications/stats'
    );
    return response.data;
  },

  /**
   * GET /api/admin/lawyer-verifications
   * Paginated list of verifications, filterable by status
   */
  getList: async (
    params: AdminLawyerVerificationsParams = {}
  ): Promise<LawyerVerificationsListResponse> => {
    const response = await apiClient.get<LawyerVerificationsListResponse>(
      '/admin/lawyer-verifications',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          status: params.status || undefined,
        },
      }
    );
    return response.data;
  },

  /**
   * GET /api/admin/lawyer-verifications/{id}
   * Full lawyer profile with documents, notes, rejection_reason, verifier
   */
  getById: async (id: number): Promise<LawyerVerificationDetailResponse> => {
    const response = await apiClient.get<LawyerVerificationDetailResponse>(
      `/admin/lawyer-verifications/${id}`
    );
    return response.data;
  },

  /**
   * POST /api/admin/lawyer-verifications/{id}/approve
   * Approve a pending verification submission
   */
  approve: async (
    id: number,
    data: ApproveVerificationData
  ): Promise<LawyerVerificationDetailResponse> => {
    const response = await apiClient.post<LawyerVerificationDetailResponse>(
      `/admin/lawyer-verifications/${id}/approve`,
      data
    );
    return response.data;
  },

  /**
   * POST /api/admin/lawyer-verifications/{id}/reject
   * Reject a pending verification submission with a required reason
   */
  reject: async (
    id: number,
    data: RejectVerificationData
  ): Promise<LawyerVerificationDetailResponse> => {
    const response = await apiClient.post<LawyerVerificationDetailResponse>(
      `/admin/lawyer-verifications/${id}/reject`,
      data
    );
    return response.data;
  },
};
