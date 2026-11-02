/**
 * File type definitions for user file management
 */

import type { PaginationMeta, PaginationLinks } from './case';

// File categories
export type FileCategory = 'content-image' | 'document';

// Upload status
export type FileUploadStatus = 'completed' | 'pending' | 'failed';

// File resource
// A scanned PDF's pages being read into text (Backend dc79c07d, 1 November 2026).
export type OcrStatus = 'pending' | 'done' | 'partial' | 'failed';

export interface UserFile {
  id: number;
  url: string | null;
  original_name: string;
  mime_type: string;
  size: number;
  category: FileCategory;
  upload_status: FileUploadStatus;
  created_at: string;
  /**
   * How far the server has got with reading the file's text (Backend,
   * `chat-no-extract`, 2 November 2026). Absent on a server from before it.
   */
  extraction_status?: 'pending' | 'done' | 'empty' | 'failed' | 'skipped' | null;
  /** A later server: pages read so far, and the file's page count. */
  pages_read?: number | null;
  page_count?: number | null;
  /** null when the file has no scanned pages or is not a PDF. */
  ocr_status?: OcrStatus | null;
  /** Pages with no text of their own; null until the file has been looked at. */
  scanned_pages?: number | null;
  /** Of those, how many are read into text so far. */
  ocr_pages_read?: number | null;
  /** How many scanned pages the plan reads for this file; null = no limit. */
  ocr_pages_cap?: number | null;
  /** Whose plan sets that cap: the uploader's own, or the Space holder's (a Space or channel file). */
  ocr_cap_from?: 'own_plan' | 'space_plan' | null;
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

// A Word or RTF file as readable pages (GET /files/{id}/preview): clean
// HTML, already passed through the server's NoteHtmlSanitizer. The client
// still sanitises it again before it renders (lib/notes/note-html.ts).
export interface FilePreviewResponse {
  success: boolean;
  message: string;
  data: { id: number; name: string; html: string };
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
  /** Only the files in none of the owner's own live folders (`?unfiled=1`). */
  unfiled?: boolean;
}
