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
  /**
   * §17 activity rollups (backend frontend-contract) — members-only, stamped
   * when the caller's membership is known. `unread_channels_count` = how many
   * of the space's live channels have ≥1 unread message for the caller (muted
   * channels EXCLUDED — mute kills the activity rollup); drives the space's
   * unread dot. `mention_count` = the caller's total unread @mentions summed
   * across the space's channels (muted INCLUDED — a mute never suppresses a
   * direct @you); drives the numeric mention badge.
   */
  unread_channels_count?: number;
  mention_count?: number;
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
  /** §17 (backend frontend-contract): the subset of unread messages that
   *  @mention the caller — members-only, gated like `unread_count`. Muted
   *  members still receive it (mute kills the unread rollup, never a direct
   *  mention badge). */
  mention_count?: number;
  active_members_count: number;
  last_message_at: string | null;
  /**
   * A compact preview of the channel's most recent surviving message — a display
   * name (`"Lawexa"` for AI-authored messages) and a plaintext snippet (markdown
   * and mentions flattened, ≤120 chars). `null` when no message survives (e.g.
   * the last was deleted). Stamped ONLY by `GET /api/channels` (the cross-space
   * my-channels route); the per-space channel list never sets it.
   */
  last_message?: { author_name: string; snippet: string } | null;
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
                        Channel task lists & files

  Two channel sub-features that ride the room's existing `channels.{uuid}`
  presence socket. Shapes follow `docs/channel-lists-and-files/frontend-contract.md`.

  TWO LIST SHAPES — the trickiest part of this feature:
  - The INDEX (`GET /channels/{uuid}/lists`) returns `TaskListSummary`:
    `items_count` / `checked_count`, NO `items` array.
  - The DETAIL (`GET /lists/{uuid}`), create, update and the `.list.changed`
    broadcast return `TaskList`: the full `items` array, NO counts.
  Fetch the detail shape whenever you need the items.

  IDENTIFIERS — lists and items are addressed by `uuid`; files by integer `id`.
******************************************************************************/

/**
 * File uploader — an integer-id shape, NOT `SlimUser`. Channel files are keyed
 * by integer `id` and expose only the uploader's `id` + `name` (no uuid /
 * avatar_url).
 */
export interface FileUploader {
  id: number;
  name: string;
}

/**
 * A file in a channel's document library. Keyed by integer `id`. `url` is a
 * time-limited signed URL for private files (regenerated per response); reuse
 * `filesApi.getDownloadUrl(id)` for the gated download endpoint.
 */
export interface ChannelFile {
  id: number;
  url: string;
  original_name: string;
  mime_type: string;
  size: number;
  category: string;
  upload_status: string;
  uploader: FileUploader;
  created_at: string;
}

/**
 * A single task-list item. Items are collaborative — any active channel member
 * may add / edit / check / reorder / remove them regardless of who created one.
 *
 * `creator` / `checked_by` are `null` for Lawexa (when `is_ai`) OR a deleted
 * human account — render the Lawexa identity on `is_ai`, NEVER on
 * `creator === null`. `checked_at` / `checked_by` are `null` while unchecked.
 */
export interface TaskListItem {
  uuid: string;
  content: string;
  position: number;
  is_checked: boolean;
  checked_at: string | null;
  is_ai: boolean;
  creator: SlimUser | null;
  checked_by: SlimUser | null;
  created_at: string;
}

/**
 * The INDEX shape for a channel's task lists — carries counts, NOT the items
 * array. `is_ai: true` ⇒ created by Lawexa (`creator` is then `null`); render
 * the Lawexa identity on `is_ai`, never on `creator === null`.
 */
export interface TaskListSummary {
  uuid: string;
  channel_uuid: string;
  title: string;
  description: string | null;
  is_ai: boolean;
  creator: SlimUser | null;
  items_count: number;
  checked_count: number;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * The DETAIL / create / update / broadcast shape — carries the `items` array,
 * NOT the counts. Otherwise identical to `TaskListSummary`. Same Lawexa
 * identity rule (`is_ai`, not `creator === null`).
 */
export interface TaskList {
  uuid: string;
  channel_uuid: string;
  title: string;
  description: string | null;
  is_ai: boolean;
  creator: SlimUser | null;
  items: TaskListItem[];
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** A single pre-filled item when creating a list (`content` ≤ 1000 chars). */
export interface CreateListItemInput {
  content: string;
}

/** Body for `POST /channels/{uuid}/lists`. `items` ≤ 100 entries. */
export interface CreateListPayload {
  title: string;
  description?: string;
  items?: CreateListItemInput[];
}

/** Body for `PUT /lists/{uuid}` — rename / edit description. */
export interface UpdateListPayload {
  title?: string;
  description?: string;
}

/** Body for `POST /lists/{uuid}/items` — appends to the end. */
export interface AddListItemPayload {
  content: string;
}

/** Body for `PATCH /lists/{uuid}/items/{itemUuid}` — at least one field. */
export interface UpdateListItemPayload {
  content?: string;
  is_checked?: boolean;
}

/**
 * Body for `POST /lists/{uuid}/items/reorder` — the FULL ordered uuid set
 * (every current item exactly once); positions are rewritten `0..n-1`.
 */
export interface ReorderListItemsPayload {
  item_uuids: string[];
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

/** The channel's lists, index shape (counts, no items). */
export type TaskListSummaryListResponse = LengthAwareResponse<TaskListSummary>;
/** A single list with its items — show / create / update. */
export type TaskListResponse = ItemResponse<TaskList>;
/** A single item — add / edit. */
export type TaskListItemResponse = ItemResponse<TaskListItem>;
/** The reordered items array returned by `.../items/reorder`. */
export type TaskListItemsResponse = ItemResponse<TaskListItem[]>;
/** The channel's file library, paginated. */
export type ChannelFileListResponse = LengthAwareResponse<ChannelFile>;
/** A single channel file — upload result. */
export type ChannelFileResponse = ItemResponse<ChannelFile>;
