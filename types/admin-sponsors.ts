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

export type AdminCampaignType = 'plan' | 'pack';

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

interface AdminCampaignBase {
  id: number;
  sponsor: AdminCampaignSponsorRef;
  name: string;
  slug: string;
  max_grants: number | null;
  starts_at: string | null;
  ends_at: string | null;
  status: AdminCampaignStatus;
  status_label: string;
  type_label: string;
  notes: string | null;
  grants_count?: number;
  active_grants_count?: number;
  created_at: string;
}

export interface AdminPlanCampaign extends AdminCampaignBase {
  type: 'plan';
  plan: AdminCampaignPlanRef;
  duration_days: number;
  pack_size: null;
}

export interface AdminPackCampaign extends AdminCampaignBase {
  type: 'pack';
  plan: null;
  duration_days: null;
  pack_size: number;
}

export type AdminCampaign = AdminPlanCampaign | AdminPackCampaign;

export interface AdminCampaignsParams {
  per_page?: number;
  page?: number;
}

// Plan campaign — reuse an existing public plan
export interface AdminCampaignCreatePlanPayload {
  name: string;
  type: 'plan';
  plan_id: number;
  duration_days: number;
  max_grants?: number | null;
  notes?: string | null;
}

// Pack campaign — grant a fixed bundle of AI messages per student
export interface AdminCampaignCreatePackPayload {
  name: string;
  type: 'pack';
  pack_size: number;
  max_grants?: number | null;
  notes?: string | null;
}

export type AdminCampaignCreatePayload =
  | AdminCampaignCreatePlanPayload
  | AdminCampaignCreatePackPayload;

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
  provider: string;
  start_date: string | null;
  ends_at: string | null;
}

export interface AdminGrantPack {
  id: number;
  messages_total: number;
  messages_remaining: number;
  status: string;
}

export interface AdminGrantUser {
  uuid: string;
  name: string;
  email: string;
  deleted_at: string | null;
}

interface AdminGrantBase {
  id: number;
  campaign_id: number;
  user: AdminGrantUser;
  granted_at: string;
  revoked_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminPlanGrant extends AdminGrantBase {
  subscription: AdminGrantSubscription;
}

export interface AdminPackGrant extends AdminGrantBase {
  pack: AdminGrantPack;
}

export type AdminGrant = AdminPlanGrant | AdminPackGrant;

export function isPackGrant(grant: AdminGrant): grant is AdminPackGrant {
  return 'pack' in grant;
}

export function isPlanGrant(grant: AdminGrant): grant is AdminPlanGrant {
  return 'subscription' in grant;
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
  emails?: string[];
  user_ids?: number[];
}

export interface AdminSkipAlreadyInCampaign {
  email: string;
  user_uuid: string;
}

export interface AdminSkipAlreadyInOtherCampaign {
  email: string;
  user_uuid: string;
  campaign_name: string;
}

export interface AdminSkipActivePaidSubscription {
  email: string;
  user_uuid: string;
  plan: string;
  ends_at: string | null;
}

export interface AdminSkipTrialing {
  email: string;
  user_uuid: string;
  trial_ends_at: string | null;
}

export interface AdminSkipCapReached {
  email: string;
  user_uuid: string;
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
  user_uuid: string | null;
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

export interface AdminCampaignUsageTokens {
  prompt: number;
  completion: number;
  total: number;
}

interface AdminCampaignUsageLlmTotals {
  messages_sent: number;
  ai_requests: number;
  tokens: AdminCampaignUsageTokens;
  estimated_cost: string;
}

export interface AdminCampaignUsageTopUserGrant {
  granted_at: string;
  ends_at: string | null;
  revoked_at: string | null;
}

export interface AdminCampaignUsageTopUserPack {
  id: number;
  messages_total: number;
  messages_remaining: number;
  granted_at: string;
  revoked_at: string | null;
}

interface AdminCampaignUsageTopUserBase extends AdminCampaignUsageLlmTotals {
  user: AdminGrantUser;
}

export interface AdminPlanCampaignUsageTopUser
  extends AdminCampaignUsageTopUserBase {
  grants: AdminCampaignUsageTopUserGrant[];
}

export interface AdminPackCampaignUsageTopUser
  extends AdminCampaignUsageTopUserBase {
  packs: AdminCampaignUsageTopUserPack[];
}

export type AdminCampaignUsageTopUser =
  | AdminPlanCampaignUsageTopUser
  | AdminPackCampaignUsageTopUser;

export interface AdminPlanCampaignUsageTotals
  extends AdminCampaignUsageLlmTotals {
  grants_issued: number;
  grants_active: number;
  grants_revoked: number;
  grants_naturally_expired: number;
}

export interface AdminPackCampaignUsageTotals
  extends AdminCampaignUsageLlmTotals {
  packs_issued: number;
  packs_active: number;
  packs_revoked: number;
  messages_funded: number;
  messages_used: number;
  messages_remaining: number;
}

export type AdminCampaignUsageTotals =
  | AdminPlanCampaignUsageTotals
  | AdminPackCampaignUsageTotals;

interface AdminCampaignUsageCampaignMetaBase {
  id: number;
  name: string;
  sponsor: { id: number; name: string };
  status: AdminCampaignStatus;
  starts_at: string | null;
  ends_at: string | null;
}

export interface AdminPlanCampaignUsageCampaignMeta
  extends AdminCampaignUsageCampaignMetaBase {
  type: 'plan';
  plan: { id: number; name: string };
  duration_days: number;
}

export interface AdminPackCampaignUsageCampaignMeta
  extends AdminCampaignUsageCampaignMetaBase {
  type: 'pack';
  pack_size: number;
}

export type AdminCampaignUsageCampaignMeta =
  | AdminPlanCampaignUsageCampaignMeta
  | AdminPackCampaignUsageCampaignMeta;

export interface AdminPlanCampaignUsage {
  campaign: AdminPlanCampaignUsageCampaignMeta;
  totals: AdminPlanCampaignUsageTotals;
  top_users: AdminPlanCampaignUsageTopUser[];
}

export interface AdminPackCampaignUsage {
  campaign: AdminPackCampaignUsageCampaignMeta;
  totals: AdminPackCampaignUsageTotals;
  top_users: AdminPackCampaignUsageTopUser[];
}

export type AdminCampaignUsage =
  | AdminPlanCampaignUsage
  | AdminPackCampaignUsage;

export function isPackCampaignUsage(
  usage: AdminCampaignUsage
): usage is AdminPackCampaignUsage {
  return usage.campaign.type === 'pack';
}

export interface AdminCampaignUsageResponse {
  success: boolean;
  message: string;
  data: AdminCampaignUsage;
}

interface AdminSponsorUsageCampaignRowBase extends AdminCampaignUsageLlmTotals {
  id: number;
  name: string;
  status: AdminCampaignStatus;
}

export interface AdminSponsorUsageCampaignPlanRow
  extends AdminSponsorUsageCampaignRowBase {
  type: 'plan';
  grants_total: number;
  grants_active: number;
}

export interface AdminSponsorUsageCampaignPackRow
  extends AdminSponsorUsageCampaignRowBase {
  type: 'pack';
  packs_total: number;
  packs_active: number;
  packs_revoked: number;
  messages_funded: number;
  messages_used: number;
  messages_remaining: number;
}

export type AdminSponsorUsageCampaignRow =
  | AdminSponsorUsageCampaignPlanRow
  | AdminSponsorUsageCampaignPackRow;

export interface AdminSponsorUsageTotals extends AdminCampaignUsageLlmTotals {
  grants_total: number;
  grants_active: number;
  packs_total: number;
  packs_active: number;
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
