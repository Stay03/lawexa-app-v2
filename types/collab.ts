/**
 * Channels — Organizations / Spaces / Channels / Messages.
 *
 * Types mirror the live production contract captured in
 * `docs/channels/phases/phase-1-foundations/api-contract.md`. Shapes there are
 * authoritative — every field below reflects what the server actually returns.
 *
 * Conventions worth remembering:
 * - Users are ALWAYS the slim shape `{ uuid, name, avatar_url }` — never email
 *   or integer id.
 * - Every enum field is echoed with a sibling `*_label` (human string).
 * - Membership-aware and admin-only fields are optional here because the server
 *   omits them entirely for viewers who may not see them.
 */

import type { PaginationLinks, PaginationMeta } from '@/types/case';
import type { IBlockedReason } from '@/types/message-pack';

/******************************************************************************
                              Shared primitives
******************************************************************************/

/** The only user shape exposed anywhere in Channels responses. */
export interface SlimUser {
  uuid: string;
  name: string;
  avatar_url: string | null;
}

export type OrganizationType = 'law_firm' | 'university' | 'company' | 'bank' | 'other';
export type SpaceType = 'work' | 'study';
export type ChannelVisibility = 'space_public' | 'private';
export type MemberRole = 'owner' | 'admin' | 'member';
export type NotifyLevel = 'all' | 'mentions_only' | 'muted';

/******************************************************************************
                              Pagination wrappers
******************************************************************************/

/** Length-aware list response (organizations, spaces, channels, members, …). */
export interface LengthAwareResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

/** Single-resource response envelope. */
export interface ItemResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Cursor pagination metadata — channel messages only. */
export interface CursorMeta {
  per_page: number;
  has_more: boolean;
  next_cursor: string | null;
  prev_cursor: string | null;
}

export interface CursorLinks {
  prev: string | null;
  next: string | null;
}

/** Cursor-paginated list response (channel messages, newest-first). */
export interface CursorResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: CursorMeta;
  links: CursorLinks;
}

/******************************************************************************
                              Membership
******************************************************************************/

/**
 * A membership row, shared across organizations, spaces and channels.
 *
 * `notify_level` / `notify_level_label` are channel-only AND appear on the
 * caller's OWN row only. `invited_by` is present where the server loaded it.
 */
export interface Member {
  id: number;
  user: SlimUser;
  role: MemberRole;
  role_label: string;
  is_active: boolean;
  is_pending: boolean;
  notify_level?: NotifyLevel;
  notify_level_label?: string;
  invited_by?: SlimUser | null;
  accepted_at: string | null;
  joined_at: string | null;
  left_at: string | null;
  created_at: string;
}

/******************************************************************************
                              Organizations
******************************************************************************/

/** Trimmed organization reference nested on spaces. */
export interface OrganizationRef {
  uuid: string;
  name: string;
  type: OrganizationType;
}

export interface Organization {
  uuid: string;
  name: string;
  slug: string;
  type: OrganizationType;
  type_label: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  bio: string | null;
  description: string | null;
  website: string | null;
  logo_url: string | null;
  is_verified: boolean;
  verified_at: string | null;
  /** Admin-only: present (often null) for platform admins, omitted otherwise. */
  bn_number?: string | null;
  cac_document_url?: string | null;
  verification_requested_at?: string | null;
  creator: SlimUser;
  /** Roster + count only for active members / platform admins. */
  members?: Member[];
  active_members_count?: number;
  created_at: string;
  updated_at: string;
}

/******************************************************************************
                              Spaces
******************************************************************************/

/** Trimmed space nested inside space invitations. */
export interface SpaceRef {
  uuid: string;
  name: string;
  type: SpaceType;
  description: string | null;
}

export interface Space {
  uuid: string;
  name: string;
  description: string | null;
  type: SpaceType;
  type_label: string;
  is_private: boolean;
  settings: Record<string, unknown> | null;
  /** Null for a personal space; trimmed ref for an org-owned space. */
  organization: OrganizationRef | null;
  creator: SlimUser;
  active_members_count: number;
  /** List responses stamp the caller's role; `show` may omit it. */
  my_role?: MemberRole | null;
  /** Roster present on `show`. */
  members?: Member[];
  created_at: string;
  updated_at: string;
}

