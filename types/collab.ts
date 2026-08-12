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
  /**
   * The unique `@handle` (backend, 2026-08-05). THE ONLY THING TAGGING MATCHES
   * — `@Ada Obi` and `@ada.obi` now tag nobody, only `@adaobi` does — so a
   * mention picker must insert THIS, never a slug of `name`.
   *
   * `null` means NOT TAGGABLE, and it is not rare: guests never get one, and
   * every account that predates the deploy has none until the backend's
   * one-time backfill runs. MEASURED 2026-08-05: still null on a real account
   * and on channel rosters, so the null branch is the live case today, not an
   * edge case.
   */
  username: string | null;
  avatar_url: string | null;
}

export type OrganizationType = 'law_firm' | 'university' | 'company' | 'bank' | 'other';
export type SpaceType = 'work' | 'study';
/** `space_public` = open, `private` = listed by name but shut, `hidden` = no door
 *  at all. THREE STATES SINCE 2026-08-10 (api commit 36a2c54): `private` used to
 *  mean invisible, and every private channel that predates that deploy was
 *  migrated to `hidden` so nobody's promise was broken. Anything that branches on
 *  this must decide about `hidden` explicitly — see `channelVisibilityFace`. */
export type ChannelVisibility = 'space_public' | 'private' | 'hidden';
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
  /**
   * The channel the server creates with the space, so a creator can be put
   * straight into a room that works instead of an empty list. Present on the
   * CREATE response only — never on list or show.
   *
   * MEASURED 2026-08-04 against production: it is a REDUCED channel, not the
   * full `Channel` the backend reply describes. The viewer-scoped fields
   * (`is_member`, `my_role`, `my_notify_level`, `unread_count`,
   * `mention_count`), `active_members_count` and `space` are all ABSENT, so it
   * is typed as what the wire actually sends. Use it for the uuid and the name;
   * read the channel itself for anything viewer-scoped.
   */
  default_channel?: DefaultChannelRef;
  created_at: string;
  updated_at: string;
}

/** The reduced channel stamped on a space CREATE response. See
 *  {@link Space.default_channel} for why this is not a `Channel`. */
