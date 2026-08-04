import { formatDayLabel, isSameCalendarDay } from '@/lib/utils/collab';
import type { Message, SlimUser } from '@/types/collab';
import type { RespondingTurn } from './lawexa/turns';
import { GROUP_WINDOW_MS } from './model';

/**
 * feed-model — the pure shaping layer between the message cache and the W2
 * feed: chronological flattening, day separators, 5-minute author grouping,
 * the `ai_divider` and quiz system-card breaks, and the gold unread divider's
 * placement. No hooks, no JSX — `ChannelFeed` memoises over it, so every
 * output object must be derived deterministically from the inputs (the
 * per-row `memo` holds only if group identity is stable across unrelated
 * re-renders). Sources: study A4 (grouping KEEP), api-digest §A/§E (quiz
 * cards, `ai_divider`), design-research DIRECTION 1/3 — 2026-08-04.
 */

export interface MessageGroupItem {
  kind: 'group';
  /** The first message's uuid — stable across the group's life. */
  key: string;
  author: SlimUser | null;
  isAi: boolean;
  messages: Message[];
}

export interface DayItem {
  kind: 'day';
  key: string;
  label: string;
}

/** A quiz system card renders as its own quiet card, never inside an author
 *  run (digest §E: Lawexa-authored, `metadata.game_uuid`/`quiz_uuid`). */
export interface QuizCardItem {
  kind: 'quiz-card';
  key: string;
  message: Message;
}

/** The gold "New" hairline (design-research DIRECTION 3). */
export interface UnreadDividerItem {
  kind: 'unread';
  key: 'unread-divider';
}

/** "Lawexa is responding", spliced under the message that summoned it. */
export interface RespondingItem {
  kind: 'responding';
  key: string;
  turn: RespondingTurn;
}

export type FeedItem =
  | MessageGroupItem
  | DayItem
  | QuizCardItem
  | UnreadDividerItem
  | RespondingItem;

/** Flatten the cursor pages (newest-first) into chronological order. */
export function flattenMessages(
  pages: readonly { data: Message[] }[] | undefined,
): Message[] {
  if (!pages) return [];
  const flat: Message[] = [];
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    const page = pages[i].data;
    for (let j = page.length - 1; j >= 0; j -= 1) {
      flat.push(page[j]);
    }
  }
  return flat;
}

/**
 * The unread anchor: the FIRST unseen message, derived from the channel's
 * `unread_count` at open (the last N messages are past the pointer). When
 * the unread run outreaches loaded history the anchor CLAMPS to the oldest
 * loaded message — and it is then FROZEN at capture (§5: the line persists
 * for the view session), so older unread messages loaded later render ABOVE
 * the line, outside it. A bounded inaccuracy, accepted: re-deriving on every
 * prepend would move a line the reader may already be using as a bookmark.
 * `null` = nothing unread (land at bottom).
 */
export function unreadAnchorUuid(
  messages: readonly Message[],
  unreadCount: number,
): string | null {
  if (unreadCount <= 0 || messages.length === 0) return null;
  const index = Math.max(0, messages.length - unreadCount);
  return messages[index].uuid;
}

/**
 * Shape the chronological list into render items. Not every message becomes
 * one: a session reset is dropped, so the item list can be shorter than the
 * transcript and can even be empty while messages exist.
 *
 * The unread divider is spliced immediately before the first item that renders
 * at or after `anchorUuid` (and breaks its group, so the first unseen message
 * re-states its author header under the line — the reader always knows who
 * wrote the first new thing).
 *
 * `respondingByMessage` (phase-5 W3) splices a "Lawexa is responding" row
 * immediately AFTER the message that summoned it and closes the author run, so
 * the row reads as a consequence of that message rather than as part of the
 * next one. Turns with no `message_uuid` are not this function's business —
 * they render at the foot of the transcript (api-digest §F.7's tolerant
 * fallback; the feed owns that placement).
 */
