/**
 * Note type definitions for Phase 6 Notes Marketplace API
 */

import type { PaginationMeta, PaginationLinks } from './case';

// User embedded in Note
export interface NoteUser {
  id: number;
  name: string;
  email?: string;
  role?: string;
  is_creator?: boolean;
  is_verified?: boolean;
  auth_provider?: string;
  avatar_url?: string | null;
  created_at?: string;
}

// Note status type
export type NoteStatus = 'draft' | 'published';

// Note sort fields
export type NoteSortField = 'title' | 'created_at' | 'updated_at' | 'price_ngn' | 'price_usd' | 'status';

// Note list item (from GET /api/notes and GET /api/notes/my-notes)
export interface Note {
  id: number;
  title: string;
  slug: string;
  content: string | null;
  content_preview: string;
  is_private: boolean;
  tags: string[] | null;
  price_ngn: string;
  price_usd: string;
  is_free: boolean;
  is_paid: boolean;
  status: NoteStatus;
  thumbnail_url: string | null;
  user: NoteUser;
  created_at: string;
  updated_at: string;
}

// Query params for public notes list (GET /api/notes)
export interface NoteListParams {
  search?: string;
  tags?: string | string[];
  free?: boolean;
  paid?: boolean;
  user?: number | string;
  sort?: NoteSortField;
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

// Query params for user's notes (GET /api/notes/my-notes)
export interface MyNotesParams extends NoteListParams {
  status?: NoteStatus;
  is_private?: boolean;
  with_trashed?: boolean;
}

// Create note request body
export interface CreateNoteData {
  title: string;
  content: string;
  slug?: string;
  is_private?: boolean;
  tags?: string[];
  price_ngn?: number;
  price_usd?: number;
  status?: NoteStatus;
  thumbnail_url?: string;
}

// Update note request body (all fields optional)
export interface UpdateNoteData {
  title?: string;
  content?: string;
  slug?: string;
  is_private?: boolean;
  tags?: string[];
  price_ngn?: number;
  price_usd?: number;
  status?: NoteStatus;
  thumbnail_url?: string;
}

// Paginated note list response
export interface NoteListResponse {
  success: boolean;
  message: string;
  data: Note[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// Single note response
export interface NoteResponse {
  success: boolean;
  message: string;
  data: Note;
}

// File upload response (POST /api/files)
export interface FileUploadResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    url: string;
    original_name: string;
    mime_type: string;
    size: number;
    created_at: string;
  };
}

// Generic API error response
export interface NoteApiError {
  success: false;
  message: string;
  errors: Record<string, string[]> | null;
}