export interface DefaultChannelRef {
  uuid: string;
  name: string;
  description: string | null;
  visibility: ChannelVisibility;
  visibility_label: string;
  last_message_at: string | null;
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

/**
 * The message a thread was branched from — a LIVE server-side read of a message
 * that lives in the PARENT channel, so it can never come out of the thread's own
 * history. Deliberately the `reply_to` shape and discipline (the backend says so
 * in its own words), minus the fields that shape does not need here.
 *
 * `content_preview` is `null` — never `""` — once the root is soft-deleted, and
 * the author is KEPT in that case: "branched from a deleted message from X" is
 * more use than a blank. ~200 chars, ellipsised, the same cut `reply_to` makes.
 */
export interface ThreadRootMessage {
  uuid: string;
  /** `{uuid, name, avatar_url}` on the wire — `null` for a hard-deleted human. */
  author: SlimUser | null;
  /** ~200-char plaintext preview; `null` once the root is deleted. */
  content_preview: string | null;
  is_deleted: boolean;
  type?: MessageType;
  /**
   * When the ROOT was written — not when the thread was branched off it, which
   * can be days later and is the thread's own `created_at` (backend 2026-08-12;
   * measured on prod the same day). Optional because a payload that predates
   * that deploy omits it.
   */
  created_at?: string;
}

export interface Channel {
  uuid: string;
  /**
   * A CHANNEL'S NAME IS ITS NAME; A THREAD'S IS A MACHINE SLUG. `channels`
   * carries `UNIQUE(space_id, name)`, so a thread is created as
   * `thread--{uuid}` and its human text lives in {@link Channel.title}. The
   * resource's own docblock puts it plainly: "the `name` is a generated slug —
   * do not show it to anyone". Read every displayed name through
   * `channelDisplayName` (`v2/features/channels/thread-model.ts`), which is the
   * one place that knows which of the two a given channel has.
   */
  name: string;
  /**
   * Whether this channel is a THREAD — a tangent branched out of another
   * channel's message. A thread IS a channel: every channel endpoint takes its
   * uuid, and `/channels/{threadUuid}` is its address.
   *
   * Every field below it down to `root_message_uuid` is its own; all of them
   * are `when($isThread)` on the wire and therefore absent on an ordinary
   * channel.
   */
  is_thread: boolean;
  /**
   * MAY THIS VIEWER READ THIS THREAD — and, below it, write in it (backend
   * 2026-08-12, measured on prod the same day). Thread-only: both are absent on
   * an ordinary channel, and absent on any thread payload serialized without a
   * viewer context. Absent therefore means "the server was not asked", which
   * `threadAccess` answers with the refusal rather than a guess.
   *
   * THEY REPLACE A DERIVATION, AND THEY ARE NOT THE SAME THING AS `is_member`.
   * On a thread `is_member` is FOLLOW state — it carries the read pointer and
   * the badges — and it is FALSE for every parent member who has not spoken
   * here yet, who may nevertheless read every word and post freely. These two
   * are stamped from `$user->can(...)` on the very abilities the endpoints
   * authorize, so they cannot promise what the next request refuses.
   *
   * TWO BOOLEANS AND NOT ONE, because the policy separates them: reading
   * delegates to `previewMessages` on the parent, which also admits a space
   * member who never joined an OPEN parent, while posting delegates to `post`,
   * which is active parent membership and nothing else. That viewer reads the
   * tangent and cannot answer in it.
   */
  can_read?: boolean;
  can_post?: boolean;
  /** The channel this thread was branched out of — the way back. */
  parent_channel_uuid?: string | null;
  /**
   * The parent's name, so the way back can be a LABEL rather than a uuid
   * (backend 2026-08-12; measured on prod, present on the thread show AND on
   * the threads listing, and NOT withheld by the metadata trim). Optional
   * because the field postdates the first threads deploy; a payload that omits
   * it leaves the way back unlabelled rather than fetching the parent to name
   * it.
   */
  parent_channel_name?: string | null;
  /** The thread's human title, derived by the server from its root message. */
  title?: string | null;
  /**
   * The message the thread came from. `null` for a thread started cold AND for
   * one whose root was HARD-deleted — the two are indistinguishable on the wire,
   * so any copy written for it must be true of both. Withheld entirely (absent,
   * not null) from a viewer who may see that the tangent exists but not read it.
   */
  root_message?: ThreadRootMessage | null;
  /**
   * The same uuid as `root_message.uuid`, flat (backend 2026-08-12), so "was
   * this thread ever anchored to a message" is answerable without reaching into
   * an object that may itself be null.
   *
   * WITHHELD UNDER THE SAME TRIM as the preview — absent, not null — because
   * the root lives in the parent, and handing its uuid to somebody who may not
   * read that parent would say "a message with this id exists in a room you
   * cannot enter". `null` is a real answer here (standalone, or a hard-deleted
   * root), so a trimmed payload must not be mistaken for one.
   */
  root_message_uuid?: string | null;
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
  /**
   * The handle the server actually resolved — the key a renderer must match
   * the typed `@token` on. `null` on every mention recorded BEFORE 2026-08-05
   * (no backfill of history), which is why the name-slug match has to survive
   * as the fallback for old messages instead of being deleted.
   */
  username?: string | null;
}

/** A message's kind. Absent is treated as `'text'`. `ai_divider` is a Lawexa
 *  session-boundary separator, rendered inline rather than as a chat bubble.
 *  `quiz_game_live` / `quiz_game_finished` (2026-08-03 surface) are
 *  Lawexa-authored system cards announcing a live channel quiz / its results;
 *  they already occur in prod feeds. Renderers MUST fall back to plain text on
 *  any unrecognised value — the backend states that fallback is contractual. */
export type MessageType =
  | 'text'
  | 'ai_divider'
  | 'quiz_game_live'
  | 'quiz_game_finished'
  | 'member_joined'
  | 'member_left'
  | 'member_removed'
  | 'thread_started';

/**
 * The three membership lines (backend 2026-08-11, live 01:16 UTC).
 *
 * FURNITURE, NOT CONVERSATION. The server posts a real message into the channel
 * when somebody joins, leaves or is removed. Drawn as a bubble they read as
 * though that person sat down and typed "Ada Obi joined the channel", which is
 * exactly what our contractual plain-text fallback did on the day they shipped.
 *
 * `member_left` and `member_removed` are DELIBERATELY DIFFERENT and must stay
 * so: rendering a removal as "left" misrepresents that person in front of the
 * whole channel.
 *
 * On these, `is_ai` is `false` AND `author` is `null` — either test identifies
 * one on its own. `metadata.user_uuid` says who the line is about.
 */
export const MEMBERSHIP_MESSAGE_TYPES = [
  'member_joined',
  'member_left',
  'member_removed',
] as const satisfies readonly MessageType[];

export type MembershipMessageType = (typeof MEMBERSHIP_MESSAGE_TYPES)[number];

/**
 * Every message the server writes ITSELF, rather than carrying for a person.
 *
 * THE SHARED PROPERTY IS THE DANGEROUS ONE: all of these have `author: null`,
 * and so does a hard-deleted human. The feed groups by author uuid, so any one
 * of these left in the ordinary-message path either merges into a deleted
 * person's run or draws its own bubble headed "Deleted account" — the server's
 * own sentence attributed to a ghost. That is why this list exists and why
 * anything added to it must also be given a branch in `feed-model`.
 *
 * `thread_started` (backend 2026-08-12) is the newest: "{name} started a
 * thread: {title}", carrying `thread_uuid` and a `root_message_uuid` that is
 * null for a thread begun with no message behind it. Verified in the server's
 * own `postSystemMessage`, which writes `user_id => null`.
 */
export const QUIET_SYSTEM_MESSAGE_TYPES = [
  ...MEMBERSHIP_MESSAGE_TYPES,
  'thread_started',
] as const satisfies readonly MessageType[];

export function isQuietSystemLine(message: Message): boolean {
  const type = message.metadata.type;
  return (
    type !== undefined &&
    (QUIET_SYSTEM_MESSAGE_TYPES as readonly string[]).includes(type)
  );
}

export interface MessageMetadata {
  mentions: MessageMention[];
  lawexa_mentioned: boolean;
  /**
   * Handles the writer typed that resolved to nobody (backend, 2026-08-05).
   * The message still posts — ordinary text is full of `@` (an email address,
   * `@Override` in a code paste) — so this is a hint to show the WRITER, never
   * a failure. `@lawexa` never appears here; it sets `lawexa_mentioned`.
   * Absent on messages recorded before the deploy.
   *
   * MEASURED 2026-08-05: posting "hi @filmv2 and @nobodyxyz" returned the
   * matched member in `mentions` and `["nobodyxyz"]` here.
   */
  unmatched_handles?: string[];
  /** Present on Lawexa-authored messages; absent (⇒ `'text'`) on human ones. */
  type?: MessageType;
  /** Quiz system cards only (`quiz_game_live` / `quiz_game_finished`): the
   *  live game and its parent quiz — the W6 Join / Results actions' handles. */
  game_uuid?: string;
  quiz_uuid?: string;
  /** Membership lines only: WHO the line is about. Not the author — these
   *  lines have no author at all. */
  user_uuid?: string;
  /** `thread_started` only: the branch that was opened. Its uuid IS a channel
   *  uuid — a thread is a channel — so every channel endpoint takes it. */
  thread_uuid?: string;
  /** `thread_started` only: the message the branch came off, or `null` when the
   *  thread was started cold. The server writes the key either way, so branch
   *  on the VALUE and never on whether the key is present. */
  root_message_uuid?: string | null;
  /** On every AI-authored message since 2026-08-03 (no backfill — `null` on
   *  older history and on human messages). Equals the summon's
   *  `execution_id` exactly; the responding pill clears on the FIRST match. */
  execution_id?: string | null;
  /** The AI session behind an AI bubble (same 2026-08-03 null rules) — feed it
   *  to `GET /channels/{uuid}/ai/sessions/{session}` for the full transcript. */
  session_uuid?: string | null;
}

/**
 * The quoted-message context riding a reply (`reply_to`, phase 3b). The
 * preview is a LIVE READ server-side: editing the target updates it, deleting
 * the target sets `is_deleted: true` and nulls the preview. Same AI/deleted
 * disambiguation rule as messages: key on `is_ai`, never on `author === null`.
 */
export interface MessageReplyTo {
  uuid: string;
  is_ai: boolean;
  author: SlimUser | null;
  /** ~200-char plaintext preview of the target; `null` once it is deleted. */
  content_preview: string | null;
  is_deleted: boolean;
  type?: MessageType;
  /**
   * How many files the quoted message carries (backend, 2026-08-05). ABSENT on
   * every reply recorded before that deploy — there was no backfill — so a
   * missing key must read as 0, never as "unknown".
   *
   * Measured 2026-08-05: a reply to a message carrying two files reported `2`
   * here with a `content_preview` of `""` — an EMPTY STRING, not `null`. The
   * two facts together are what lets a quote say what it is quoting instead of
   * rendering a blank line: `null` means deleted, `""` plus a count means the
   * target is files and nothing else.
   */
  attachment_count?: number;
}

/**
 * One emoji bucket on a message (phase 3f). Server order is count-desc then
 * first-reacted; `[]` when nobody has reacted.
 *
 * PER-VIEWER — `reacted_by_me` makes the whole array viewer-scoped, which is
 * why the array is deliberately OMITTED from `message.created`/`updated`
 * broadcasts and from post/edit responses (api-digest §A/§F.2). It rides REST
 * feed history only; live changes arrive as `.reaction.toggled` DELTAS
 * ({@link ReactionToggledPayload}).
 *
 * Emoji strings are grapheme-strict server-side (§F.9): lone VS16, lone
 * skin-tone modifiers and single regional indicators all 422, and skin-tone /
 * VS16 variants are DISTINCT buckets. The client owns the picker and must send
 * the exact string it means.
 */
export interface MessageReaction {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
}

/**
 * A file carried BY a message (backend, 2026-08-05).
 *
 * NOT A {@link ChannelFile}, and deliberately its own interface: the message
 * payload omits `uploader`, and reusing `ChannelFile` here would type a field
 * the server never sends — every consumer would then read `file.uploader.name`
 * off `undefined`. Everything else IS the same row: an attachment is created by
 * the ordinary `POST /channels/{uuid}/files` upload and appears in the channel's
 * library as well. One upload, one file, two places it shows — which is also
 * why deleting it from the library removes it from every message that carried
 * it (measured).
 *
 * ── `url` EXPIRES IN ONE HOUR ──────────────────────────────────────────────
 * It is pre-signed (measured: `X-Amz-Expires=3600`), so it must never be
 * persisted, stored beyond the response it arrived in, or put in a link a
 * reader may follow later — a tab left open past the hour holds nothing but
 * dead URLs. It is good for PAINTING a thumbnail on arrival and for nothing
 * else. `GET /files/{id}/download` mints a fresh one; that is the affordance
 * for opening a file, and the retry for an image that failed to load.
 */
export interface MessageAttachment {
  id: number;
  /** Pre-signed and short-lived — see the interface docblock. */
  url: string;
  original_name: string;
  mime_type: string;
  size: number;
  category: string;
  upload_status: string;
  created_at: string;
}

/**
 * The thread branched from ONE message, as the parent's feed sees it (backend
 * 2026-08-12) — the standing door under the bubble, and the only thing about a
 * thread that appears in the parent's transcript at all. A thread's messages
 * are not in that list and never were: they carry the THREAD's `channel_uuid`.
 *
 * ── `message_count` IS SHARED, `my_unread_count` IS NOT ────────────────────
 * The count of messages is the same number for everybody. The unread tally is
 * per-viewer, and it is the reason the whole stub is omitted from broadcasts —
 * exactly as `reactions` are, and for exactly the same reason: the per-viewer
 * half cannot be broadcast. The live `.thread.updated` event carries the shared
 * count only, so a writer fed by it must leave `my_unread_count` alone.
 */
export interface MessageThreadStub {
  /** The thread's own uuid. A thread IS a channel, so this addresses
   *  `/channels/{uuid}` and every channel endpoint. */
  uuid: string;
  /** The human title (never the `thread--{uuid}` slug), ≤120 chars. */
  title: string;
  /** How many messages are in the thread — shared, the same for everyone. */
  message_count: number;
  /**
   * How many of them this viewer has not read. THREE STATES, ALL DIFFERENT:
   * `null` = they do not follow the thread (following is granted by posting in
   * it, and it is what buys a read pointer at all); `0` = they follow it and
   * are caught up; `n` = they follow it and are behind. `null` and `0` are NOT
   * the same and must not draw the same.
   */
  my_unread_count: number | null;
  /** ISO time of the newest message in the thread; `null` when it has none. */
  last_message_at: string | null;
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
  /** Reply context (3b): `null`/absent when the message is not a reply. Rides
   *  REST history AND the `message.created`/`updated` broadcasts. */
  reply_to?: MessageReplyTo | null;
  edited_at: string | null;
  created_at: string;

