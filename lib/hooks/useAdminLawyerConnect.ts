// Admin Lawyer Connect - TanStack Query Hooks
// Provides React Query hooks for admin lawyer connection request management

import { useQuery } from '@tanstack/react-query';
import { adminLawyerConnectApi } from '@/lib/api/admin-lawyer-connect';
import type {
  AdminLawyerConnectListParams,
  AdminLawyerConnectAnalyticsParams,
} from '@/types/admin-lawyer-connect';

/******************************************************************************
                         Query Key Factory
******************************************************************************/

export const adminLawyerConnectKeys = {
  all: ['admin-lawyer-connect'] as const,
  lists: () => [...adminLawyerConnectKeys.all, 'lists'] as const,
  list: (params: AdminLawyerConnectListParams) =>
    [...adminLawyerConnectKeys.lists(), 'list', params] as const,
  detail: (id: number) =>
    [...adminLawyerConnectKeys.all, 'detail', id] as const,
  lawyerRequests: (
    uuid: string,
    params: Omit<AdminLawyerConnectListParams, 'lawyer_uuid' | 'sort_by'>
  ) =>
    [...adminLawyerConnectKeys.all, 'lawyer', uuid, params] as const,
  analytics: (params: AdminLawyerConnectAnalyticsParams) =>
    [...adminLawyerConnectKeys.all, 'analytics', params] as const,
};

/******************************************************************************
                         Query Hooks
******************************************************************************/

/**
 * List all connection requests with filtering, sorting, and pagination
 * Requires admin+ role
 */
export function useAdminLawyerConnectList(
  params: AdminLawyerConnectListParams = {}
) {
  return useQuery({
    queryKey: adminLawyerConnectKeys.list(params),
    queryFn: () => adminLawyerConnectApi.getList(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Get a single connection request by ID
 * Requires admin+ role
 */
export function useAdminLawyerConnectDetail(id: number) {
  return useQuery({
    queryKey: adminLawyerConnectKeys.detail(id),
    queryFn: () => adminLawyerConnectApi.getById(id),
    staleTime: 30 * 1000,
    enabled: !!id,
  });
}

/**
 * Get all connection requests for a specific lawyer
 * Requires admin+ role
 */
export function useAdminLawyerRequests(
  uuid: string,
  params: Omit<AdminLawyerConnectListParams, 'lawyer_uuid' | 'sort_by'> = {}
) {
  return useQuery({
    queryKey: adminLawyerConnectKeys.lawyerRequests(uuid, params),
    queryFn: () => adminLawyerConnectApi.getLawyerRequests(uuid, params),
    staleTime: 30 * 1000,
    enabled: !!uuid,
  });
}

/**
 * Get analytics dashboard data for connection requests
 * Requires admin+ role
 */
export function useAdminLawyerConnectAnalytics(
  params: AdminLawyerConnectAnalyticsParams = {}
) {
  return useQuery({
    queryKey: adminLawyerConnectKeys.analytics(params),
    queryFn: () => adminLawyerConnectApi.getAnalytics(params),
    staleTime: 30 * 1000,
  });
}
