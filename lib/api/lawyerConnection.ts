import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { LawyerConnectionRequest, CreateConnectionRequestPayload } from '@/types/connection';

export const lawyerConnectionApi = {
  /**
   * Send a connection request to a lawyer
   * @param lawyerId - The UUID of the lawyer to connect with
   * @param message - Optional message to include with the connection request (max 1000 chars)
   * @returns The created connection request
   */
  sendConnectionRequest: async (lawyerId: string, message?: string) => {
    const payload: CreateConnectionRequestPayload = {
      lawyer_uuid: lawyerId,
    };

    if (message) {
      payload.message = message;
    }

    const response = await apiClient.post<ApiResponse<LawyerConnectionRequest>>(
      '/lawyer-connection-requests',
      payload
    );
    return response.data;
  },

  /**
   * Get all connection requests sent by the current user
   * @returns List of connection requests
   */
  getMyConnectionRequests: async () => {
    const response = await apiClient.get<ApiResponse<LawyerConnectionRequest[]>>(
      '/lawyer-connection-requests'
    );
    return response.data;
  },
};
