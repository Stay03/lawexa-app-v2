// Admin Lawyer Connection Request Types
// Based on API documentation: /docs/apiDocs/lawyer-connect.md

import type { LawyerConnectionRequest } from './connection';

// ============================================
// Query Parameters
// ============================================

export type LawyerConnectSortBy = 'created_at' | 'updated_at' | 'status';
export type LawyerConnectStatus = 'pending' | 'accepted' | 'rejected';

export interface AdminLawyerConnectListParams {
  status?: LawyerConnectStatus;
  lawyer_uuid?: string;
  sort_by?: LawyerConnectSortBy;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface AdminLawyerConnectAnalyticsParams {
  period?: 'today' | 'last_7_days' | 'last_30_days' | 'date_range';
  start_date?: string;
  end_date?: string;
}

// ============================================
// Pagination & Links
// ============================================

export interface AdminLawyerConnectPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
}

export interface AdminLawyerConnectLinks {
  first: string;
  last: string;
  prev: string | null;
  next: string | null;
}

// ============================================
// API Responses
// ============================================

export interface AdminLawyerConnectListResponse {
  success: boolean;
  message: string;
  data: LawyerConnectionRequest[];
  pagination: AdminLawyerConnectPagination;
  links: AdminLawyerConnectLinks;
}

export interface AdminLawyerConnectDetailResponse {
  success: boolean;
  message: string;
  data: LawyerConnectionRequest;
}

// ============================================
// Analytics Types
// ============================================

export interface LawyerConnectStatCard {
  value: number;
  change_percent: number | null;
}

export interface LawyerConnectStatCards {
  total_requests: LawyerConnectStatCard;
  pending_requests: LawyerConnectStatCard;
  lawyers_contacted: LawyerConnectStatCard;
}

export interface LawyerConnectRequestsOverTimePoint {
  date: string;
  count: number;
}

export interface LawyerConnectTopLawyer {
  uuid: string;
  name: string;
  total_requests: number;
  pending_requests: number;
}

export interface LawyerConnectAnalyticsPeriod {
  start: string;
  end: string;
  comparison_start: string;
  comparison_end: string;
}

export interface LawyerConnectAnalyticsData {
  period: LawyerConnectAnalyticsPeriod;
  stat_cards: LawyerConnectStatCards;
  charts: {
    requests_over_time: LawyerConnectRequestsOverTimePoint[];
  };
  tables: {
    top_lawyers: LawyerConnectTopLawyer[];
  };
}

export interface AdminLawyerConnectAnalyticsResponse {
  success: boolean;
  message: string;
  data: LawyerConnectAnalyticsData;
}
