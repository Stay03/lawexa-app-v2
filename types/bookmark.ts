/**
 * Bookmark type definitions for Phase 7 API
 */

import type { PaginationMeta, PaginationLinks } from './case';

// Bookmarkable content type
export type BookmarkType = 'case' | 'note';

// Case summary as returned inside a Bookmark object
export interface BookmarkCaseContent {
  id: number;
  title: string;
  slug: string;
  judgment_date: string | null;
  citation: string | null;
  is_bookmarked: boolean;
  bookmarks_count: number;
}

// Note summary as returned inside a Bookmark object
export interface BookmarkNoteContent {
  id: number;
  title: string;
  slug: string;
  content_preview: string;
  user: { id: number; name: string };
  tags: string[] | null;
  price_ngn: string;
  price_usd: string;
  is_free: boolean;
  thumbnail_url: string | null;
  is_bookmarked: boolean;
  bookmarks_count: number;
  created_at: string;
}

// Single bookmark item from list endpoint
export interface Bookmark {
  id: number;
  type: BookmarkType;
  content: BookmarkCaseContent | BookmarkNoteContent;
  created_at: string;
}

// GET /api/bookmarks response
export interface BookmarkListResponse {
  success: boolean;
  message: string;
  data: Bookmark[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// POST /api/bookmarks request body
export interface ToggleBookmarkData {
  type: BookmarkType;
  id: number;
}

// POST /api/bookmarks response (added)
export interface BookmarkToggleAddedResponse {
  success: boolean;
  message: string;
  data: {
    bookmarked: true;
    bookmark: Bookmark;
  };
}

// POST /api/bookmarks response (removed)
export interface BookmarkToggleRemovedResponse {
  success: boolean;
  message: string;
  data: {
    bookmarked: false;
  };
}

// Union type for toggle response
export type BookmarkToggleResponse =
  | BookmarkToggleAddedResponse
  | BookmarkToggleRemovedResponse;

// GET /api/bookmarks/check response
export interface BookmarkCheckResponse {
  success: boolean;
  message: string;
  data: {
    bookmarked: boolean;
  };
}

// Query params for bookmark list
export interface BookmarkListParams {
  type?: BookmarkType;
  per_page?: number;
  page?: number;
}
