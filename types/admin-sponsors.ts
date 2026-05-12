// ============================================
// Admin Sponsor / Campaign / Grant Types
// Backend reference: PR d6488f9 — sponsor admin API
// All endpoints under /api/admin/* require auth:sanctum + admin/superadmin
// ============================================

import type {
  AdminConversationsPagination,
  AdminConversationsLinks,
} from './admin';

/******************************************************************************
                                  Sponsors
******************************************************************************/

export interface AdminSponsor {
  id: number;
  name: string;
  slug: string;
  contact_email: string | null;
  contact_name: string | null;
  notes: string | null;
  is_active: boolean;
  campaigns_count: number;
  active_campaigns_count?: number; // present on detail only
  created_at: string;
  deleted_at: string | null;
}

export interface AdminSponsorsParams {
  search?: string;
  per_page?: number;
  page?: number;
}

export interface AdminSponsorCreatePayload {
  name: string;
  contact_email?: string | null;
  contact_name?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface AdminSponsorUpdatePayload {
  name?: string;
  contact_email?: string | null;
  contact_name?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface AdminSponsorsListResponse {
  success: boolean;
  message: string;
  data: AdminSponsor[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

export interface AdminSponsorDetailResponse {
  success: boolean;
  message: string;
  data: AdminSponsor;
}

/******************************************************************************
                                  Campaigns
******************************************************************************/

export type AdminCampaignStatus = 'draft' | 'active' | 'ended';

export type AdminCustomPeriod =
  | 'day'
  | 'month'
  | 'billing_interval'
  | 'lifetime';

export interface AdminCampaignSponsorRef {
  id: number;
  name: string;
  slug: string;
}

export interface AdminCampaignPlanRef {
  id: number;
  name: string;
  slug: string;
  is_internal: boolean;
}

export interface AdminCampaign {
  id: number;
  sponsor: AdminCampaignSponsorRef;
  name: string;
  slug: string;
  plan: AdminCampaignPlanRef;
  duration_days: number;
  max_grants: number | null;
  starts_at: string | null;
  ends_at: string | null;
  status: AdminCampaignStatus;
  status_label: string;
  notes: string | null;
  grants_count?: number;
  active_grants_count?: number;
  created_at: string;
}

export interface AdminCampaignsParams {
  per_page?: number;
  page?: number;
}

// Branch A — reuse an existing plan (e.g. basic-monthly)
export interface AdminCampaignCreateExistingPlanPayload {
  name: string;
  plan_id: number;
  duration_days: number;
  max_grants?: number | null;
  notes?: string | null;
}

// Branch B — auto-create an internal sponsor plan with a custom quota
export interface AdminCampaignCreateCustomPlanPayload {
  name: string;
  custom_messages: number; // -1 = unlimited
  custom_period: AdminCustomPeriod;
  duration_days: number;
  max_grants?: number | null;
  notes?: string | null;
}

export type AdminCampaignCreatePayload =
  | AdminCampaignCreateExistingPlanPayload
  | AdminCampaignCreateCustomPlanPayload;

// PATCH only allows these fields — everything else returns 422
export interface AdminCampaignUpdatePayload {
  name?: string;
  notes?: string | null;
  max_grants?: number | null;
}

export interface AdminCampaignEndPayload {
  force_expire_grants: boolean;
}

export interface AdminCampaignsListResponse {
  success: boolean;
  message: string;
  data: AdminCampaign[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

export interface AdminCampaignDetailResponse {
  success: boolean;
  message: string;
  data: AdminCampaign;
}

/******************************************************************************
                                   Grants
******************************************************************************/

export interface AdminGrantSubscription {
  id: number;
  status: string;
  source: string;
  start_date: string | null;
  ends_at: string | null;
}

export interface AdminGrantUser {
  uuid: string;
  name: string;
  email: string;
}

export interface AdminGrant {
  id: number;
  campaign_id: number;
  subscription: AdminGrantSubscription;
  user: AdminGrantUser;
  granted_at: string;
  revoked_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminGrantsParams {
  per_page?: number;
  page?: number;
  active_only?: boolean;
}

export interface AdminGrantsListResponse {
  success: boolean;
  message: string;
  data: AdminGrant[];
  pagination: AdminConversationsPagination;
  links?: AdminConversationsLinks;
}

/******************************************************************************
                            Bulk Grant (rich response)
******************************************************************************/

export interface AdminBulkGrantPayload {
  emails: string[];
}

export interface AdminSkipAlreadyInCampaign {
  email: string;
}

export interface AdminSkipAlreadyInOtherCampaign {
  email: string;
  campaign_name: string;
}

export interface AdminSkipActivePaidSubscription {
  email: string;
  plan: string;
  ends_at: string | null;
}

export interface AdminSkipTrialing {
  email: string;
  trial_ends_at: string | null;
}

export interface AdminSkipCapReached {
  email: string;
  max_grants: number;
  current_active: number;
}

export interface AdminBulkGrantSkipped {
  already_granted_in_campaign: AdminSkipAlreadyInCampaign[];
  already_granted_other_campaign: AdminSkipAlreadyInOtherCampaign[];
  active_paid_subscription: AdminSkipActivePaidSubscription[];
  trialing: AdminSkipTrialing[];
  cap_reached: AdminSkipCapReached[];
}

export interface AdminBulkGrantFailure {
  email: string;
  error: string;
}

export interface AdminBulkGrantResult {
  granted: number;
  skipped: AdminBulkGrantSkipped;
  failed: AdminBulkGrantFailure[];
}

export interface AdminBulkGrantResponse {
  success: boolean;
  message: string;
  data: AdminBulkGrantResult;
}

/******************************************************************************
                                  Analytics
******************************************************************************/

export interface AdminCampaignUsageTopUser {
  user: AdminGrantUser;
  granted_at: string;
  ends_at: string | null;
  revoked_at: string | null;
  messages_sent: number;
}

export interface AdminCampaignUsageTotals {
  grants_issued: number;
  grants_active: number;
  grants_revoked: number;
  grants_naturally_expired: number;
  messages_sent: number;
}

export interface AdminCampaignUsageCampaignMeta {
  id: number;
  name: string;
  sponsor: { id: number; name: string };
  plan: { id: number; name: string };
  status: AdminCampaignStatus;
  starts_at: string | null;
  ends_at: string | null;
  duration_days: number;
}

export interface AdminCampaignUsage {
  campaign: AdminCampaignUsageCampaignMeta;
  totals: AdminCampaignUsageTotals;
  top_users: AdminCampaignUsageTopUser[];
}

export interface AdminCampaignUsageResponse {
  success: boolean;
  message: string;
  data: AdminCampaignUsage;
}

export interface AdminSponsorUsageCampaignRow {
  id: number;
  name: string;
  status: AdminCampaignStatus;
  grants_total: number;
  grants_active: number;
  messages_sent: number;
}

export interface AdminSponsorUsageTotals {
  grants_total: number;
  grants_active: number;
  messages_sent: number;
}

export interface AdminSponsorUsage {
  sponsor: { id: number; name: string; slug: string };
  campaigns: AdminSponsorUsageCampaignRow[];
  totals: AdminSponsorUsageTotals;
}

export interface AdminSponsorUsageResponse {
  success: boolean;
  message: string;
  data: AdminSponsorUsage;
}
