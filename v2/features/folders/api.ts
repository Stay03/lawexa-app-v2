import { apiClient } from '@/lib/api/client';
import type {
  FolderCreateInput,
  FolderEnvelope,
  FolderItemInput,
  FolderItemsEnvelope,
  FolderListEnvelope,
  FolderUpdateInput,
} from './types';

/**
 * The v2 folders wire layer — same axios client and endpoints as v1's
 * `lib/api/folders.ts`, typed against the probed v2 contract (`./types.ts`).
 *
 * TWO v1 ENDPOINTS ARE DELIBERATELY ABSENT:
 *  - the PUBLIC folder feed (`GET /folders`), because v2 shows a viewer their
 *    own folders only (decision 3) — the feed listed strangers' folders and,
 *    worse, the viewer's own private ones;
 *  - `navigate/{slug_path}`, because sibling folders may share a slug and the
 *    endpoint silently picks one. uuid is the only honest address.
 *
 * `restore` is also absent: it is real and it works, but no v2 surface offers
 * it this wave, and a wire function nothing calls is a claim nothing keeps.
 */

export interface FolderListParams {
  search?: string;
  page?: number;
  per_page?: number;
  /** uuid of the parent. OMITTED = the root level only — that is the server's default. */
  parent_id?: string;
}

export interface FolderItemsParams {
  page?: number;
  per_page?: number;
  /** Server-side type filter. An unknown value returns an empty list, not an error. */
  type?: string;
}

export const foldersApi = {
  /**
   * The viewer's own folders. ROOT ONLY unless `parent_id` names a folder —
   * that is the API's grain, and the reason v2 browses the tree one level at
   * a time rather than pretending to hold the whole thing.
   */
  mine: async (params: FolderListParams = {}): Promise<FolderListEnvelope> => {
    const response = await apiClient.get<FolderListEnvelope>('/folders/my-folders', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 20,
        search: params.search || undefined,
        parent_id: params.parent_id || undefined,
        sort: 'updated_at',
        order: 'desc',
      },
    });
    return response.data;
  },

  /** One folder, by the only address that holds: its uuid. */
  byUuid: async (uuid: string): Promise<FolderEnvelope> => {
    const response = await apiClient.get<FolderEnvelope>(
      `/folders/${encodeURIComponent(uuid)}`,
    );
    return response.data;
  },

  /** The folder's contents (NOT its subfolders — those arrive on the detail). */
  items: async (uuid: string, params: FolderItemsParams = {}): Promise<FolderItemsEnvelope> => {
    const response = await apiClient.get<FolderItemsEnvelope>(
      `/folders/${encodeURIComponent(uuid)}/items`,
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 20,
          type: params.type || undefined,
          sort: 'added_at',
          order: 'desc',
        },
      },
    );
    return response.data;
  },

  /** Create. The response carries NO `children` — never seed a detail cache with it. */
  create: async (data: FolderCreateInput): Promise<FolderEnvelope> => {
    const response = await apiClient.post<FolderEnvelope>('/folders', data);
    return response.data;
  },

  /** Rename, or re-parent (`parent_id: null` → root). Same response caveat as create. */
  update: async (uuid: string, data: FolderUpdateInput): Promise<FolderEnvelope> => {
    const response = await apiClient.put<FolderEnvelope>(
      `/folders/${encodeURIComponent(uuid)}`,
      data,
    );
    return response.data;
  },

  /**
   * Soft-delete. CASCADES to every descendant folder — and the items inside
   * are unfiled, not destroyed (probed: a restore brings the whole subtree and
   * its items back). That is what licenses an undo instead of a warning.
   */
  remove: async (uuid: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/folders/${encodeURIComponent(uuid)}`,
    );
    return response.data;
  },

  /** Add one item. A duplicate is a 422, not a silent no-op. */
  addItem: async (uuid: string, data: FolderItemInput): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/folders/${encodeURIComponent(uuid)}/items`,
      data,
    );
    return response.data;
  },

  /** Remove one item. Removing twice is a 404. The item itself is untouched. */
  removeItem: async (uuid: string, data: FolderItemInput): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/folders/${encodeURIComponent(uuid)}/items`,
      { data },
    );
    return response.data;
  },
};