  /* ── Engagement (phases 3d–3f, phase-5 W3) ───────────────────────────────
     THREE FIELDS, TWO TRANSPORT RULES (api-digest §A table + §F.2):

      - `is_pinned` is SHARED (one column, same for everyone), so it rides REST
        history AND every broadcast, and `.message.pinned` / `.message.unpinned`
        carry its changes. Safe to take from any payload.
      - `is_bookmarked` and `reactions` are PER-VIEWER and are deliberately
        omitted from broadcasts and from post/edit responses — after a real bug
        where broadcasts hardcoded `is_bookmarked: false`. A cache writer that
        replaces a row with a broadcast payload MUST preserve the previous
        row's values for these two, or a stranger's edit silently wipes the
        viewer's saves and reaction state.

     All three are OPTIONAL because the surface decides: reactions ride the feed
     only, `is_bookmarked` the feed + saved list, and any locally-constructed
     (optimistic) row has none of them. `undefined` reads as "unknown", which
     every consumer treats as the empty/false default. */

  /** Shared pin state — always present on server rows, incl. broadcasts (3e). */
  is_pinned?: boolean;
  /** Per-viewer save state; feed + saved list ONLY, never broadcast (3d). */
  is_bookmarked?: boolean;
  /** Per-viewer reaction buckets; feed ONLY, never broadcast (3f). */
  reactions?: MessageReaction[];

