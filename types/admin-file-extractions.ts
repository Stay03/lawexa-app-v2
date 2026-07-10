// Admin File text-extraction observability — types
// Backend: /api/admin/file-extractions[/summary] (role:admin)
// The list ALWAYS applies a status filter and defaults to status=failed.

import type { JobUserRef } from '@/lib/utils/observability';

export type FileExtractionStatus = 'pending' | 'done' | 'failed' | 'empty';

export const FILE_EXTRACTION_STATUSES: FileExtractionStatus[] = [
  'failed',
  'empty',
  'pending',
  'done',
];

export interface FileExtraction {
  id: number;
  original_name: string;
  category: string | null;
  mime_type: string | null;
  size: number;
  fileable_type: string | null;
  fileable_id: number | null;
  uploader: JobUserRef | null;
  extraction_status: FileExtractionStatus;
  extraction_method: string | null;
  extraction_error: string | null;
  char_count: number | null;
  page_count: number | null;
  extracted_at: string | null;
  created_at: string;
}

export interface FileExtractionSummary {
  files: Record<FileExtractionStatus, number>;
  failed_last_7_days: number;
}

export interface FileExtractionsParams {
  /** Required by the backend; defaults to `failed`. */
  status: FileExtractionStatus;
  user_id?: number;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}
