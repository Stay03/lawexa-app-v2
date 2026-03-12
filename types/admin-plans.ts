// ============================================
// Admin Plan Management Types
// Based on API documentation: Admin Plan Endpoints
// ============================================

import type { AdminConversationsPagination, AdminConversationsLinks } from './admin';
import type { IPlanLimit } from './subscription';

// Plan list item (GET /api/admin/plans)
export interface AdminPlanListItem {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  amount: string;
  formatted_amount: string;
  currency: string;
  interval: string;
  interval_label: string;
  interval_count: number;
  is_free: boolean;
  is_active: boolean;
  is_featured: boolean;
  trial_eligible: boolean;
  sort_order: number;
  features: string[];
  limits: IPlanLimit[];
  subscriptions_count: number;
}

// Plan detail (GET /api/admin/plans/{id}) — same shape, API returns recent subscriptions separately
export interface AdminPlanDetailSubscription {
  id: number;
  user: {
    uuid: string;
    name: string;
    email: string;
  };
  status: string;
  status_label: string;
  amount: string;
  currency: string;
  start_date: string | null;
  created_at: string;
}

export interface AdminPlanDetail extends AdminPlanListItem {
  recent_subscriptions?: AdminPlanDetailSubscription[];
}

// Query params for GET /api/admin/plans
export interface AdminPlansParams {
  is_active?: boolean;
  per_page?: number;
  page?: number;
}

// PUT /api/admin/plans/{id} — update metadata
export interface AdminPlanUpdatePayload {
  name?: string;
  description?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  trial_eligible?: boolean;
  sort_order?: number;
  features?: string[];
}

// Limit input for PUT /api/admin/plans/{id}/limits
export type AdminLimitType = 'ai_messages' | 'bookmarks' | 'note_creations';
export type AdminLimitPeriod = 'month' | 'day' | 'lifetime' | 'billing_interval';

export interface AdminPlanLimitInput {
  limit_type: AdminLimitType;
  limit_value: number;
  period: AdminLimitPeriod;
}

export interface AdminPlanLimitsPayload {
  limits: AdminPlanLimitInput[];
}

// POST /api/admin/plans/sync response data
export interface AdminPlanSyncData {
  synced_count: number;
  deactivated_count: number;
  paystack_plans: number;
}

// API Responses

export interface AdminPlansListResponse {
  success: boolean;
  message: string;
  data: AdminPlanListItem[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

export interface AdminPlanDetailResponse {
  success: boolean;
  message: string;
  data: AdminPlanDetail;
}

export interface AdminPlanUpdateResponse {
  success: boolean;
  message: string;
  data: AdminPlanDetail;
}

export interface AdminPlanLimitsResponse {
  success: boolean;
  message: string;
  data: AdminPlanDetail | IPlanLimit[];
}

export interface AdminPlanSyncResponse {
  success: boolean;
  message: string;
  data: AdminPlanSyncData;
}