  /* ── How many answers this message drew (backend 2026-08-12) ──────────────
     `reply_count` and `last_reply_at` ride every message LIST so the feed can
     draw "3 replies" without asking a second question.

     THEY ARE OMITTED, NOT ZEROED, on broadcasts and on the send/edit responses
     — measured on prod, and the backend's doc leads on it. So `undefined` here
     means UNKNOWN, never none: reading a missing key as 0 would wipe a real
     "3 replies" line off every open screen the moment somebody fixed a typo in
     the message. `mergeViewerFields` carries them across exactly like the
     bookmark and reaction fields above, for the same reason and in the same
     place.

     Deleted replies count for neither. A reply can itself carry a count — the
     data is a tree — but the panel deliberately reads one level. */
  reply_count?: number;
  /** ISO time of the newest reply; absent when there are none. */
  last_reply_at?: string | null;

  /**
   * The thread branched from this message ({@link MessageThreadStub}), under
   * the SAME transport rules as `reply_count` above and for the same reason —
   * it is hydrated per page by the lists that look, and OMITTED (never nulled)
   * everywhere nothing looked.
   *
   * SO THE THREE VALUES MEAN THREE THINGS. `undefined` = this payload did not
   * say, so a cached stub must be carried across rather than blanked
   * (`mergeViewerFields`); `null` = this message has no thread, which is the
   * server actually saying so; an object = it has one. A writer that reads a
   * missing key as `null` would strip the thread line off every open screen the
   * moment somebody fixed a typo in the message.
   */
  thread?: MessageThreadStub | null;

