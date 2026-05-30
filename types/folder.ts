/**
 * Folder type definitions for Phase 18 Folders API
 */

import type { PaginationMeta, PaginationLinks } from './case';

// User embedded in folder summary (lightweight, for list views)
export interface FolderUserSummary {
  id: number;
  name: string;
  avatar_url: string | null;
}

// User embedded in folder detail (full)
export interface FolderUser {
  id: number;
  uuid: string;
  name: string;
  email: string;
  role: string;
  is_creator: boolean;
  is_verified: boolean;
  auth_provider: string;
  avatar_url: string | null;
  created_at: string;
}

// Folder sort fields
export type FolderSortField = 'created_at' | 'updated_at' | 'name';

// Folder item content types
export type FolderItemType = 'case' | 'note' | 'conversation' | 'folder' | 'statute' | 'file';

// Content payload for a folder item of type 'file' — mirrors the UserFile
// resource that the backend embeds under `content`.
export interface FolderFileContent {
  id: number;
  url: string | null;
  original_name: string;
  mime_type: string;
  size: number;
  category: string;
  upload_status: string;
  created_at: string;
}

// Folder summary (used in lists, children arrays, parent references)
export interface FolderSummary {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  slug_path: string;
  icon: string | null;
  color: string | null;
  is_private: boolean;
  user: FolderUserSummary;
  children_count: number;
  items_count: number;
  is_bookmarked: boolean;
  created_at: string;
}

// Full folder detail (from GET /api/folders/{uuid})
export interface FolderDetail {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  slug_path: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_private: boolean;
  user: FolderUser;
  parent: FolderSummary | null;
  children: FolderSummary[];
  children_count: number;
  items_count: number;
  is_bookmarked: boolean;
  bookmarks_count: number;
  views_count: number;
  created_at: string;
  updated_at: string;
}

// Folder from my-folders list (full resource, includes description, counts)
export interface MyFolder {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  slug_path: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_private: boolean;
  user: FolderUser;
  children_count: number;
  items_count: number;
  is_bookmarked: boolean;
  bookmarks_count: number;
  views_count: number;
  created_at: string;
  updated_at: string;
}

// Folder item (polymorphic content in a folder).
// Discriminated on `type`: file items carry a typed FolderFileContent,
// other types keep a loose content bag for now.
export type FolderItem =
  | {
      id: number;
      type: 'file';
      content: FolderFileContent;
      added_at: string;
    }
  | {
      id: number;
      type: Exclude<FolderItemType, 'file'>;
      content: Record<string, unknown>;
      added_at: string;
    };

// Query params for public folders list (GET /api/folders)
export interface FolderListParams {
  search?: string;
  parent_id?: string;
  sort?: FolderSortField;
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

// Query params for user's folders (GET /api/folders/my-folders)
export interface MyFoldersParams extends FolderListParams {
  is_private?: boolean;
  with_trashed?: boolean;
}

// Query params for folder items (GET /api/folders/{uuid}/items)
export interface FolderItemsParams {
  type?: FolderItemType;
  sort?: string;
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

// Create folder request body
export interface CreateFolderData {
  name: string;
  parent_id?: string;
  description?: string;
  icon?: string;
  color?: string;
  is_private?: boolean;
}

// Update folder request body
export interface UpdateFolderData {
  name?: string;
  parent_id?: string | null;
  description?: string;
  icon?: string;
  color?: string;
  is_private?: boolean;
}

// Add/remove item request body
export interface FolderItemData {
  type: FolderItemType;
  id: number | string;
}

// Paginated folder list response (public)
export interface FolderListResponse {
  success: boolean;
  message: string;
  data: FolderSummary[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// Paginated my-folders list response
export interface MyFolderListResponse {
  success: boolean;
  message: string;
  data: MyFolder[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// Single folder response
export interface FolderResponse {
  success: boolean;
  message: string;
  data: FolderDetail;
}

// Paginated folder items response
export interface FolderItemsResponse {
  success: boolean;
  message: string;
  data: FolderItem[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// Single folder item response (from add item)
export interface FolderItemResponse {
  success: boolean;
  message: string;
  data: FolderItem;
}

// Delete/remove response
export interface FolderDeleteResponse {
  success: boolean;
  message: string;
  data: null;
}

// Bookmark content for folders
export interface BookmarkFolderContent {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  slug_path: string;
  icon: string | null;
  color: string | null;
  is_private: boolean;
  children_count: number;
  items_count: number;
  is_bookmarked: boolean;
  created_at: string;
}
