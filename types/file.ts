/**
 * File type definitions for user file management
 */

import type { PaginationMeta, PaginationLinks } from './case';

// File categories
export type FileCategory = 'content-image' | 'document';

// Upload status
export type FileUploadStatus = 'completed' | 'pending' | 'failed';

// File resource
export interface UserFile {
  id: number;
  url: string | null;
  original_name: string;
  mime_type: string;
  size: number;
  category: FileCategory;
  upload_status: FileUploadStatus;
  created_at: string;
}

// File detail (includes uploader)
export interface UserFileDetail extends UserFile {
  uploader: {
    id: number;
    name: string;
  };
}

// Paginated file list response
export interface FileListResponse {
  success: boolean;
  message: string;
  data: UserFile[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// Single file response
export interface FileDetailResponse {
  success: boolean;
  message: string;
  data: UserFileDetail;
}

// Upload response
export interface FileUploadResponse {
  success: boolean;
  message: string;
  data: UserFile;
}

// Download response (signed URL)
export interface FileDownloadResponse {
  success: boolean;
  message: string;
  data: { url: string };
}

// Delete response
export interface FileDeleteResponse {
  success: boolean;
  message: string;
  data: null;
}

// Query params for file list
export interface FileListParams {
  page?: number;
  per_page?: number;
  category?: FileCategory;
}
