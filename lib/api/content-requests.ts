import { apiClient } from './client';
import type {
  ContentRequestListResponse,
  ContentRequestResponse,
  ContentRequestListParams,
  SubmitContentRequestData,
} from '@/types/content-request';

/**
 * Content Request API service for Phase 14 endpoints
 */
export const contentRequestsApi = {
  /**
   * Get paginated list of content requests (user sees own, researcher+ sees all)
   */
  getList: async (params: ContentRequestListParams = {}): Promise<ContentRequestListResponse> => {
    const response = await apiClient.get<ContentRequestListResponse>('/content-requests', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        status: params.status || undefined,
        type: params.type || undefined,
        sort: params.sort || undefined,
        direction: params.direction || undefined,
      },
    });
    return response.data;
  },

  /**
   * Get single content request by UUID
   */
  getByUuid: async (uuid: string): Promise<ContentRequestResponse> => {
    const response = await apiClient.get<ContentRequestResponse>(`/content-requests/${uuid}`);
    return response.data;
  },

  /**
   * Submit a new content request
   */
  submit: async (data: SubmitContentRequestData): Promise<ContentRequestResponse> => {
    const response = await apiClient.post<ContentRequestResponse>('/content-requests', {
      type: data.type,
      title: data.title,
      additional_notes: data.additional_notes || undefined,
    });
    return response.data;
  },
};
