/**
 * Content Request type definitions for Phase 14 API
 */

import type { PaginationMeta, PaginationLinks } from './case';

// Content types that can be requested
export type ContentRequestType = 'case' | 'note';

// Status values for content requests
export type ContentRequestStatus = 'pending' | 'in_progress' | 'fulfilled' | 'rejected';

// Content types that can be linked when fulfilled
export type CreatedContentType = 'case' | 'note' | 'statute' | 'provision';

// User summary within a content request
export interface ContentRequestUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

// Created content summary (polymorphic — case or note)
export interface CreatedContentSummary {
  id: number;
  title: string;
  slug: string;
  [key: string]: unknown;
}

// Full content request resource
export interface ContentRequest {
  id: number;
  uuid: string;
  user: ContentRequestUser | null;
  type: ContentRequestType;
  title: string;
  additional_notes: string | null;
  created_content_type: CreatedContentType | null;
  created_content_id: number | null;
  created_content: CreatedContentSummary | null;
  status: ContentRequestStatus;
  status_label: string;
  fulfilled_by: ContentRequestUser | null;
  fulfilled_at: string | null;
  rejected_by: ContentRequestUser | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Paginated content request list response
export interface ContentRequestListResponse {
  success: boolean;
  message: string;
  data: ContentRequest[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// Single content request response
export interface ContentRequestResponse {
  success: boolean;
  message: string;
  data: ContentRequest;
}

// Query params for content request list
export interface ContentRequestListParams {
  status?: ContentRequestStatus;
  type?: ContentRequestType;
  sort?: 'created_at' | 'updated_at';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

// POST /api/content-requests request payload
export interface SubmitContentRequestData {
  type: ContentRequestType;
  title: string;
  additional_notes?: string;
}

// Admin-specific query params for content request list
export interface AdminContentRequestsParams {
  status?: ContentRequestStatus;
  type?: ContentRequestType;
  sort?: 'created_at' | 'updated_at';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  search?: string;
}

// PUT /api/content-requests/{uuid}/status request payload
export interface UpdateStatusData {
  status: ContentRequestStatus;
}

// PUT /api/content-requests/{uuid}/fulfill request payload
export interface FulfillData {
  created_content_type: CreatedContentType;
  created_content_id: number;
}

// PUT /api/content-requests/{uuid}/reject request payload
export interface RejectData {
  rejection_reason: string;
}