/******************************************************************************
                              Channels
******************************************************************************/

/** Trimmed space reference nested on channels. */
export interface ChannelSpaceRef {
  uuid: string;
  name: string;
  type: SpaceType;
}

export interface Channel {
  uuid: string;
  name: string;
  description: string | null;
  visibility: ChannelVisibility;
  visibility_label: string;
  space: ChannelSpaceRef;
  /** Membership-aware: stamped when the viewer's membership is known. */
  is_member?: boolean;
  my_role?: MemberRole | null;
  my_notify_level?: NotifyLevel;
  /** Members and space governors / platform admins only. */
  settings?: Record<string, unknown> | null;
  /** Members-only; present when the query stamped it. */
  unread_count?: number;
  active_members_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

/******************************************************************************
                              Messages
******************************************************************************/

export interface MessageMention {
  uuid: string;
  name: string;
}

/** A message's kind. Absent is treated as `'text'`. `ai_divider` is a Lawexa
 *  session-boundary separator, rendered inline rather than as a chat bubble. */
export type MessageType = 'text' | 'ai_divider';

export interface MessageMetadata {
  mentions: MessageMention[];
  lawexa_mentioned: boolean;
  /** Present on Lawexa-authored messages; absent (⇒ `'text'`) on human ones. */
  type?: MessageType;
}

export interface Message {
  uuid: string;
  channel_uuid: string;
  /**
   * Lawexa authorship is signalled by `is_ai`, NOT by `author`. The server
   * derives it from the reply's conversation back-link + the `ai_divider`
   * type, so a hard-deleted human (`is_ai: false`, `author: null`) is never
   * mislabelled as Lawexa.
   */
  is_ai: boolean;
  /** Null for Lawexa (`is_ai: true`) OR a hard-deleted human (`is_ai: false`). */
  author: SlimUser | null;
  content: string;
  metadata: MessageMetadata;
  parent_message_uuid: string | null;
  edited_at: string | null;
  created_at: string;
}

/******************************************************************************
                              Shared channel AI (Lawexa)
******************************************************************************/

/**
 * Outcome of the AI summon triggered by an `@lawexa` mention on message send.
 * - `dispatched`: the run was queued; stream it from `stream_url`.
 * - `blocked`: the summoner is over their AI quota — nothing runs, but the human
 *   message still posts. `reason` carries the LimitService payload.
 * - `error`: an internal failure; treated like `blocked` with no `reason`.
 */
export type AiDispatchStatus = 'dispatched' | 'blocked' | 'error';

/**
 * The `ai` object attached to a message-send response ONLY when the message
 * mentioned `@lawexa`. `execution_id` / `stream_url` accompany `dispatched`
 * (stream_url is always `"/api/chat/stream/" + execution_id`); `reason`
 * accompanies `blocked`.
 */
export interface AiDispatch {
  status: AiDispatchStatus;
  execution_id?: string;
  stream_url?: string;
  reason?: IBlockedReason;
}

/** AI session lifecycle. `active` is the live session accepting replies. */
export type AiSessionStatus = 'active' | 'expired' | 'closed';

/** A shared-channel AI session (a bounded Lawexa conversation within a channel). */
export interface AiSession {
  uuid: string;
  status: AiSessionStatus;
  status_label: string;
  /** Who summoned Lawexa first in this session; null if that user is gone. */
  started_by: SlimUser | null;
  /** The session this one succeeded (via an `ai_divider` reset), if any. */
  previous_session_uuid: string | null;
  message_count: number;
  started_at: string;
  last_activity_at: string;
  ended_at: string | null;
}

/******************************************************************************
                              List query params
******************************************************************************/

export interface SpaceListParams {
  search?: string;
  type?: SpaceType;
  organization_uuid?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface ChannelListParams {
  search?: string;
  visibility?: ChannelVisibility;
  sort?: 'name' | 'created_at' | 'last_message_at' | 'active_members_count';
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface MessageListParams {
  per_page?: number;
  cursor?: string;
}

export interface MemberListParams {
  search?: string;
  per_page?: number;
  page?: number;
}

/******************************************************************************
                              Write payloads
******************************************************************************/

export interface SendMessagePayload {
  content: string;
  parent_message_uuid?: string;
}

export interface UpdateMessagePayload {
  content: string;
}

/** Result of advancing the read pointer (`POST /channels/{uuid}/read`). */
export interface MarkReadResponse {
  success: boolean;
  message: string;
  data: {
    last_read_message_id: number;
    unread_count: number;
  };
}

/** Invite by email OR user_uuid (required-without each other); owner rejected. */
export interface InviteMemberPayload {
  email?: string;
  user_uuid?: string;
  role: 'admin' | 'member';
}

export interface UpdateMemberRolePayload {
  role: 'admin' | 'member';
}

export interface NotifyLevelPayload {
  notify_level: NotifyLevel;
}

export interface TransferOwnershipPayload {
  user_uuid: string;
}

export interface CreateSpacePayload {
  name: string;
  type: SpaceType;
  description?: string;
  organization_uuid?: string;
  is_private?: boolean;
  settings?: Record<string, unknown>;
}

export interface UpdateSpacePayload {
  name?: string;
  type?: SpaceType;
  description?: string;
  is_private?: boolean;
  settings?: Record<string, unknown>;
}

export interface CreateOrganizationPayload {
  name: string;
  type: OrganizationType;
  slug?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  bio?: string;
  description?: string;
  website?: string;
}

export type UpdateOrganizationPayload = Partial<CreateOrganizationPayload>;

/** Multipart body for `POST /organizations/{uuid}/request-verification`. */
export interface RequestVerificationPayload {
  bn_number: string;
  cac_document: File;
}

export interface CreateChannelPayload {
  name: string;
  visibility: ChannelVisibility;
  description?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateChannelPayload {
  name?: string;
  description?: string;
  visibility?: ChannelVisibility;
  settings?: Record<string, unknown>;
}

/******************************************************************************
                              Invitations (invitee inbox)
******************************************************************************/

export interface ChannelInvitationChannel {
  uuid: string;
  name: string;
  visibility: ChannelVisibility;
  description: string | null;
  space: { uuid: string; name: string };
}

export interface ChannelInvitation {
  id: number;
  channel: ChannelInvitationChannel;
  role: MemberRole;
  role_label: string;
  invited_by: SlimUser | null;
  created_at: string;
}

export interface SpaceInvitation {
  id: number;
  space: SpaceRef;
  role: MemberRole;
  role_label: string;
  invited_by: SlimUser | null;
  created_at: string;
}

export interface OrganizationInvitation {
  id: number;
  organization: Organization;
  role: MemberRole;
  role_label: string;
  invited_by: SlimUser | null;
  created_at: string;
}

/******************************************************************************
                              Named response aliases
******************************************************************************/

export type SpaceListResponse = LengthAwareResponse<Space>;
export type SpaceResponse = ItemResponse<Space>;
export type ChannelListResponse = LengthAwareResponse<Channel>;
export type ChannelResponse = ItemResponse<Channel>;
export type ChannelMemberListResponse = LengthAwareResponse<Member>;
export type SpaceMemberListResponse = LengthAwareResponse<Member>;
export type MemberResponse = ItemResponse<Member>;
export type MessageListResponse = CursorResponse<Message>;
export type MessageResponse = ItemResponse<Message>;
/** `data` of a message-send response — a Message plus an optional AI dispatch. */
export type SentMessage = Message & { ai?: AiDispatch };
export type SendMessageResponse = ItemResponse<SentMessage>;
export type AiSessionListResponse = LengthAwareResponse<AiSession>;
export type AiSessionTranscriptResponse = CursorResponse<Message>;
export type OrganizationResponse = ItemResponse<Organization>;
export type OrganizationMemberListResponse = LengthAwareResponse<Member>;
/** `GET /my-organization` returns null when the caller has no organization. */
export type MyOrganizationResponse = ItemResponse<Organization | null>;
export type ChannelInvitationListResponse = LengthAwareResponse<ChannelInvitation>;
export type SpaceInvitationListResponse = LengthAwareResponse<SpaceInvitation>;
export type OrganizationInvitationListResponse =
  LengthAwareResponse<OrganizationInvitation>;
