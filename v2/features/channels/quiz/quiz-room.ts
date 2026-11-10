import type { GoLiveChannelQuizPayload, QuizRoom } from '@/types/channel-quiz';

export type { QuizRoom } from '@/types/channel-quiz';

/**
 * quiz-room — where a live quiz game runs: a channel, or a Space itself (live
 * quiz in Spaces, Arthur's decisions 93142269; Backend's shapes 7a007a8c).
 *
 * The game is the same thing in both: the same resource, the same eight
 * socket events, the same screens. Only four things depend on the room, and
 * each is decided here once rather than copied per room:
 *   - which socket carries its events (the channel's presence channel, or
 *     the Space's private `spaces.{uuid}`), so the event bus is keyed by room;
 *   - which list answers "is a quiz live here?" (`/channels/{c}/quiz-games`
 *     or `/spaces/{s}/quiz-games`, in `quizGamesApi.getList`);
 *   - what go-live sends (`channel_uuid`, or `space_uuid` with the Space chat
 *     it was started from);
 *   - whether a game belongs to this room (`channel_uuid` or `space_uuid`).
 */
export function channelRoom(uuid: string): QuizRoom {
  return { kind: 'channel', uuid };
}

export function spaceRoom(uuid: string): QuizRoom {
  return { kind: 'space', uuid };
}

/** The room's name in a sentence: "channel" or "Space" (a Space is a proper noun in the app). */
export function roomNoun(room: QuizRoom): 'channel' | 'Space' {
  return room.kind === 'channel' ? 'channel' : 'Space';
}

/** One string per room: the event bus's key and a cache key part. */
export function quizRoomKey(room: QuizRoom): string {
  return `${room.kind}:${room.uuid}`;
}

/**
 * What go-live sends for a room. ONE shape per room, always naming it.
 *
 * The room is never inferred from the quiz. An empty body is still valid on
 * the wire (the server falls back to the quiz's own channel), but the quiz's
 * `channel_uuid` is PROVENANCE: nullable, possibly a deleted channel, and
 * silent about where this game should run. `{ channel_uuid }` is measured
 * working for a quiz born in the room, in another room, and in none
 * (2026-08-05), so the room on screen is stated outright.
 *
 * A Space game may also name the Space chat it was started from
 * (`conversation_uuid`), where its live and finished lines are posted; a
 * channel game never does.
 */
export function goLivePayload(room: QuizRoom, conversationUuid: string | null = null): GoLiveChannelQuizPayload {
  if (room.kind === 'channel') return { channel_uuid: room.uuid };
  return conversationUuid ? { space_uuid: room.uuid, conversation_uuid: conversationUuid } : { space_uuid: room.uuid };
}

/** Whether a game runs in this room: a link to another room's game opens nothing here. */
export function gameInRoom(
  game: { channel_uuid: string | null; space_uuid?: string | null },
  room: QuizRoom,
): boolean {
  return room.kind === 'channel' ? game.channel_uuid === room.uuid : game.space_uuid === room.uuid;
}
