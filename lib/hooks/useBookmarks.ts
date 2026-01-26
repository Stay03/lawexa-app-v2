'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookmarksApi } from '@/lib/api/bookmarks';
import { caseKeys } from './useCases';
import { noteKeys } from './useNotes';
import type { BookmarkListParams, BookmarkType } from '@/types/bookmark';
import type { CaseDetailResponse, CaseListResponse } from '@/types/case';
import type { NoteResponse, NoteListResponse } from '@/types/note';

// Query key factory
export const bookmarkKeys = {
  all: ['bookmarks'] as const,
  lists: () => [...bookmarkKeys.all, 'list'] as const,
  list: (params: BookmarkListParams) => [...bookmarkKeys.lists(), params] as const,
  checks: () => [...bookmarkKeys.all, 'check'] as const,
  check: (type: string, id: number) => [...bookmarkKeys.checks(), type, id] as const,
};

/**
 * Hook for fetching paginated bookmark list
 */
export function useBookmarks(params: BookmarkListParams = {}) {
  return useQuery({
    queryKey: bookmarkKeys.list(params),
    queryFn: () => bookmarksApi.getList(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook for checking if content is bookmarked
 */
export function useBookmarkCheck(type: BookmarkType, id: number) {
  return useQuery({
    queryKey: bookmarkKeys.check(type, id),
    queryFn: () => bookmarksApi.check(type, id),
    enabled: !!type && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for toggling bookmark with optimistic updates.
 *
 * On mutation we:
 * 1. Optimistically toggle is_bookmarked and adjust bookmarks_count
 *    in any matching case/note detail and list query caches.
 * 2. Invalidate bookmark list/check caches on settle.
 * 3. On error, roll back to cached snapshots.
 */
export function useToggleBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { type: BookmarkType; id: number }) =>
      bookmarksApi.toggle(data),

    onMutate: async (variables) => {
      const { type, id } = variables;
      const snapshots: Array<{ queryKey: readonly unknown[]; data: unknown }> = [];

      if (type === 'case') {
        // Cancel outgoing refetches so they don't overwrite optimistic update
        await queryClient.cancelQueries({ queryKey: caseKeys.details() });
        await queryClient.cancelQueries({ queryKey: caseKeys.lists() });

        // Optimistically update case detail caches
        const caseDetailQueries = queryClient.getQueriesData<CaseDetailResponse>({
          queryKey: caseKeys.details(),
        });
        for (const [queryKey, data] of caseDetailQueries) {
          if (data?.data && data.data.id === id) {
            snapshots.push({ queryKey, data });
            queryClient.setQueryData(queryKey, {
              ...data,
              data: {
                ...data.data,
                is_bookmarked: !data.data.is_bookmarked,
                bookmarks_count: data.data.is_bookmarked
                  ? Math.max(0, data.data.bookmarks_count - 1)
                  : data.data.bookmarks_count + 1,
              },
            });
          }
        }

        // Optimistically update case list caches
        const caseListQueries = queryClient.getQueriesData<CaseListResponse>({
          queryKey: caseKeys.lists(),
        });
        for (const [queryKey, data] of caseListQueries) {
          if (data?.data) {
            const caseIndex = data.data.findIndex((c) => c.id === id);
            if (caseIndex !== -1) {
              snapshots.push({ queryKey, data });
              const updatedData = [...data.data];
              const item = updatedData[caseIndex];
              updatedData[caseIndex] = {
                ...item,
                is_bookmarked: !item.is_bookmarked,
                bookmarks_count: item.is_bookmarked
                  ? Math.max(0, item.bookmarks_count - 1)
                  : item.bookmarks_count + 1,
              };
              queryClient.setQueryData(queryKey, { ...data, data: updatedData });
            }
          }
        }
      } else {
        // type === 'note'
        await queryClient.cancelQueries({ queryKey: noteKeys.details() });
        await queryClient.cancelQueries({ queryKey: noteKeys.lists() });

        // Optimistically update note detail caches
        const noteDetailQueries = queryClient.getQueriesData<NoteResponse>({
          queryKey: noteKeys.details(),
        });
        for (const [queryKey, data] of noteDetailQueries) {
          if (data?.data && data.data.id === id) {
            snapshots.push({ queryKey, data });
            queryClient.setQueryData(queryKey, {
              ...data,
              data: {
                ...data.data,
                is_bookmarked: !data.data.is_bookmarked,
                bookmarks_count: data.data.is_bookmarked
                  ? Math.max(0, data.data.bookmarks_count - 1)
                  : data.data.bookmarks_count + 1,
              },
            });
          }
        }

        // Optimistically update note list caches
        const noteListQueries = queryClient.getQueriesData<NoteListResponse>({
          queryKey: noteKeys.lists(),
        });
        for (const [queryKey, data] of noteListQueries) {
          if (data?.data) {
            const noteIndex = data.data.findIndex((n) => n.id === id);
            if (noteIndex !== -1) {
              snapshots.push({ queryKey, data });
              const updatedData = [...data.data];
              const item = updatedData[noteIndex];
              updatedData[noteIndex] = {
                ...item,
                is_bookmarked: !item.is_bookmarked,
                bookmarks_count: item.is_bookmarked
                  ? Math.max(0, item.bookmarks_count - 1)
                  : item.bookmarks_count + 1,
              };
              queryClient.setQueryData(queryKey, { ...data, data: updatedData });
            }
          }
        }
      }

      return { snapshots };
    },

    onError: (_error, _variables, context) => {
      // Roll back all snapshots on error
      if (context?.snapshots) {
        for (const { queryKey, data } of context.snapshots) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },

    onSettled: () => {
      // Invalidate bookmark lists and checks to refetch from server
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.checks() });
    },
  });
}
