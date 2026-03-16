// Admin Statutes - TypeScript Type Definitions
// Based on AKN Import API documentation

import type { Country } from './admin-cases';

/******************************************************************************
                                Import Types
******************************************************************************/

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * AKN import record from the API
 */
export interface StatuteImport {
  id: string; // UUID
  status: ImportStatus;
  status_label: string;
  original_filename: string;
  total_nodes: number;
  processed_nodes: number;
  progress: number; // 0-100
  statute_id: number | null;
  statute_slug: string | null;
  error_message: string | null;
  warnings: string[] | null;
  options: {
    title?: string;
    year?: number;
    country_id?: number;
  } | null;
  created_at: string;
  updated_at: string;
}

/**
 * Data sent when starting an AKN import
 */
export interface ImportAknData {
  file: File;
  title?: string;
  year?: number;
  country_id?: number;
}

/******************************************************************************
                                Statute Admin Types
******************************************************************************/

export type StatuteStatus = 'active' | 'repealed' | 'amended';

export interface StatuteCreator {
  id: number;
  name: string;
}

/**
 * Statute summary for admin list view
 */
export interface AdminStatute {
  id: number;
  uuid: string;
  title: string;
  short_title: string | null;
  slug: string;
  preamble: string | null;
  description: string | null;
  country: Country | null;
  year: number;
  commencement_date: string | null;
  status: StatuteStatus;
  status_label: string;
  creator: StatuteCreator | null;
  is_bookmarked: boolean;
  bookmarks_count: number;
  nodes_count?: number;
  root_nodes_count?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Statute detail (single GET)
 */
export interface AdminStatuteDetail extends AdminStatute {
  root_nodes_count: number;
  nodes_count: number;
}

/******************************************************************************
                                Query Parameters
******************************************************************************/

export interface AdminStatutesParams {
  page?: number;
  per_page?: number;
  search?: string;
  country?: number;
  status?: StatuteStatus;
  year?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface AdminStatuteImportsParams {
  page?: number;
  per_page?: number;
}

/******************************************************************************
                                API Response Wrappers
******************************************************************************/

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: Record<string, string[]> | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number;
    to: number;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}
