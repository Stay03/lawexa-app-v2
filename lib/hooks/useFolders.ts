'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foldersApi } from '@/lib/api/folders';
import { bookmarkKeys } from './useBookmarks';
import type {
  FolderListParams,
  MyFoldersParams,
  FolderItemsParams,
  CreateFolderData,
  UpdateFolderData,
  FolderItemData,
} from '@/types/folder';

// Query key factory
export const folderKeys = {
  all: ['folders'] as const,
  lists: () => [...folderKeys.all, 'list'] as const,
  list: (params: FolderListParams) => [...folderKeys.lists(), params] as const,
  myFolders: () => [...folderKeys.all, 'my-folders'] as const,
  myFoldersList: (params: MyFoldersParams) => [...folderKeys.myFolders(), params] as const,
  details: () => [...folderKeys.all, 'detail'] as const,
  detail: (uuid: string) => [...folderKeys.details(), uuid] as const,
  items: (uuid: string) => [...folderKeys.all, 'items', uuid] as const,
  itemsList: (uuid: string, params: FolderItemsParams) => [...folderKeys.items(uuid), params] as const,
};

/**
 * Hook for fetching paginated public folders list
 */
export function useFolders(params: FolderListParams = {}) {
  return useQuery({
    queryKey: folderKeys.list(params),
    queryFn: () => foldersApi.getList(params),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook for fetching authenticated user's folders
 */
export function useMyFolders(params: MyFoldersParams = {}) {
  return useQuery({
    queryKey: folderKeys.myFoldersList(params),
    queryFn: () => foldersApi.getMyFolders(params),
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Hook for fetching single folder by UUID
 */
export function useFolder(uuid: string) {
  return useQuery({
    queryKey: folderKeys.detail(uuid),
    queryFn: () => foldersApi.getByUuid(uuid),
    enabled: !!uuid,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for fetching folder items
 */
export function useFolderItems(uuid: string, params: FolderItemsParams = {}) {
  return useQuery({
    queryKey: folderKeys.itemsList(uuid, params),
    queryFn: () => foldersApi.getItems(uuid, params),
    enabled: !!uuid,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook for creating a new folder
 */
export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFolderData) => foldersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: folderKeys.myFolders() });
      queryClient.invalidateQueries({ queryKey: folderKeys.details() });
    },
  });
}

/**
 * Hook for updating a folder
 */
export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: UpdateFolderData }) =>
      foldersApi.update(uuid, data),
    onSuccess: (response) => {
      if (response.data?.uuid) {
        queryClient.invalidateQueries({ queryKey: folderKeys.detail(response.data.uuid) });
      }
      queryClient.invalidateQueries({ queryKey: folderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: folderKeys.myFolders() });
    },
  });
}

/**
 * Hook for deleting a folder
 */
export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uuid: string) => foldersApi.delete(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: folderKeys.myFolders() });
      queryClient.invalidateQueries({ queryKey: folderKeys.details() });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    },
  });
}

/**
 * Hook for restoring a soft-deleted folder
 */
export function useRestoreFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => foldersApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: folderKeys.myFolders() });
      queryClient.invalidateQueries({ queryKey: folderKeys.details() });
    },
  });
}

/**
 * Hook for adding an item to a folder
 */
export function useAddFolderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: FolderItemData }) =>
      foldersApi.addItem(uuid, data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: folderKeys.items(variables.uuid) });
      queryClient.invalidateQueries({ queryKey: folderKeys.detail(variables.uuid) });
    },
  });
}

/**
 * Hook for removing an item from a folder
 */
export function useRemoveFolderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: FolderItemData }) =>
      foldersApi.removeItem(uuid, data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: folderKeys.items(variables.uuid) });
      queryClient.invalidateQueries({ queryKey: folderKeys.detail(variables.uuid) });
    },
  });
}
