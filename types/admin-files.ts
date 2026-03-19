/**
 * Type definitions for admin file management
 */

import type { PaginationMeta, PaginationLinks } from './case';
import type { ViewAnalyticsPeriod } from './admin';

// ============================================
// Period & Granularity
// ============================================

export type FileAnalyticsPeriod = ViewAnalyticsPeriod;

export type FileAnalyticsGranularity = 'hour' | 'day';

// ============================================
// Analytics Params
// ============================================

export interface AdminFileAnalyticsParams {
  period?: FileAnalyticsPeriod;
  date?: string;
  start_date?: string;
  end_date?: string;
}

// ============================================
// Stat Cards
// ============================================

export interface FileStatCardItem {
  value: number;
  change_percent: number | null;
}

export interface FileAnalyticsStatCards {
  total_files: FileStatCardItem;
  total_storage: FileStatCardItem;
  new_files: FileStatCardItem;
  failed_uploads: FileStatCardItem;
}

// ============================================
// Chart Data Types
// ============================================

export interface FileUploadsOverTimePoint {
  date?: string;
  hour?: string;
  uploads: number;
  total_size: number;
}

export interface FileStorageOverTimePoint {
  date?: string;
  hour?: string;
  cumulative_size: number;
  added_size: number;
}

export interface FileCategoryDistributionPoint {
  category: string;
  count: number;
  total_size: number;
  percentage: number;
}

export interface FileMimeTypeDistributionPoint {
  mime_type: string;
  count: number;
  total_size: number;
  percentage: number;
}

export interface FileAnalyticsCharts {
  uploads_over_time: FileUploadsOverTimePoint[];
  storage_over_time: FileStorageOverTimePoint[];
  category_distribution: FileCategoryDistributionPoint[];
  mime_type_distribution: FileMimeTypeDistributionPoint[];
}

// ============================================
// Table Row Types
// ============================================

export interface FileTopUploaderRow {
  id: number;
  name: string;
  email: string;
  file_count: number;
  total_size: number;
}

export interface FileLargestFileRow {
  id: number;
  original_name: string;
  size: number;
  category: string;
  mime_type: string;
  uploader_name: string;
  created_at: string;
}

export interface FileRecentUploadRow {
  id: number;
  original_name: string;
  size: number;
  category: string;
  upload_status: string;
  uploader_name: string;
  created_at: string;
}

export interface FileAnalyticsTables {
  top_uploaders: FileTopUploaderRow[];
  largest_files: FileLargestFileRow[];
  recent_uploads: FileRecentUploadRow[];
}

// ============================================
// Analytics Response
// ============================================

export interface FileAnalyticsPeriodInfo {
  start: string;
  end: string;
  comparison_start: string;
  comparison_end: string;
}

export interface FileAnalyticsData {
  period: FileAnalyticsPeriodInfo;
  granularity: FileAnalyticsGranularity;
  stat_cards: FileAnalyticsStatCards;
  charts: FileAnalyticsCharts;
  tables: FileAnalyticsTables;
}

export interface AdminFileAnalyticsResponse {
  success: boolean;
  message: string;
  data: FileAnalyticsData;
}

// ============================================
// File List Types
// ============================================

export type AdminFileCategory = 'document' | 'content-image' | 'avatar' | 'case-report';
export type AdminFileDisk = 'local' | 's3';
export type AdminFileUploadStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AdminFileSortBy = 'created_at' | 'size' | 'original_name';

export interface AdminFileListParams {
  page?: number;
  per_page?: number;
  search?: string;
  category?: string;
  disk?: string;
  upload_status?: string;
  mime_type?: string;
  uploaded_by?: number;
  created_from?: string;
  created_to?: string;
  size_min?: number;
  size_max?: number;
  sort_by?: AdminFileSortBy;
  sort_order?: 'asc' | 'desc';
}

export interface AdminFileUploader {
  id: number;
  name: string;
  email: string;
}

export interface AdminFileListItem {
  id: number;
  original_name: string;
  filename: string;
  path: string;
  disk: string;
  mime_type: string;
  size: number;
  hash: string;
  category: string;
  upload_status: string;
  url: string | null;
  uploader: AdminFileUploader;
  created_at: string;
  updated_at: string;
}

export interface AdminFileListResponse {
  success: boolean;
  message: string;
  data: AdminFileListItem[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// ============================================
// File Detail Types
// ============================================

export interface AdminFileDetail extends AdminFileListItem {
  metadata: Record<string, unknown> | null;
  fileable_type: string | null;
  fileable_id: number | null;
  fileable: unknown | null;
}

export interface AdminFileDetailResponse {
  success: boolean;
  message: string;
  data: AdminFileDetail;
}

// ============================================
// File Actions
// ============================================

export interface AdminFileDeleteResponse {
  success: boolean;
  message: string;
  data: null;
}

export interface AdminFileDownloadResponse {
  success: boolean;
  message: string;
  data: { url: string };
}
