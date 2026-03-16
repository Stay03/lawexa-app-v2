// Admin Statutes - TanStack Query Hooks
// Provides React Query hooks for statute management and AKN imports

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminStatutesApi } from '@/lib/api/admin-statutes';
import type {
  AdminStatutesParams,
  AdminStatuteImportsParams,
  ImportAknData,
  ImportStatus,
} from '@/types/admin-statutes';

/******************************************************************************
                            Query Key Factory
******************************************************************************/

export const adminStatutesKeys = {
  all: ['admin', 'statutes'] as const,

  // Statutes
  lists: () => [...adminStatutesKeys.all, 'list'] as const,
  list: (params: AdminStatutesParams) =>
    [...adminStatutesKeys.lists(), params] as const,
  details: () => [...adminStatutesKeys.all, 'detail'] as const,
  detail: (slug: string) => [...adminStatutesKeys.details(), slug] as const,

  // Imports
  imports: () => [...adminStatutesKeys.all, 'imports'] as const,
  importList: (params: AdminStatuteImportsParams) =>
    [...adminStatutesKeys.imports(), 'list', params] as const,
  importStatus: (uuid: string) =>
    [...adminStatutesKeys.imports(), 'status', uuid] as const,
};

/******************************************************************************
                            Statutes Query Hooks
******************************************************************************/

/**
 * Get paginated list of statutes with filters
 */
export function useAdminStatutes(params: AdminStatutesParams = {}) {
  return useQuery({
    queryKey: adminStatutesKeys.list(params),
    queryFn: () => adminStatutesApi.getStatutes(params),
    staleTime: 60 * 1000,
  });
}

/**
 * Get single statute by slug
 */
export function useAdminStatute(
  slug: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: slug
      ? adminStatutesKeys.detail(slug)
      : (['admin', 'statutes', 'detail', 'undefined'] as const),
    queryFn: () => adminStatutesApi.getStatute(slug!),
    enabled: !!slug && (options?.enabled !== false),
    staleTime: 60 * 1000,
  });
}

/**
 * Delete a statute
 */
export function useDeleteStatute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminStatutesApi.deleteStatute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminStatutesKeys.lists() });
    },
  });
}

/******************************************************************************
                            Import Query Hooks
******************************************************************************/

/**
 * Get paginated list of user's imports
 */
export function useStatuteImports(params: AdminStatuteImportsParams = {}) {
  return useQuery({
    queryKey: adminStatutesKeys.importList(params),
    queryFn: () => adminStatutesApi.getImports(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Poll import status by UUID
 * Auto-polls every 2.5s while status is pending or processing
 */
export function useImportStatus(
  uuid: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: uuid
      ? adminStatutesKeys.importStatus(uuid)
      : (['admin', 'statutes', 'imports', 'status', 'none'] as const),
    queryFn: () => adminStatutesApi.getImportStatus(uuid!),
    enabled: !!uuid && (options?.enabled !== false),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status as ImportStatus | undefined;
      if (status === 'pending' || status === 'processing') {
        return 2500;
      }
      return false;
    },
  });
}

/**
 * Upload an AKN XML file to start import
 */
export function useImportAkn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ImportAknData) => adminStatutesApi.importAkn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminStatutesKeys.imports() });
    },
  });
}

/**
 * Cancel a pending/processing import
 */
export function useCancelImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uuid: string) => adminStatutesApi.cancelImport(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminStatutesKeys.imports() });
    },
  });
}

/**
 * Delete an import record from history
 */
export function useDeleteImportRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uuid: string) => adminStatutesApi.deleteImportRecord(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminStatutesKeys.imports() });
    },
  });
}
