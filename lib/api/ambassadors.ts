import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type {
  AmbassadorApplication,
  AmbassadorListParams,
  AmbassadorListResponse,
  ApproveAmbassadorData,
  RejectAmbassadorData,
} from '@/types/ambassador';

/**
 * Admin Ambassador Applications API. All endpoints require role:admin.
 */
export const adminAmbassadorsApi = {
  getAdminList: async (params: AmbassadorListParams = {}): Promise<AmbassadorListResponse> => {
    const response = await apiClient.get<AmbassadorListResponse>('/admin/ambassador-applications', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        status: params.status || undefined,
        sort: params.sort || undefined,
        direction: params.direction || undefined,
      },
    });
    return response.data;
  },

  // Optional review_notes. Returns 409 if already approved/rejected.
  approve: async (uuid: string, data: ApproveAmbassadorData): Promise<ApiResponse<AmbassadorApplication>> => {
    const response = await apiClient.patch<ApiResponse<AmbassadorApplication>>(
      `/admin/ambassador-applications/${uuid}/approve`,
      { review_notes: data.review_notes ?? null }
    );
    return response.data;
  },

  // review_notes required (rejection reason). Returns 409 if already decided.
  reject: async (uuid: string, data: RejectAmbassadorData): Promise<ApiResponse<AmbassadorApplication>> => {
    const response = await apiClient.patch<ApiResponse<AmbassadorApplication>>(
      `/admin/ambassador-applications/${uuid}/reject`,
      { review_notes: data.review_notes }
    );
    return response.data;
  },
};

/**
 * Public (signed-in user) Ambassador API. Backs the same endpoints the static
 * /ambassadors apply page uses.
 */
export const ambassadorsApi = {
  // The signed-in user's own application, or `data: null` if they haven't applied.
  getMyApplication: async (): Promise<ApiResponse<AmbassadorApplication>> => {
    const response = await apiClient.get<ApiResponse<AmbassadorApplication>>(
      '/ambassadors/my-application'
    );
    return response.data;
  },
};