export function buildFeedItems(
  messages: readonly Message[],
  anchorUuid: string | null,
  respondingByMessage?: ReadonlyMap<string, RespondingTurn>,
): FeedItem[] {
  const items: FeedItem[] = [];
  let group: MessageGroupItem | null = null;
  /* BOTH SEPARATORS WAIT FOR SOMETHING TO SEPARATE. Not every message reaches
     the screen (a session reset is dropped below), so a label or a line placed
     the moment its message is seen can end up standing over empty space. The
     worst case is the unread line: a reset makes the divider the newest
     message and therefore the unread anchor, so the reader would be scrolled
     to a gold "New" pill promising a message that does not exist — the exact
     confusion this feed is meant to end. Held here, flushed day-then-line by
     the first item that actually renders; if nothing follows, neither
     appears. */
  let pendingDay: DayItem | null = null;
  let pendingUnread = false;
  const flushSeparators = () => {
    if (pendingDay !== null) {
      items.push(pendingDay);
      pendingDay = null;
    }
    if (pendingUnread) {
      items.push({ kind: 'unread', key: 'unread-divider' });
      pendingUnread = false;
    }
  };

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    const prev = i > 0 ? messages[i - 1] : null;

    if (!prev || !isSameCalendarDay(prev.created_at, message.created_at)) {
      pendingDay = {
        kind: 'day',
        key: `day-${message.uuid}`,
        label: formatDayLabel(message.created_at),
      };
      group = null;
    }

    if (anchorUuid !== null && message.uuid === anchorUuid) {
      pendingUnread = true;
      group = null;
    }

    const type = message.metadata.type;

    // A Lawexa session boundary carries no news for the reader: the backend
    // posts it as a real message ("Lawexa started a new conversation.") and on
    // screen its gold pill was mistaken for the unread line. It is dropped from
    // the feed but still CLOSES the run — the messages either side of a reset
    // belong to different conversations and must not merge into one group.
    if (type === 'ai_divider') {
      group = null;
      continue;
    }

    // Quiz system cards render as their own designed cards (W2: render-only;
    // W6 wires Join/Results). They break grouping like a divider does.
    if (type === 'quiz_game_live' || type === 'quiz_game_finished') {
      flushSeparators();
      items.push({ kind: 'quiz-card', key: `quiz-${message.uuid}`, message });
      group = null;
      continue;
    }

    // Identity requires BOTH the author uuid AND `is_ai` to match: Lawexa
    // (`is_ai`, author null) and a hard-deleted human (author null) would
    // otherwise merge (digest §F.3 — the v1 comment's exact trap).
    const last = group ? group.messages[group.messages.length - 1] : null;
    const sameAuthor =
      group !== null &&
      group.isAi === message.is_ai &&
      (group.author?.uuid ?? null) === (message.author?.uuid ?? null);
    const withinWindow =
      last !== null &&
      new Date(message.created_at).getTime() - new Date(last.created_at).getTime() <
        GROUP_WINDOW_MS;
    // A reply starts its own group: its quote block needs the author header
    // above it to read as "X replied to Y" (v1's rule, kept).
    const isReply = message.reply_to != null || message.parent_message_uuid !== null;

    if (group && sameAuthor && withinWindow && !isReply) {
      group.messages.push(message);
    } else {
      flushSeparators();
      group = {
        kind: 'group',
        key: message.uuid,
        author: message.author,
        isAi: message.is_ai,
        messages: [message],
      };
      items.push(group);
    }

    const turn = respondingByMessage?.get(message.uuid);
    if (turn) {
      items.push({
        kind: 'responding',
        key: `responding-${turn.executionId}`,
        turn,
      });
      // Close the run: anything the same author says next starts a fresh
      // header BELOW the row, so the row can't look like part of it.
      group = null;
    }
  }

  return items;
}

/**
 * Merge unacknowledged outbox rows back into the transcript IN CHRONOLOGICAL
 * ORDER (W2 audit L13).
 *
 * A failed send is not a new message — it is a message that belongs at the
 * moment it was written. Appending evicted rows at the end (the W2 behaviour)
 * was invisible while the failure was the newest thing on screen, but any
 * arrival after it pushed the failed row DOWN past messages that came later, so
 * a retry would silently re-post out of sequence and the reader would lose the
 * thread it belonged to. Both lists are already sorted, so this is a linear
 * merge on `created_at` with ties resolved in favour of the CACHED row (a
 * server row with the same instant is the real one).
 *
 * Returns `cached` unchanged when there is nothing to merge — the common case,
 * and the one that must not allocate.
 */
export function mergeOutboxRows(
  cached: readonly Message[],
  outbox: readonly Message[],
): readonly Message[] {
  if (outbox.length === 0) return cached;
  const present = new Set(cached.map((message) => message.uuid));
  const evicted = outbox.filter((message) => !present.has(message.uuid));
  if (evicted.length === 0) return cached;

  const merged: Message[] = [];
  let i = 0;
  let j = 0;
  while (i < cached.length && j < evicted.length) {
    const left = Date.parse(cached[i].created_at);
    const right = Date.parse(evicted[j].created_at);
    if (left <= right) merged.push(cached[i++]);
    else merged.push(evicted[j++]);
  }
  while (i < cached.length) merged.push(cached[i++]);
  while (j < evicted.length) merged.push(evicted[j++]);
  return merged;
}

/** The newest server-acknowledged message uuid — the read pointer's target
 *  (a local optimistic uuid must never be POSTed to markRead). */
export function newestRealMessageUuid(
  messages: readonly Message[],
  isLocal: (uuid: string) => boolean,
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (!isLocal(messages[i].uuid)) return messages[i].uuid;
  }
  return null;
}
