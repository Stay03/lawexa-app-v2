import type { SlimUser, SpaceTask } from '@/types/collab';

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

/** `.userbox.control` — control of Lawexa's machine moved (Userbox v1), on `users.{uuid}`. */
export const EVT_USERBOX_CONTROL = '.userbox.control';
/** A recorded meeting moved a stage after Stop (recorder, thread ac47b1df). */
export const EVT_RECORDING_UPDATED = '.recording.updated';

/**
 * Own templates and skills (thread 9ae498ae; Backend's contract, 19 November
 * 2026), on `users.{uuid}`: Lawexa asks the owner before using one in a Space
 * chat, the owner answered on another tab, and one of their templates finished
 * reading. Each payload is the row itself; the spine only reads again.
 */
export const EVT_PRIVATE_ITEM_REQUESTED = '.private_item.requested';
export const EVT_PRIVATE_ITEM_ANSWERED = '.private_item.answered';
export const EVT_MY_TEMPLATE_UPDATED = '.my_template.updated';

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
  /** The chat a notification is about (`background_job_answered`, Backend
   *  063d9cc3): read again on arrival, so an open chat shows Lawexa's return. */
  conversation_uuid?: string;
}

/** Echo name of a space's private channel (wire: `private-spaces.{uuid}`).
 *  The task board listens here for {@link EVT_TASK_CHANGED} (Backend's
 *  task-board branch 439e6020, 29 October 2026). */
export function spaceChannelName(spaceUuid: string): string {
  return `spaces.${spaceUuid}`;
}

/** Echo name of an open live quiz game's private channel (wire: `private-quiz-games.{uuid}`): a game with no Space
 *  or channel (Backend live-quiz-open e9c7ac18), joinable by anyone who may view the game. */
export function openQuizGameChannelName(gameUuid: string): string {
  return `quiz-games.${gameUuid}`;
}

/** `.task.changed` — a task was created, changed or deleted, on `spaces.{uuid}`. */
export const EVT_TASK_CHANGED = '.task.changed';

/**
 * Payload of {@link EVT_TASK_CHANGED}: the whole task as it is now, a FULL
 * snapshot (the same row `GET /spaces/{uuid}/tasks` returns), so the board
 * writes it in place and never refetches. Every member of the space gets it.
 */
export interface SpaceTaskSnapshotEvent {
  action: 'created' | 'updated' | 'deleted';
  task: SpaceTask;
}

/**
 * A change to a task some members may not see (one linked to a private
 * thread; Stay's B, Backend fb826d73): no task at all, since the broadcast
 * reaches every member. Each board reads its own list again, which the
 * server filters per person.
 */
export interface SpaceTaskRefreshEvent {
  action: 'refresh';
}

export type SpaceTaskChangedEvent = SpaceTaskSnapshotEvent | SpaceTaskRefreshEvent;
