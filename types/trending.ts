/**
 * Trending type definitions for Phase 11 Trending System API
 */

import type { PaginationMeta, PaginationLinks } from './case';

// Time range options for trending queries
export type TrendingTimeRange = 'today' | 'week' | 'month' | 'year' | 'custom';

// --- Base trending fields shared by all items ---
interface TrendingItemBase {
  id: number;
  type: 'case' | 'note';
  title: string;
  slug: string;
  trending_score: number;
  views_count: number;
  unique_viewers: number;
  last_viewed_at: string | null;
}

// --- Trending case from /api/trending (mixed endpoint, no court/country) ---
export interface TrendingCaseItem extends TrendingItemBase {
  type: 'case';
  judgment_date: string | null;
  citation: string | null;
  level: string | null;
}

// --- Trending case from /api/trending/cases (dedicated endpoint) ---
export interface TrendingCaseDetailItem extends TrendingCaseItem {
  court: string | null;
  country: {
    name: string;
    code: string;
  } | null;
}

// --- Trending note from /api/trending (mixed endpoint, no author) ---
export interface TrendingNoteItem extends TrendingItemBase {
  type: 'note';
  content_preview: string;
  tags: string[] | null;
  price_ngn: string | null;
  price_usd: string | null;
  is_free: boolean;
  thumbnail_url: string | null;
}

// --- Trending note from /api/trending/notes (dedicated endpoint) ---
export interface TrendingNoteDetailItem extends TrendingNoteItem {
  author: {
    id: number;
    name: string;
  } | null;
}

// Union type for mixed endpoint items
export type TrendingItem = TrendingCaseItem | TrendingNoteItem;

// --- Filters applied metadata ---
export interface TrendingFiltersApplied {
  university: string | null;
  level: string | null;
  country: string | null;
  time_range: string | null;
}

// --- API Response types ---
export interface TrendingCasesResponse {
  success: boolean;
  message: string;
  data: TrendingCaseDetailItem[];
  pagination: PaginationMeta;
  links: PaginationLinks;
  meta: {
    filters_applied: TrendingFiltersApplied;
  };
}

export interface TrendingNotesResponse {
  success: boolean;
  message: string;
  data: TrendingNoteDetailItem[];
  pagination: PaginationMeta;
  links: PaginationLinks;
  meta: {
    filters_applied: TrendingFiltersApplied;
  };
}

// --- Query params ---
export interface TrendingParams {
  university?: string;
  level?: string;
  country?: string;
  time_range?: TrendingTimeRange;
  start_date?: string;
  end_date?: string;
  per_page?: number;
  page?: number;
}
