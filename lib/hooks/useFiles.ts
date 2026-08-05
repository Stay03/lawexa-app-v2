'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { filesApi } from '@/lib/api/files';
import { extractApiError } from '@/lib/utils/api-error';
import type { FileListParams } from '@/types/file';

// Query keys factory
export const fileKeys = {
  all: ['files'] as const,
  lists: () => [...fileKeys.all, 'list'] as const,
  list: (params: Omit<FileListParams, 'page'>) => [...fileKeys.lists(), params] as const,
  details: () => [...fileKeys.all, 'detail'] as const,
  detail: (id: number) => [...fileKeys.details(), id] as const,
};

/**
 * Hook for fetching infinite scrolling file list
 */
export function useInfiniteFiles(params: Omit<FileListParams, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: [...fileKeys.lists(), 'infinite', params] as const,
    queryFn: ({ pageParam }) => filesApi.getList({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { current_page, last_page } = lastPage.pagination;
      return current_page < last_page ? current_page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for uploading a content image
 */
export function useUploadImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => filesApi.uploadImage(file),
    onSuccess: (data) => {
      toast.success(data.message || 'Image uploaded successfully.');
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
    },
    onError: (error) => {
      toast.error(extractApiError(error).message);
    },
  });
}

/**
 * Hook for uploading a document
 */
export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => filesApi.uploadDocument(file),
    onSuccess: (data) => {
      toast.success(data.message || 'Document uploaded successfully.');
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
    },
    onError: (error) => {
      toast.error(extractApiError(error).message);
    },
  });
}

/**
 * Hook for deleting a file
 */
export function useDeleteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => filesApi.deleteFile(id),
    onSuccess: (data) => {
      toast.success(data.message || 'File deleted successfully.');
      // Remove all cached list data to prevent stale items showing across tabs
      queryClient.removeQueries({ queryKey: fileKeys.lists() });
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
    },
    onError: (error) => {
      toast.error(extractApiError(error).message);
    },
  });
}

/**
 * Hook for downloading a file (opens signed URL).
 *
 * The signed URL is minted first, so `window.open` runs OUTSIDE the click's
 * synchronous frame — which every engine treats as a popup, and which iOS
 * Safari answers with a bare `null` rather than an exception. Discarding that
 * return meant a tap that did nothing at all and said nothing either. It is
 * read, and a blocked open lands in v1's own error channel.
 */
export function useDownloadFile() {
  return useMutation({
    mutationFn: (id: number) => filesApi.getDownloadUrl(id),
    onSuccess: (data) => {
      if (!data.data?.url) return;
      if (!window.open(data.data.url, '_blank')) {
        toast.error('Your browser blocked the file from opening. Allow pop-ups for this site and try again.');
      }
    },
    onError: (error) => {
      toast.error(extractApiError(error).message);
    },
  });
}
