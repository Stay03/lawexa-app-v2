// Admin Lawyer Verifications - TanStack Query Hooks
// Provides React Query hooks for lawyer verification management with proper cache management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminLawyerVerificationsApi } from '@/lib/api/admin-lawyer-verifications';
import type {
  AdminLawyerVerificationsParams,
  ApproveVerificationData,
  RejectVerificationData,
} from '@/types/admin-lawyer-verification';

/******************************************************************************
                            Query Key Factory
******************************************************************************/

export const adminLawyerVerificationsKeys = {
  all: ['admin', 'lawyer-verifications'] as const,

  // Stats
  stats: () => [...adminLawyerVerificationsKeys.all, 'stats'] as const,

  // Verification Lists
  lists: () => [...adminLawyerVerificationsKeys.all, 'list'] as const,
  list: (params: AdminLawyerVerificationsParams) =>
    [...adminLawyerVerificationsKeys.lists(), params] as const,

  // Verification Details
  details: () => [...adminLawyerVerificationsKeys.all, 'detail'] as const,
  detail: (id: number) =>
    [...adminLawyerVerificationsKeys.details(), id] as const,
};

/******************************************************************************
                            Query Hooks
******************************************************************************/

/**
 * Stats card counts for the list page header
 */
export function useAdminLawyerVerificationStats() {
  return useQuery({
    queryKey: adminLawyerVerificationsKeys.stats(),
    queryFn: () => adminLawyerVerificationsApi.getStats(),
    staleTime: 60 * 1000,
  });
}

/**
 * Paginated list of lawyer verifications with optional status filter
 */
export function useAdminLawyerVerifications(
  params: AdminLawyerVerificationsParams = {}
) {
  return useQuery({
    queryKey: adminLawyerVerificationsKeys.list(params),
    queryFn: () => adminLawyerVerificationsApi.getList(params),
    staleTime: 60 * 1000,
  });
}

/**
 * Full detail for a single verification (used on detail page)
 */
export function useAdminLawyerVerification(
  id: number | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: id
      ? adminLawyerVerificationsKeys.detail(id)
      : (['admin', 'lawyer-verifications', 'detail', 'undefined'] as const),
    queryFn: () => adminLawyerVerificationsApi.getById(id!),
    enabled: !!id && (options?.enabled !== false),
    staleTime: 60 * 1000,
  });
}

/******************************************************************************
                            Mutation Hooks
******************************************************************************/

/**
 * Approve a lawyer verification submission
 * Invalidates stats, lists, and the specific detail on success
 */
export function useApproveVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ApproveVerificationData }) =>
      adminLawyerVerificationsApi.approve(id, data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminLawyerVerificationsKeys.stats(),
      });
      queryClient.invalidateQueries({
        queryKey: adminLawyerVerificationsKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: adminLawyerVerificationsKeys.detail(variables.id),
      });
    },
  });
}

/**
 * Reject a lawyer verification submission
 * Invalidates stats, lists, and the specific detail on success
 */
export function useRejectVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RejectVerificationData }) =>
      adminLawyerVerificationsApi.reject(id, data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminLawyerVerificationsKeys.stats(),
      });
      queryClient.invalidateQueries({
        queryKey: adminLawyerVerificationsKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: adminLawyerVerificationsKeys.detail(variables.id),
      });
    },
  });
}
