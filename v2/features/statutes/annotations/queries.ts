import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import { STALE_TIMES } from '@/v2/runtime/query';
import {
  pendingAnnotation,
  type ReaderAnnotation,
  type ReaderAnnotationCreate,
  type ReaderAnnotationUpdate,
} from './model';

/**
 * The reader's own annotations on one statute, and the three ways to change
 * them. Every change shows at once and is undone if the server refuses (the
 * global mutation-error toast then says why): a highlight is a small, quick
 * act, and waiting on the network before the words take their colour would
 * make it feel broken. The list is refetched after each change so the rows
 * end up exactly as stored.
 */
export const annotationQueries = {
  all: ['reader-annotations'] as const,

  mine: (slug: string) =>
    queryOptions({
      queryKey: [...annotationQueries.all, slug] as const,
      queryFn: async () =>
        (await apiClient.get<ApiResponse<ReaderAnnotation[]>>(`/statutes/${slug}/my-annotations`)).data.data ?? [],
      staleTime: STALE_TIMES.standard,
    }),
};

function useCacheEdit(slug: string) {
  const queryClient = useQueryClient();
  const key = annotationQueries.mine(slug).queryKey;
  return {
    /** Apply a change to the cached list, returning what to put back on failure. */
    edit: async (change: (rows: ReaderAnnotation[]) => ReaderAnnotation[]) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<ReaderAnnotation[]>(key);
      queryClient.setQueryData<ReaderAnnotation[]>(key, (rows) => change(rows ?? []));
      return before;
    },
    restore: (before: ReaderAnnotation[] | undefined) => queryClient.setQueryData(key, before),
    settle: () => queryClient.invalidateQueries({ queryKey: key }),
  };
}

let pendingId = 0;

export function useCreateAnnotation(slug: string) {
  const cache = useCacheEdit(slug);
  return useMutation({
    mutationFn: async (draft: ReaderAnnotationCreate) =>
      (await apiClient.post<ApiResponse<ReaderAnnotation>>(`/statutes/${slug}/my-annotations`, draft)).data.data,
    onMutate: (draft) => {
      pendingId += 1;
      const row = pendingAnnotation(draft, new Date().toISOString(), String(pendingId));
      return cache.edit((rows) => [...rows, row]);
    },
    onError: (_error, _draft, before) => cache.restore(before),
    onSettled: () => cache.settle(),
  });
}

export function useUpdateAnnotation(slug: string) {
  const cache = useCacheEdit(slug);
  return useMutation({
    mutationFn: async ({ uuid, change }: { uuid: string; change: ReaderAnnotationUpdate }) =>
      (await apiClient.patch<ApiResponse<ReaderAnnotation>>(`/my-annotations/${uuid}`, change)).data.data,
    onMutate: ({ uuid, change }) =>
      cache.edit((rows) => rows.map((row) => (row.uuid === uuid ? { ...row, ...change } : row))),
    onError: (_error, _vars, before) => cache.restore(before),
    onSettled: () => cache.settle(),
  });
}

export function useDeleteAnnotation(slug: string) {
  const cache = useCacheEdit(slug);
  return useMutation({
    mutationFn: async (uuid: string) => {
      await apiClient.delete(`/my-annotations/${uuid}`);
    },
    onMutate: (uuid) => cache.edit((rows) => rows.filter((row) => row.uuid !== uuid)),
    onError: (_error, _uuid, before) => cache.restore(before),
    onSettled: () => cache.settle(),
  });
}
