// Admin Global Message Feed Types
// Backed by GET /api/admin/messages — cursor-paginated, cross-user message
// feed with attribution and usage. Envelope matches /admin/paystack-webhooks.

import type { CursorPaginatedResponse } from './admin-activity';
import type { MessageUsage } from './admin';

export const MESSAGE_ROLES = ['user', 'assistant', 'tool'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

// Bypass tiers carry no attribution block.
export const MESSAGE_BYPASS_TIERS = [
  'super_admin',
  'admin',
  'researcher',
  'system',
] as const;

// Plan-funded tiers — attribution has subscription + plan.
export const MESSAGE_PLAN_TIERS = [
  'plan_paid',
  'plan_trial',
  'plan_free',
  'plan_granted',
] as const;

// Pack-funded tiers — attribution has message_pack.
export const MESSAGE_PACK_TIERS = ['pack', 'pack_granted'] as const;

// Granted tiers — additionally carry campaign + sponsor.
export const MESSAGE_GRANTED_TIERS = [
  'plan_granted',
  'pack_granted',
] as const;

export const MESSAGE_SENT_VIA_TIERS = [
  ...MESSAGE_BYPASS_TIERS,
  ...MESSAGE_PLAN_TIERS,
  ...MESSAGE_PACK_TIERS,
] as const;

export type MessageBypassTier = (typeof MESSAGE_BYPASS_TIERS)[number];
export type MessagePlanTier = (typeof MESSAGE_PLAN_TIERS)[number];
export type MessagePackTier = (typeof MESSAGE_PACK_TIERS)[number];
export type MessageGrantedTier = (typeof MESSAGE_GRANTED_TIERS)[number];
export type MessageSentVia = (typeof MESSAGE_SENT_VIA_TIERS)[number];

/******************************************************************************
                              Row sub-shapes
******************************************************************************/

export interface AdminMessageAttachment {
  file_id: string;
  file_name: string;
  file_size: number;
}

export interface AdminMessageAttributionSubscription {
  id: number;
  source: string;
  ends_at: string | null;
}

export interface AdminMessageAttributionPlan {
  id: number;
  name: string;
  slug: string;
}

export interface AdminMessageAttributionCampaign {
  id: number;
  name: string;
}

export interface AdminMessageAttributionSponsor {
  id: number;
  name: string;
  slug: string;
}

export interface AdminMessageAttributionMessagePack {
  id: number;
  name: string;
}

/**
 * Attribution shape — `kind` is the discriminator. Only granted tiers carry
 * `campaign` + `sponsor`; bypass tiers don't emit an attribution block at all.
 */
export interface AdminMessageAttribution {
  kind: MessagePlanTier | MessagePackTier;
  subscription?: AdminMessageAttributionSubscription;
  plan?: AdminMessageAttributionPlan;
  message_pack?: AdminMessageAttributionMessagePack;
  campaign?: AdminMessageAttributionCampaign;
  sponsor?: AdminMessageAttributionSponsor;
}

export interface AdminMessageConversationRef {
  uuid: string;
  title: string | null;
}

export interface AdminMessageUser {
  uuid: string;
  name: string;
  email: string | null;
  deleted_at: string | null;
}

export type AdminMessageMetadata = Record<string, unknown> | null;

/******************************************************************************
                                  Row + envelope
******************************************************************************/

export interface AdminMessageRow {
  id: number;
  agent_id: number | null;
  role: MessageRole;
  content: string;
  metadata: AdminMessageMetadata;
  attachment?: AdminMessageAttachment;
  usage?: MessageUsage;
  attribution?: AdminMessageAttribution;
  conversation: AdminMessageConversationRef;
  user: AdminMessageUser;
  created_at: string;
}

export interface AdminMessageListParams {
  role?: MessageRole[];
  sent_via?: MessageSentVia[];
  user_id?: number;
  user_uuid?: string;
  conversation_uuid?: string;
  sponsor_id?: number;
  campaign_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  with_trashed?: boolean;
  per_page?: number;
  cursor?: string;
}

export type AdminMessageListResponse = CursorPaginatedResponse<AdminMessageRow>;
