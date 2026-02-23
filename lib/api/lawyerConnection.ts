import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { LawyerConnectionRequest, CreateConnectionRequestPayload } from '@/types/connection';

export interface SendConnectionParams {
  lawyerId: string;
  phone_number?: string;
  contact_email?: string;
  message?: string;
}

export const lawyerConnectionApi = {
  /**
   * Send a connection request to a lawyer
   * @param params - Connection request parameters
   * @returns The created connection request
   */
  sendConnectionRequest: async ({
    lawyerId,
    phone_number,
    contact_email,
    message,
  }: SendConnectionParams) => {
    const payload: CreateConnectionRequestPayload = {
      lawyer_uuid: lawyerId,
    };

    if (phone_number?.trim()) {
      payload.phone_number = phone_number.trim();
    }
    if (contact_email?.trim()) {
      payload.contact_email = contact_email.trim();
    }
    if (message?.trim()) {
      payload.message = message.trim();
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
