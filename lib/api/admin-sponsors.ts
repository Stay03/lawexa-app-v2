import { apiClient } from './client';
import type {
  AdminSponsorsParams,
  AdminSponsorsListResponse,
  AdminSponsorDetailResponse,
  AdminSponsorCreatePayload,
  AdminSponsorUpdatePayload,
  AdminCampaignsParams,
  AdminCampaignsListResponse,
  AdminCampaignDetailResponse,
  AdminCampaignCreatePayload,
  AdminCampaignUpdatePayload,
  AdminCampaignEndPayload,
  AdminGrantsParams,
  AdminGrantsListResponse,
  AdminBulkGrantPayload,
  AdminBulkGrantResponse,
  AdminCampaignUsageResponse,
  AdminSponsorUsageResponse,
} from '@/types/admin-sponsors';

export const adminSponsorsApi = {
  /******************************************************************************
                                    Sponsors
  ******************************************************************************/

  listSponsors: async (
    params: AdminSponsorsParams = {}
  ): Promise<AdminSponsorsListResponse> => {
    const response = await apiClient.get<AdminSponsorsListResponse>(
      '/admin/sponsors',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          search: params.search || undefined,
        },
      }
    );
    return response.data;
  },

  getSponsor: async (id: number): Promise<AdminSponsorDetailResponse> => {
    const response = await apiClient.get<AdminSponsorDetailResponse>(
      `/admin/sponsors/${id}`
    );
    return response.data;
  },

  createSponsor: async (
    payload: AdminSponsorCreatePayload
  ): Promise<AdminSponsorDetailResponse> => {
    const response = await apiClient.post<AdminSponsorDetailResponse>(
      '/admin/sponsors',
      payload
    );
    return response.data;
  },

  updateSponsor: async (
    id: number,
    payload: AdminSponsorUpdatePayload
  ): Promise<AdminSponsorDetailResponse> => {
    const response = await apiClient.patch<AdminSponsorDetailResponse>(
      `/admin/sponsors/${id}`,
      payload
    );
    return response.data;
  },

  deleteSponsor: async (
    id: number
  ): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{
      success: boolean;
      message: string;
    }>(`/admin/sponsors/${id}`);
    return response.data;
  },

  /******************************************************************************
                                   Campaigns
  ******************************************************************************/

  listCampaigns: async (
    sponsorId: number,
    params: AdminCampaignsParams = {}
  ): Promise<AdminCampaignsListResponse> => {
    const response = await apiClient.get<AdminCampaignsListResponse>(
      `/admin/sponsors/${sponsorId}/campaigns`,
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
        },
      }
    );
    return response.data;
  },

  getCampaign: async (id: number): Promise<AdminCampaignDetailResponse> => {
    const response = await apiClient.get<AdminCampaignDetailResponse>(
      `/admin/campaigns/${id}`
    );
    return response.data;
  },

  createCampaign: async (
    sponsorId: number,
    payload: AdminCampaignCreatePayload
  ): Promise<AdminCampaignDetailResponse> => {
    const response = await apiClient.post<AdminCampaignDetailResponse>(
      `/admin/sponsors/${sponsorId}/campaigns`,
      payload
    );
    return response.data;
  },

  updateCampaign: async (
    id: number,
    payload: AdminCampaignUpdatePayload
  ): Promise<AdminCampaignDetailResponse> => {
    const response = await apiClient.patch<AdminCampaignDetailResponse>(
      `/admin/campaigns/${id}`,
      payload
    );
    return response.data;
  },

  activateCampaign: async (
    id: number
  ): Promise<AdminCampaignDetailResponse> => {
    const response = await apiClient.post<AdminCampaignDetailResponse>(
      `/admin/campaigns/${id}/activate`
    );
    return response.data;
  },

  endCampaign: async (
    id: number,
    payload: AdminCampaignEndPayload
  ): Promise<AdminCampaignDetailResponse> => {
    const response = await apiClient.post<AdminCampaignDetailResponse>(
      `/admin/campaigns/${id}/end`,
      payload
    );
    return response.data;
  },

  /******************************************************************************
                                    Grants
  ******************************************************************************/

  listGrants: async (
    campaignId: number,
    params: AdminGrantsParams = {}
  ): Promise<AdminGrantsListResponse> => {
    const response = await apiClient.get<AdminGrantsListResponse>(
      `/admin/campaigns/${campaignId}/grants`,
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 25,
          active_only: params.active_only,
        },
      }
    );
    return response.data;
  },

  bulkGrant: async (
    campaignId: number,
    payload: AdminBulkGrantPayload
  ): Promise<AdminBulkGrantResponse> => {
    const response = await apiClient.post<AdminBulkGrantResponse>(
      `/admin/campaigns/${campaignId}/grants`,
      payload
    );
    return response.data;
  },

  revokeGrant: async (
    id: number
  ): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{
      success: boolean;
      message: string;
    }>(`/admin/grants/${id}`);
    return response.data;
  },

  /******************************************************************************
                                   Analytics
  ******************************************************************************/

  getCampaignUsage: async (
    id: number
  ): Promise<AdminCampaignUsageResponse> => {
    const response = await apiClient.get<AdminCampaignUsageResponse>(
      `/admin/campaigns/${id}/usage`
    );
    return response.data;
  },

  getSponsorUsage: async (
    id: number
  ): Promise<AdminSponsorUsageResponse> => {
    const response = await apiClient.get<AdminSponsorUsageResponse>(
      `/admin/sponsors/${id}/usage`
    );
    return response.data;
  },
};
