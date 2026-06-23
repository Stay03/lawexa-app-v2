// Admin Ambassador Applications — TanStack Query hooks.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAmbassadorsApi } from '@/lib/api/ambassadors';
import type {
  AmbassadorListParams,
  ApproveAmbassadorData,
  RejectAmbassadorData,
} from '@/types/ambassador';

export const adminAmbassadorsKeys = {
  all: ['admin', 'ambassador-applications'] as const,
  lists: () => [...adminAmbassadorsKeys.all, 'list'] as const,
  list: (params: AmbassadorListParams) => [...adminAmbassadorsKeys.lists(), params] as const,
};

export function useAdminAmbassadors(params: AmbassadorListParams = {}) {
  return useQuery({
    queryKey: adminAmbassadorsKeys.list(params),
    queryFn: () => adminAmbassadorsApi.getAdminList(params),
    staleTime: 60 * 1000,
  });
}

export function useApproveAmbassador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: ApproveAmbassadorData }) =>
      adminAmbassadorsApi.approve(uuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAmbassadorsKeys.all });
    },
  });
}

export function useRejectAmbassador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: RejectAmbassadorData }) =>
      adminAmbassadorsApi.reject(uuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAmbassadorsKeys.all });
    },
  });
}
