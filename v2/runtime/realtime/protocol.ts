import type { SlimUser } from '@/types/collab';

/**
 * protocol — the realtime WIRE contract the v2 spine listens on: Echo channel
 * names and the payload shapes of the user-channel events. Types only + name
 * builders; no runtime dependencies. Source of truth:
 * `docs/v2-docs/phases/phase-5-collab-notifications/api-digest.md` §B/§D
 * (compiled 2026-08-04). These shapes are broadcast payloads, not REST
 * responses, which is why they live here and not in `types/collab.ts` (a
 * shared v1 file W1 must not touch).
 *
 * EVERY custom event name carries the LEADING DOT (digest §F.1) — Echo
 * namespaces bare names, so `.channel.unread` is the literal wire binding.
 */

/** Echo name of the caller's private user channel (wire: `private-users.{uuid}`). */
export function userChannelName(userUuid: string): string {
  return `users.${userUuid}`;
}

/** Echo name of a channel's presence room (wire: `presence-channels.{uuid}`) —
 *  the W2 room subscription joins this; W1 only defines it so the two waves
 *  cannot drift on the string. */
export function presenceChannelName(channelUuid: string): string {
  return `channels.${channelUuid}`;
}

/** `.channel.unread` — the unread/mention count event on `users.{uuid}`. */
export const EVT_CHANNEL_UNREAD = '.channel.unread';

/**
 * Payload of {@link EVT_CHANNEL_UNREAD}. Counts are ABSOLUTE, recomputed
 * server-side — assign, never increment (digest §D). No message content ever
 * rides it. Fires on: message posted (others), own read-pointer advance
 * (multi-device echo, `is_mention: false`), mention-membership-changing edits,
 * and deletes.
 */
export interface ChannelUnreadEvent {
  channel_uuid: string;
  space_uuid: string;
  unread_count: number;
  mention_count: number;
  /** True ONLY for a member the triggering message @mentions (and Ruling B:
   *  an AI mention counts only when the channel's `ai_mentions_notify` is on —
   *  the server already applied that rule before setting this flag). */
  is_mention: boolean;
  message_uuid: string;
}

/**
 * Payload of the Echo `.notification()` handler on `users.{uuid}`.
 * DELIBERATELY LOOSE: the broadcast surface documents snake-case `type`
 * strings (`channel_mention`, `channel_invite`, …) while the REST inbox
 * returns class-style names (`ChannelMentionNotification`, …) — two surfaces
 * whose strings must never be assumed to match (digest §F.8). The spine only
 * invalidates on it, so nothing downstream may branch on `type`.
 */
export interface CollabBroadcastNotification {
  type?: string;
  channel_uuid?: string;
  channel_name?: string;
  message_uuid?: string;
  author?: SlimUser | null;
  preview?: string;
  action_url?: string;
}
