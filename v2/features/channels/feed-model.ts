import { formatDayLabel, isSameCalendarDay } from '@/lib/utils/collab';
import type { Message, SlimUser } from '@/types/collab';
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

export interface AiDividerItem {
  kind: 'ai-divider';
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

export type FeedItem =
  | MessageGroupItem
  | DayItem
  | AiDividerItem
  | QuizCardItem
  | UnreadDividerItem;

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
 * Shape the chronological list into render items. The unread divider is
 * spliced immediately before `anchorUuid`'s message (and breaks its group, so
 * the first unseen message re-states its author header under the line — the
 * reader always knows who wrote the first new thing).
 */
export function buildFeedItems(
  messages: readonly Message[],
  anchorUuid: string | null,
): FeedItem[] {
  const items: FeedItem[] = [];
  let group: MessageGroupItem | null = null;

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    const prev = i > 0 ? messages[i - 1] : null;

    if (!prev || !isSameCalendarDay(prev.created_at, message.created_at)) {
      items.push({
        kind: 'day',
        key: `day-${message.uuid}`,
        label: formatDayLabel(message.created_at),
      });
      group = null;
    }

    if (anchorUuid !== null && message.uuid === anchorUuid) {
      items.push({ kind: 'unread', key: 'unread-divider' });
      group = null;
    }

    const type = message.metadata.type;

    // A Lawexa session boundary is a separator, not a bubble (study A9 KEEP).
    if (type === 'ai_divider') {
      items.push({
        kind: 'ai-divider',
        key: `ai-divider-${message.uuid}`,
        label: message.content,
      });
      group = null;
      continue;
    }

    // Quiz system cards render as their own designed cards (W2: render-only;
    // W6 wires Join/Results). They break grouping like a divider does.
    if (type === 'quiz_game_live' || type === 'quiz_game_finished') {
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
      group = {
        kind: 'group',
        key: message.uuid,
        author: message.author,
        isAi: message.is_ai,
        messages: [message],
      };
      items.push(group);
    }
  }

  return items;
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
