// Admin Content Requests - TanStack Query Hooks
// Provides React Query hooks for content request management with proper cache management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminContentRequestsApi } from '@/lib/api/admin-content-requests';
import type {
  AdminContentRequestsParams,
  UpdateStatusData,
  FulfillData,
  RejectData,
} from '@/types/content-request';

/******************************************************************************
                            Query Key Factory
******************************************************************************/

export const adminContentRequestsKeys = {
  all: ['admin', 'content-requests'] as const,

  // Content Requests Lists
  lists: () => [...adminContentRequestsKeys.all, 'list'] as const,
  list: (params: AdminContentRequestsParams) =>
    [...adminContentRequestsKeys.lists(), params] as const,

  // Content Request Details
  details: () => [...adminContentRequestsKeys.all, 'detail'] as const,
  detail: (uuid: string) => [...adminContentRequestsKeys.details(), uuid] as const,
};

/******************************************************************************
                        Content Requests Query Hooks
******************************************************************************/

/**
 * Get paginated list of all content requests (admin view)
 * Requires researcher+ role
 */
export function useAdminContentRequests(params: AdminContentRequestsParams = {}) {
  return useQuery({
    queryKey: adminContentRequestsKeys.list(params),
    queryFn: () => adminContentRequestsApi.getAdminList(params),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get single content request by UUID
 * Accessible to owner or researcher+
 */
export function useContentRequest(uuid: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: uuid ? adminContentRequestsKeys.detail(uuid) : (['admin', 'content-requests', 'detail', 'undefined'] as const),
    queryFn: () => adminContentRequestsApi.getByUuid(uuid!),
    enabled: !!uuid && (options?.enabled !== false),
    staleTime: 60 * 1000, // 1 minute
  });
}

/******************************************************************************
                    Content Requests Mutation Hooks
******************************************************************************/

/**
 * Update content request status
 * Requires researcher+ role
 */
export function useUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: UpdateStatusData }) =>
      adminContentRequestsApi.updateStatus(uuid, data),
    onSuccess: () => {
      // Invalidate all content request lists and details
      queryClient.invalidateQueries({ queryKey: adminContentRequestsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adminContentRequestsKeys.details() });
    },
  });
}

/**
 * Fulfill content request by linking created content
 * Requires researcher+ role
 * Returns 409 if already fulfilled or rejected
 */
export function useFulfillRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: FulfillData }) =>
      adminContentRequestsApi.fulfill(uuid, data),
    onSuccess: () => {
      // Invalidate all content request lists and details
      queryClient.invalidateQueries({ queryKey: adminContentRequestsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adminContentRequestsKeys.details() });
    },
  });
}

/**
 * Reject content request with reason
 * Requires researcher+ role
 * Returns 409 if already fulfilled or rejected
 */
export function useRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: RejectData }) =>
      adminContentRequestsApi.reject(uuid, data),
    onSuccess: () => {
      // Invalidate all content request lists and details
      queryClient.invalidateQueries({ queryKey: adminContentRequestsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adminContentRequestsKeys.details() });
    },
  });
}