  /**
   * Files this message carries (backend, 2026-08-05), in the order the sender
   * listed them — `attachment_ids` order is preserved server-side (measured) —
   * and `[]` when there are none.
   *
   * SHARED, not per-viewer, so it follows the `is_pinned` transport rule rather
   * than the `is_bookmarked` one: it rides REST history, the send response, the
   * edit response (measured — files survive an edit unchanged) and the
   * `message.created`/`message.updated` broadcasts (documented; the broadcast
   * side could not be measured while emission was down in production). Take it
   * from the payload wherever the payload defines it.
   *
   * OPTIONAL for exactly the reason the three fields above are: a
   * locally-constructed (optimistic) row is built from what the composer knows,
   * and `undefined` reads as "unknown", which every consumer treats as the
   * empty default. Server rows always carry it — so a cached row that HAS
   * attachments must not be blanked by a payload that merely omits the key
   * (`mergeViewerFields` in the v2 channels cache is where that rule lives).
   */
  attachments?: MessageAttachment[];
}

/**
 * A row of `GET /channels/{uuid}/messages/pins` (3e) — the message plus who
 * pinned it and when. `pinned_at DESC`; these two fields exist on the pins list
 * ONLY (never in the feed, never on a broadcast).
 */
export interface PinnedMessage extends Message {
  pinned_by: SlimUser | null;
  pinned_at: string;
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

/**
 * The role on a row of an AI session transcript
 * (`GET /channels/{uuid}/ai/sessions/{s}`) — the ONLY authorship signal that
 * resource carries. `assistant` is Lawexa, `user` is the human turn, and
 * everything else is the tool/system machinery behind them (api-digest §C:
 * distinguish by `role` + `metadata.type`, then filter for a dialogue view).
 *
 * Typed OPEN on purpose (`(string & {})` keeps the known values in autocomplete
 * while accepting anything): the machinery vocabulary is the agent's, it can
 * grow without a frontend release, and the contractual rule for unrecognised
 * values is "fall back", never "crash". Consumers must therefore classify with
 * an allow-list of DIALOGUE roles, never a deny-list of machinery ones.
 */
export type AiTranscriptRole =
  | 'user'
  | 'assistant'
  | 'tool'
  | 'system'
  | (string & {});

/**
 * A transcript row's metadata. Measured against production (2026-08-04) it
 * carries `execution_id` alone — NOT `mentions`, NOT `lawexa_mentioned`, so a
 * transcript body can never be handed to a renderer that expects
 * {@link MessageMetadata}'s resolved mention list. Nothing reads
 * `execution_id`, so it is not declared here; the row's rule is that only
 * consumed fields are.
 *
 * `type` is the documented machinery discriminator (api-digest §C) and stays an
 * open string: that vocabulary belongs to the agent, not to
 * {@link MessageType}. It is optional, and so is the object, because the
 * measurement covers the rows seen so far rather than a contract — every read
 * must survive their absence.
 */
export interface AiTranscriptMetadata {
  type?: string;
  /** The channel message that summoned this turn (backend, 2026-08-04).
   *  Absent on turns recorded before that deploy. */
  channel_message_uuid?: string | null;
}

/**
 * A row of an AI session transcript — NOT a {@link Message}. The endpoint reads
 * the AI conversation table, not the channel messages table, so the row has
 * none of a message's identity: no `uuid`, no `channel_uuid`, no `is_ai`, no
 * `author`, no `parent_message_uuid`, no `edited_at`. Measured row keys
 * (2026-08-04) are `id`, `conversation_id`, `conversation`, `agent_id`, `role`,
 * `content`, `metadata`, `created_at`; only the consumed ones are declared.
 *
 * A `user` row's `content` is the ASSEMBLED PROMPT — a `<channel_context>`
 * block followed by `[timestamp] Request from <name>: …` — not what the person
 * typed. Since 2026-08-04 the server also sends `user_content` and `asked_by`,
 * which are the truth and must be preferred; `content` remains the prompt.
 * Turns recorded BEFORE that deploy carry neither, which is why both are
 * optional and the text recovery stays as the fallback for old sessions.
 */
export interface AiTranscriptMessage {
  /** The row identity, and the render key: the resource ships no uuid. */
  id: number;
  role: AiTranscriptRole;
  content: string;
  /** What the person actually typed. Absent on pre-2026-08-04 turns. */
  user_content?: string | null;
  /** Who asked — the resource's only trustworthy attribution. The name inside
   *  `content` is member-writable and must never be shown as an identity. */
  asked_by?: SlimUser | null;
  metadata?: AiTranscriptMetadata | null;
  created_at: string;
}

/******************************************************************************
                              Realtime event payloads
******************************************************************************/

/**
 * `.reaction.toggled` on `presence-channels.{uuid}` (3f) — a DELTA, not a row.
 * `count` is the emoji bucket's new absolute count (assign it, never add), and
 * `reacted` is `user_uuid`'s new state: apply it to `reacted_by_me` only when
 * `user_uuid` is the viewer. Fires on real state changes only (§F.18).
 */
export interface ReactionToggledPayload {
  message_uuid: string;
  emoji: string;
  count: number;
  user_uuid: string;
  reacted: boolean;
}

/** `.message.pinned` / `.message.unpinned` (3e). Shared state — safe to apply
 *  verbatim. A rare concurrent double-pin may broadcast twice; the payload is
 *  idempotent, so a second apply is a no-op (§F.18). */
export interface MessagePinPayload {
  message_uuid: string;
  is_pinned: boolean;
  pinned_by_uuid: string | null;
  pinned_at: string | null;
}

/**
 * `.thread.updated` on the PARENT channel's presence room (backend
 * 2026-08-12) — a message was posted into one of its threads, or deleted from
 * one, so the stub under the root message counts up live.
 *
 * IT IS THE {@link MessageThreadStub} SHAPE MINUS THE PER-VIEWER HALF, plus the
 * two uuids that say which message in this feed it belongs under. There is no
 * `my_unread_count` and there cannot be: one broadcast reaches every member of
 * the room. A writer fed by this must leave the viewer's tally untouched.
 *
 * `root_message_uuid` is `null` for a STANDALONE thread — one started with no
 * message behind it, which has no stub in the parent's feed to update.
 */
export interface ThreadUpdatedPayload {
  parent_channel_uuid: string;
  thread_uuid: string;
  root_message_uuid: string | null;
  title: string;
  message_count: number;
  last_message_at: string | null;
}

/**
 * `.ai.turn_started` — a Lawexa summon was dispatched in this channel.
 *
 * `message_uuid` is the CONTRADICTION flagged in api-digest §F.7: FC §12
 * documents it (anchor the responding row under that message), AC §12c's table
 * omits it. It is therefore typed OPTIONAL and every consumer must be tolerant
 * — anchor when it is there, fall back to a channel-level row when it is not.
 */
export interface AiTurnStartedPayload {
  channel_uuid: string;
  execution_id: string;
  summoner: SlimUser;
  message_uuid?: string | null;
}

/** `.ai.turn_failed` — the turn ended with nothing postable. NOTHING posts on
 *  failure, so this event is the only signal the responding row will get. */
export interface AiTurnFailedPayload {
  channel_uuid: string;
  execution_id: string;
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

/**
 * `GET /channels/{uuid}/threads` — the tangents branched out of one channel.
 *
 * PAGE-BASED, WHICH IS THE TRAP. The message history one route away is CURSOR-
 * paginated, so neither one's paging code may be copied onto the other
 * (`InlineReplies` carries the same warning for the replies endpoint). Measured
 * on prod 2026-08-12: the response is length-aware (`current_page`/`last_page`),
 * `?cursor=` is ignored outright, and `per_page` is 1–100 with 101 answering
 * 422.
 *
 * The rows are ordered by newest activity, and a brand-new SILENT thread sorts
 * to the TOP — deliberately, because a standalone thread hangs under no message
 * and this list is the only way to reach it at all.
 */
export interface ThreadListParams {
  /**
   * Narrow to the threads this viewer FOLLOWS. Following is granted by posting
   * in a thread, never asked for (`POST /channels/{thread}/join` answers 422),
   * so this is "the ones I have spoken in", not "the ones I subscribed to".
   */
  mine?: boolean;
  per_page?: number;
  page?: number;
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
  /**
   * OPTIONAL SINCE 2026-08-05, and only because attachments exist. Measured
   * against production that day: a body carrying `attachment_ids` and no
   * `content` key posts (201) and the message comes back with `content: ""`;
   * `content: ""` posts too; a body with NEITHER content nor attachments is
   * still a 422.
   *
   * Callers OMIT rather than send `""`. Both forms are accepted on the wire,
   * but an empty string is a caption that says nothing, and leaving the key out
   * is the honest expression of "there is no caption".
   */
  content?: string;
  parent_message_uuid?: string;
  /** Reply target (3b): must be a live message in the SAME channel (else 422).
   *  The current wire name — `parent_message_uuid` above predates it. */
  reply_to_uuid?: string;
  /**
   * Library file ids to attach, IN ORDER — the server preserves it (measured:
   * `[txt, png]` came back in that order). Max 10.
   *
   * Two 422s are reachable here and both are the client's to make impossible
   * rather than to translate: a repeated id (`errors.attachment_ids.0` — "The
   * same file cannot be attached twice.") and an id that is not a file of this
   * channel (`errors.attachment_ids` — "One or more of those files are not
   * available in this channel.").
   */
  attachment_ids?: number[];
}

export interface UpdateMessagePayload {
  content: string;
}

/** Body for `POST .../messages/{uuid}/reactions` — a TOGGLE keyed by the exact
 *  emoji string (grapheme-strict server-side; see {@link MessageReaction}). */
export interface ToggleReactionPayload {
  emoji: string;
}

/** Result of advancing the read pointer (`POST /channels/{uuid}/read`).
 *  `last_read_message_uuid` — the server ships the uuid (member-surface
 *  uuid-only pass, Jul 25 2026); the old `last_read_message_id: number` field
 *  in this type was stale and never read by any consumer (verified 2026-08-04,
 *  phase-5 W1 audit note N6). */
export interface MarkReadResponse {
  success: boolean;
  message: string;
  data: {
    last_read_message_uuid: string;
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

/**
 * `POST /channels/{uuid}/threads` — one endpoint, two shapes (backend ruling
 * 2026-08-12).
 *
 * WITH `root_message_uuid` the thread is BRANCHED from that message, and the
 * server derives the title from the message's own first line — so a branch
 * sends no title at all. The call is IDEMPOTENT on the root: a message that
 * already has a live thread comes back with 200 instead of 201, so two people
 * tapping the same message land in the same room.
 *
 * WITHOUT it the thread STANDS ALONE, `title` is required (there is nothing to
 * borrow words from) and every call makes a new one — there is no identity to
 * collapse onto.
 */
export interface CreateThreadPayload {
  root_message_uuid?: string;
  /** ≤120 chars. Required only for a standalone thread. */
  title?: string;
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

/**
 * One message's replies.
 *
 * PAGE-BASED, NOT CURSOR-BASED, unlike the channel feed — measured against prod
 * (`{current_page, per_page, total, last_page, from, to}`, 30 a page). Worth
 * stating because everything else about messages in this app is a cursor, and
 * the two paginations are not interchangeable.
 *
 * OLDEST FIRST, also unlike the feed, which is newest-first and reversed on the
 * client. A conversation is read downwards, so this arrives in reading order and
 * needs no flipping.
 *
 * Rows are FULLY HYDRATED — bookmarks, reactions, attachments, their own reply
 * counts — so the panel can render them with the same row component as the feed
 * rather than a thinner copy of it.
 */
export type MessageRepliesResponse = LengthAwareResponse<Message>;
export type MessageResponse = ItemResponse<Message>;
/** `data` of a message-send response — a Message plus an optional AI dispatch. */
export type SentMessage = Message & { ai?: AiDispatch };
export type SendMessageResponse = ItemResponse<SentMessage>;
export type AiSessionListResponse = LengthAwareResponse<AiSession>;
/** Rows here are AI-conversation rows, NOT messages: no uuid, no author, no
 *  mention list — see {@link AiTranscriptMessage}. */
export type AiSessionTranscriptResponse = CursorResponse<AiTranscriptMessage>;

/* ── Engagement (phase-5 W3) ─────────────────────────────────────────────── */

/** `GET /channels/{uuid}/messages/pins` — `pinned_at DESC`, offset-paginated. */
export type PinnedMessageListResponse = LengthAwareResponse<PinnedMessage>;
/** `GET /channels/{uuid}/messages/bookmarks` — the VIEWER's saves here. */
export type SavedMessageListResponse = LengthAwareResponse<Message>;
/** `POST .../messages/{uuid}/reactions` — 200 both ways, the new bucket state. */
export type ReactionToggleResponse = ItemResponse<MessageReaction>;
/** `POST .../messages/{uuid}/bookmark` — 201 added / 200 removed. */
export type BookmarkToggleResponse = ItemResponse<{ bookmarked: boolean }>;
/** `POST` / `DELETE .../messages/{uuid}/pin` — idempotent, any active member. */
export type PinToggleResponse = ItemResponse<{ is_pinned: boolean }>;
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

/******************************************************************************
              Invite links, waiting lists and public spaces
        (API commit 36a2c54, 2026-08-10 — docs/api/spaces-channels-invite-links.md)
******************************************************************************/

/**
 * What THIS viewer must do next about an invite link, decided by the server.
 *
 * ── BUILD EVERY BUTTON ON THIS, NEVER ON "DO I HAVE A TOKEN" ───────────────
 * A guest carries a real token and passes authentication, so the usual test
 * says "signed in" and would offer them Join — which the server then refuses.
 * That is the refusal-after-the-press the contract exists to prevent. The
 * server folds guest-ness, email confirmation and membership into one word;
 * read the word.
 */
export type InviteViewerAction =
  | 'sign_up'
  | 'verify_email'
  | 'join'
  | 'request'
  | 'already_member';

/** `GET /invite-links/{code}` — THE ONE UNAUTHENTICATED ROUTE. It has to
 *  answer before somebody has an account, which is the whole point of it. */
export interface InvitePreview {
  code: string;
  space_uuid: string;
  space_name: string;
  /** The space's own description. ADDED 2026-08-10 by @backendclaude and
   *  verified live. Often empty — plenty of spaces never write one, and those
   *  are exactly the people about to send a stranger an invite. */
  space_description?: string | null;
  space_type: SpaceType;
  member_count: number;
  inviter_name: string | null;
  /** The channel the link named, when it named one. */
  channel_name: string | null;
  /** Empty when the link points at a whole space rather than a channel. */
  channel_description?: string | null;
  requires_approval: boolean;
  viewer_action: InviteViewerAction;
}

/** What `POST /invite-links/{code}/accept` did.
 *  `already_member` and `already_waiting` are SUCCESSES — pressing twice must
 *  never draw an error. */
export type InviteAcceptStatus =
  | 'joined'
  | 'request'
  | 'already_member'
  | 'already_waiting';

export interface InviteAcceptResult {
  status: InviteAcceptStatus;
  space_uuid: string;
  channel_uuid?: string | null;
}

/**
 * MEASURED against production 2026-08-10, not taken from the doc. The written
 * contract says "list, with use counts" without naming the field, and the
 * server sends `uses` — so a type built on the obvious guess (`uses_count`)
 * would have read `undefined` and quietly shown every link as unused. There is
 * also no `url`: the link is built from the code, by us.
 */
export interface InviteLink {
  id: number;
  code: string;
  role: Exclude<MemberRole, 'owner'>;
  role_label: string;
  requires_approval: boolean;
  channel: { uuid: string; name: string } | null;
  max_uses: number | null;
  /** Previewing never counts. Only a real join or request moves this. */
  uses: number;
  /** The server's own verdict — live, not expired, not revoked, uses left. */
  is_usable: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  creator: SlimUser;
}

export interface CreateInviteLinkPayload {
  channel_uuid?: string;
  role?: Exclude<MemberRole, 'owner'>;
  /** Defaults to TRUE server-side — an unattended link lets strangers in. */
  requires_approval?: boolean;
  max_uses?: number;
  expires_at?: string;
}

/**
 * One person waiting to be let in. The same shape for spaces and channels.
 *
 * `id` IS THE HANDLE approve and reject bind on, and it must be READ from this
 * row, never constructed. The API shipped once without it and thirty green
 * tests missed it, because tests keep the id they created and never read it
 * back the way an app has to.
 */
export interface JoinRequest {
  id: number;
  user: SlimUser;
  /** How they arrived, when it was a link. */
  invite_code: string | null;
  created_at: string;
  /**
   * PRESENT = approving this ALSO grants that channel. It has to be said on
   * the approve control: an admin reading "join request" would otherwise hand
   * out channel access they never agreed to. `null` grants the space only.
   */
  also_joins_channel: {
    uuid: string;
    name: string;
    visibility: ChannelVisibility;
  } | null;
}

/**
 * A public space in the browse list.
 *
 * MEASURED against production 2026-08-10 — the doc describes the endpoint but
 * not its row, and guessing cost two mistakes worth keeping a note about:
 *  - it is `active_members_count`, not `member_count`. The obvious name renders
 *    an empty gap where the number should be, with no error anywhere.
 *  - THERE IS NO `is_member`. So this list cannot tell whether the viewer is
 *    already inside, and a member browsing is offered Join on their own
 *    space. Handled below rather than hidden; asked of @backendclaude.
 */
export interface DiscoverableSpace {
  uuid: string;
  name: string;
  description: string | null;
  type: SpaceType;
  type_label: string;
  is_private: boolean;
  organization: OrganizationRef | null;
  active_members_count: number;
  /** NOT SENT TODAY. Optional so the row degrades honestly if it ever arrives. */
  is_member?: boolean;
  created_at: string;
}

export interface DiscoverSpacesParams {
  search?: string;
  per_page?: number;
  page?: number;
}

export type InvitePreviewResponse = ItemResponse<InvitePreview>;
export type InviteAcceptResponse = ItemResponse<InviteAcceptResult>;
export type InviteLinkResponse = ItemResponse<InviteLink>;
export type InviteLinkListResponse = ItemResponse<InviteLink[]>;
export type JoinRequestListResponse = ItemResponse<JoinRequest[]>;
export type DiscoverSpacesResponse = LengthAwareResponse<DiscoverableSpace>;
