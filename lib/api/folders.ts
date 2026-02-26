import { apiClient } from './client';
import type {
  FolderListResponse,
  MyFolderListResponse,
  FolderResponse,
  FolderItemsResponse,
  FolderItemResponse,
  FolderDeleteResponse,
  FolderListParams,
  MyFoldersParams,
  FolderItemsParams,
  CreateFolderData,
  UpdateFolderData,
  FolderItemData,
} from '@/types/folder';

/**
 * Folders API service for Phase 18 endpoints
 */
export const foldersApi = {
  /**
   * Get paginated list of public folders
   */
  getList: async (params: FolderListParams = {}): Promise<FolderListResponse> => {
    const response = await apiClient.get<FolderListResponse>('/folders', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        search: params.search || undefined,
        parent_id: params.parent_id || undefined,
        sort: params.sort || undefined,
        order: params.order || undefined,
      },
    });
    return response.data;
  },

  /**
   * Get paginated list of authenticated user's folders
   */
  getMyFolders: async (params: MyFoldersParams = {}): Promise<MyFolderListResponse> => {
    const response = await apiClient.get<MyFolderListResponse>('/folders/my-folders', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        search: params.search || undefined,
        parent_id: params.parent_id || undefined,
        is_private: params.is_private ?? undefined,
        with_trashed: params.with_trashed ?? undefined,
        sort: params.sort || undefined,
        order: params.order || undefined,
      },
    });
    return response.data;
  },

  /**
   * Get single folder by UUID
   */
  getByUuid: async (uuid: string): Promise<FolderResponse> => {
    const response = await apiClient.get<FolderResponse>(`/folders/${uuid}`);
    return response.data;
  },

  /**
   * Deep link to a folder by slug path
   */
  navigate: async (path: string, ownerId?: number): Promise<FolderResponse> => {
    const params = ownerId ? { owner_id: ownerId } : undefined;
    const response = await apiClient.get<FolderResponse>(`/folders/navigate/${path}`, { params });
    return response.data;
  },

  /**
   * Create a new folder
   */
  create: async (data: CreateFolderData): Promise<FolderResponse> => {
    const response = await apiClient.post<FolderResponse>('/folders', data);
    return response.data;
  },

  /**
   * Update an existing folder by UUID
   */
  update: async (uuid: string, data: UpdateFolderData): Promise<FolderResponse> => {
    const response = await apiClient.put<FolderResponse>(`/folders/${uuid}`, data);
    return response.data;
  },

  /**
   * Delete a folder by UUID (soft delete)
   */
  delete: async (uuid: string): Promise<FolderDeleteResponse> => {
    const response = await apiClient.delete<FolderDeleteResponse>(`/folders/${uuid}`);
    return response.data;
  },

  /**
   * Restore a soft-deleted folder by numeric ID
   */
  restore: async (id: number): Promise<FolderResponse> => {
    const response = await apiClient.post<FolderResponse>(`/folders/${id}/restore`);
    return response.data;
  },

  /**
   * Get paginated list of items in a folder
   */
  getItems: async (uuid: string, params: FolderItemsParams = {}): Promise<FolderItemsResponse> => {
    const response = await apiClient.get<FolderItemsResponse>(`/folders/${uuid}/items`, {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        type: params.type || undefined,
        sort: params.sort || undefined,
        order: params.order || undefined,
      },
    });
    return response.data;
  },

  /**
   * Add an item to a folder
   */
  addItem: async (uuid: string, data: FolderItemData): Promise<FolderItemResponse> => {
    const response = await apiClient.post<FolderItemResponse>(`/folders/${uuid}/items`, data);
    return response.data;
  },

  /**
   * Remove an item from a folder
   */
  removeItem: async (uuid: string, data: FolderItemData): Promise<FolderDeleteResponse> => {
    const response = await apiClient.delete<FolderDeleteResponse>(`/folders/${uuid}/items`, { data });
    return response.data;
  },
};
