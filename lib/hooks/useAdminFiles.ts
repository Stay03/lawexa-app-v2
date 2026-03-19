'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminFilesApi } from '@/lib/api/admin-files';
import { extractApiError } from '@/lib/utils/api-error';
import type {
  AdminFileAnalyticsParams,
  AdminFileListParams,
} from '@/types/admin-files';

// Query key factory
export const adminFileKeys = {
  all: ['admin', 'files'] as const,
  analytics: (params: AdminFileAnalyticsParams) =>
    [...adminFileKeys.all, 'analytics', params] as const,
  list: (params: AdminFileListParams) =>
    [...adminFileKeys.all, 'list', params] as const,
  detail: (id: number) =>
    [...adminFileKeys.all, 'detail', id] as const,
};

/**
 * Hook for fetching file analytics
 */
export function useAdminFileAnalytics(params: AdminFileAnalyticsParams) {
  return useQuery({
    queryKey: adminFileKeys.analytics(params),
    queryFn: () => adminFilesApi.getAnalytics(params),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook for fetching paginated admin file list
 */
export function useAdminFiles(params: AdminFileListParams) {
  return useQuery({
    queryKey: adminFileKeys.list(params),
    queryFn: () => adminFilesApi.getList(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching single file details
 */
export function useAdminFileDetail(id: number | null) {
  return useQuery({
    queryKey: adminFileKeys.detail(id!),
    queryFn: () => adminFilesApi.getById(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for deleting a file
 */
export function useAdminDeleteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminFilesApi.deleteFile(id),
    onSuccess: (data) => {
      toast.success(data.message || 'File deleted successfully.');
      queryClient.invalidateQueries({ queryKey: adminFileKeys.all });
    },
    onError: (error) => {
      toast.error(extractApiError(error).message);
    },
  });
}

/**
 * Hook for downloading a file (opens signed URL)
 */
export function useAdminDownloadFile() {
  return useMutation({
    mutationFn: (id: number) => adminFilesApi.getDownloadUrl(id),
    onSuccess: (data) => {
      if (data.data?.url) {
        window.open(data.data.url, '_blank');
      }
    },
    onError: (error) => {
      toast.error(extractApiError(error).message);
    },
  });
}
