'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminSponsorsApi } from '@/lib/api/admin-sponsors';
import type {
  AdminSponsorsParams,
  AdminSponsorCreatePayload,
  AdminSponsorUpdatePayload,
  AdminCampaignsParams,
  AdminCampaignCreatePayload,
  AdminCampaignUpdatePayload,
  AdminCampaignEndPayload,
  AdminGrantsParams,
  AdminBulkGrantPayload,
} from '@/types/admin-sponsors';

/******************************************************************************
                              Query key factory
******************************************************************************/

export const sponsorKeys = {
  all: ['admin-sponsors'] as const,
  sponsors: () => [...sponsorKeys.all, 'sponsors'] as const,
  sponsorsList: (params: AdminSponsorsParams) =>
    [...sponsorKeys.sponsors(), 'list', params] as const,
  sponsorDetail: (id: number) =>
    [...sponsorKeys.sponsors(), 'detail', id] as const,
  sponsorUsage: (id: number) =>
    [...sponsorKeys.sponsors(), 'usage', id] as const,
  campaigns: () => [...sponsorKeys.all, 'campaigns'] as const,
  sponsorCampaigns: (sponsorId: number, params: AdminCampaignsParams) =>
    [...sponsorKeys.campaigns(), 'sponsor', sponsorId, params] as const,
  campaignDetail: (id: number) =>
    [...sponsorKeys.campaigns(), 'detail', id] as const,
  campaignUsage: (id: number) =>
    [...sponsorKeys.campaigns(), 'usage', id] as const,
  grants: () => [...sponsorKeys.all, 'grants'] as const,
  campaignGrants: (campaignId: number, params: AdminGrantsParams) =>
    [...sponsorKeys.grants(), 'campaign', campaignId, params] as const,
};

/******************************************************************************
                                  Queries
******************************************************************************/

export function useAdminSponsors(params: AdminSponsorsParams = {}) {
  return useQuery({
    queryKey: sponsorKeys.sponsorsList(params),
    queryFn: () => adminSponsorsApi.listSponsors(params),
    staleTime: 30 * 1000,
  });
}

export function useAdminSponsor(id: number) {
  return useQuery({
    queryKey: sponsorKeys.sponsorDetail(id),
    queryFn: () => adminSponsorsApi.getSponsor(id),
    enabled: id > 0,
    staleTime: 30 * 1000,
  });
}

export function useSponsorCampaigns(
  sponsorId: number,
  params: AdminCampaignsParams = {}
) {
  return useQuery({
    queryKey: sponsorKeys.sponsorCampaigns(sponsorId, params),
    queryFn: () => adminSponsorsApi.listCampaigns(sponsorId, params),
    enabled: sponsorId > 0,
    staleTime: 30 * 1000,
  });
}

export function useAdminCampaign(id: number) {
  return useQuery({
    queryKey: sponsorKeys.campaignDetail(id),
    queryFn: () => adminSponsorsApi.getCampaign(id),
    enabled: id > 0,
    staleTime: 30 * 1000,
  });
}

export function useCampaignGrants(
  campaignId: number,
  params: AdminGrantsParams = {}
) {
  return useQuery({
    queryKey: sponsorKeys.campaignGrants(campaignId, params),
    queryFn: () => adminSponsorsApi.listGrants(campaignId, params),
    enabled: campaignId > 0,
    staleTime: 30 * 1000,
  });
}

export function useCampaignUsage(id: number) {
  return useQuery({
    queryKey: sponsorKeys.campaignUsage(id),
    queryFn: () => adminSponsorsApi.getCampaignUsage(id),
    enabled: id > 0,
    staleTime: 30 * 1000,
  });
}

export function useSponsorUsage(id: number) {
  return useQuery({
    queryKey: sponsorKeys.sponsorUsage(id),
    queryFn: () => adminSponsorsApi.getSponsorUsage(id),
    enabled: id > 0,
    staleTime: 30 * 1000,
  });
}

/******************************************************************************
                                 Mutations
******************************************************************************/

export function useCreateSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminSponsorCreatePayload) =>
      adminSponsorsApi.createSponsor(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorKeys.sponsors() });
    },
  });
}

export function useUpdateSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: AdminSponsorUpdatePayload;
    }) => adminSponsorsApi.updateSponsor(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: sponsorKeys.sponsors() });
      queryClient.invalidateQueries({
        queryKey: sponsorKeys.sponsorDetail(id),
      });
    },
  });
}

export function useDeleteSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminSponsorsApi.deleteSponsor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorKeys.sponsors() });
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sponsorId,
      payload,
    }: {
      sponsorId: number;
      payload: AdminCampaignCreatePayload;
    }) => adminSponsorsApi.createCampaign(sponsorId, payload),
    onSuccess: (_data, { sponsorId }) => {
      queryClient.invalidateQueries({ queryKey: sponsorKeys.campaigns() });
      queryClient.invalidateQueries({
        queryKey: sponsorKeys.sponsorDetail(sponsorId),
      });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: AdminCampaignUpdatePayload;
    }) => adminSponsorsApi.updateCampaign(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({
        queryKey: sponsorKeys.campaignDetail(id),
      });
      queryClient.invalidateQueries({ queryKey: sponsorKeys.campaigns() });
    },
  });
}

export function useActivateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminSponsorsApi.activateCampaign(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: sponsorKeys.campaignDetail(id),
      });
      queryClient.invalidateQueries({ queryKey: sponsorKeys.campaigns() });
    },
  });
}

export function useEndCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: AdminCampaignEndPayload;
    }) => adminSponsorsApi.endCampaign(id, payload),
    onSuccess: (_data, { id, payload }) => {
      queryClient.invalidateQueries({
        queryKey: sponsorKeys.campaignDetail(id),
      });
      queryClient.invalidateQueries({ queryKey: sponsorKeys.campaigns() });
      queryClient.invalidateQueries({
        queryKey: sponsorKeys.campaignUsage(id),
      });
      if (payload.force_expire_grants) {
        queryClient.invalidateQueries({ queryKey: sponsorKeys.grants() });
      }
    },
  });
}

export function useBulkGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaignId,
      payload,
    }: {
      campaignId: number;
      payload: AdminBulkGrantPayload;
    }) => adminSponsorsApi.bulkGrant(campaignId, payload),
    onSuccess: (_data, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: sponsorKeys.grants() });
      queryClient.invalidateQueries({
        queryKey: sponsorKeys.campaignDetail(campaignId),
      });
      queryClient.invalidateQueries({
        queryKey: sponsorKeys.campaignUsage(campaignId),
      });
      // Sponsor-level rollup also changes — invalidate broadly
      queryClient.invalidateQueries({ queryKey: sponsorKeys.sponsors() });
    },
  });
}

export function useRevokeGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminSponsorsApi.revokeGrant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorKeys.grants() });
      queryClient.invalidateQueries({ queryKey: sponsorKeys.campaigns() });
    },
  });
}
