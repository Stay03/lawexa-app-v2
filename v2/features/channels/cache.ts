import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type {
  Channel,
  ChannelListResponse,
  ChannelResponse,
  Message,
  MessageListResponse,
  NotifyLevel,
} from '@/types/collab';
import type { SpaceRollupDeltas } from '@/v2/features/spaces/cache';
import { channelsQueries } from './queries';

/**
 * channels cache — the reference-stable writers the realtime spine and the W2
 * room subscription write through. Ported from v1's `useChannelRealtime.ts` /
 * `useCollab.ts` writer logic onto the v2 key geography (never imported —
 * boundary rule; study A10 marks the pattern KEEP-the-model). Sources:
 * `api-digest.md` §A/§B/§D and plan W1 items 2/5 (2026-08-04).
 *
 * TWO FAMILIES:
 *  - MESSAGE writers (created / updated / deleted) — high-frequency small
 *    deltas onto the `messagesOf(channel)` infinite caches, the one case
 *    standards §2 sanctions `setQueryData`-from-events for.
 *  - COUNT writer (`applyChannelCounts`) — assigns the ABSOLUTE `.channel.unread`
 *    counts onto every cached channel row (never increments; the event is
 *    self-healing, digest §D), and derives the space-rollup TRANSITION the
 *    spaces writer consumes.
 *
 * REFERENTIAL STABILITY ON A NO-OP is the contract (the `bookmarks/cache.ts`
 * docblock): a transform that changes nothing returns its exact input, so the
 * fan-out across every cached list cannot re-render surfaces that don't hold
 * the row. Consumers must not read `dataUpdatedAt` or set
 * `notifyOnChangeProps: 'all'`.
 *
 * W3 SEAM, STATED NOW: `message.updated` broadcasts deliberately OMIT the
 * per-viewer fields (`is_bookmarked`, `reactions` — digest §F.2). Today's
 * `Message` type carries neither, so wholesale replacement is exact; the wave
 * that adds them to `types/collab.ts` MUST change {@link applyMessageUpdated}
 * to preserve the existing row's per-viewer fields, or a broadcast will
 * silently wipe them.
 */

type MessagePages = InfiniteData<MessageListResponse, string | null>;

/** Every message-history cache entry for one channel (all params variants). */
function messageEntries(queryClient: QueryClient, channelUuid: string) {
  return queryClient.getQueriesData<MessagePages>({
    queryKey: channelsQueries.messagesOf(channelUuid),
  });
}

/**
 * Insert an incoming message at the head of the newest page, de-duplicated.
 * Dedupe matters twice: the sender's own optimistic reconcile has usually
 * already placed the row, and Reverb can redeliver after a reconnect.
 */
export function applyMessageCreated(
  queryClient: QueryClient,
  message: Message,
): void {
  for (const [queryKey, data] of messageEntries(queryClient, message.channel_uuid)) {
    if (!data || data.pages.length === 0) continue;
    const exists = data.pages.some((page) =>
      page.data.some((row) => row.uuid === message.uuid),
    );
    if (exists) continue;
    const [first, ...rest] = data.pages;
    // Pages are newest-first, so a brand-new message leads the first page.
    queryClient.setQueryData<MessagePages>(queryKey, {
      ...data,
      pages: [{ ...first, data: [message, ...first.data] }, ...rest],
    });
  }
}

/** Replace an edited message wherever it is cached (see the W3 seam above). */
export function applyMessageUpdated(
  queryClient: QueryClient,
  message: Message,
): void {
  for (const [queryKey, data] of messageEntries(queryClient, message.channel_uuid)) {
    if (!data) continue;
    let changed = false;
    const pages = data.pages.map((page) => {
      let pageChanged = false;
      const rows = page.data.map((row) => {
        if (row.uuid !== message.uuid) return row;
        pageChanged = true;
        return message;
      });
      if (!pageChanged) return page;
      changed = true;
      return { ...page, data: rows };
    });
    if (changed) {
      queryClient.setQueryData<MessagePages>(queryKey, { ...data, pages });
    }
  }
}

/** Drop a (soft-)deleted message from every cached page. */
export function applyMessageDeleted(
  queryClient: QueryClient,
  channelUuid: string,
  messageUuid: string,
): void {
  for (const [queryKey, data] of messageEntries(queryClient, channelUuid)) {
    if (!data) continue;
    let changed = false;
    const pages = data.pages.map((page) => {
      const rows = page.data.filter((row) => row.uuid !== messageUuid);
      if (rows.length === page.data.length) return page;
      changed = true;
      return { ...page, data: rows };
    });
    if (changed) {
      queryClient.setQueryData<MessagePages>(queryKey, { ...data, pages });
    }
  }
}

/**
 * A `member.joined` / `member.left` landed (or a join/leave mutation settled):
 * roster and detail are stale. Invalidation, not a write — membership rows are
 * not worth hand-patching (v1's port; the events carry a slim member only).
 */
export function noteChannelMembershipChanged(
  queryClient: QueryClient,
  channelUuid: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: channelsQueries.membersOf(channelUuid),
  });
  void queryClient.invalidateQueries({
    queryKey: channelsQueries.detailsOf(channelUuid),
  });
}

/** The absolute counts to assign onto a channel's cached rows. */
export interface ChannelCountsPatch {
  unreadCount: number;
  /**
   * `null` ⇒ the caller doesn't know the mention count (the markRead response
   * carries only `unread_count`). It is then left untouched — EXCEPT when
   * `unreadCount` is 0: mentions are a subset of unreads, so zero unread
   * forces zero mentions. The `.channel.unread` echo reconciles the rest.
   */
  mentionCount: number | null;
}

/** What the writer learned while assigning — the spine's whole decision input. */
export interface ChannelCountsApplication {
  /** Whether any cached row for this channel existed before the write. */
  found: boolean;
  /** The channel's space, read from the cached row (`null` when not found). */
  spaceUuid: string | null;
  /** For the mention toast's description (`null` when not found). */
  channelName: string | null;
  /** The caller's notify level from the cached row; `null` = unknown. */
  notifyLevel: NotifyLevel | null;
  /**
   * The space-rollup transition this assignment caused, or `null` when the
   * previous counts were unknown (then the caller falls back to
   * `invalidateSpaceRollups`). `unreadChannelsDelta` is already zeroed for
   * muted channels — Ruling A: mute kills the activity rollup, never the
   * mention badge.
   */
  deltas: SpaceRollupDeltas | null;
}

/**
 * ASSIGN absolute counts onto every cached row of one channel — the
 * cross-space `mine` list, every per-space list, and the channel detail —
 * and report the transition. Never increments (digest §D: the event is
 * self-healing; dropped frames heal on the next event).
 *
 * When the same channel is cached in several lists with DIVERGED counts (one
 * list refetched, another didn't), the transition is derived from the FIRST
 * row found (detail preferred — it is the freshest surface); the assignment
 * itself converges them all. Any resulting rollup drift is bounded by the
 * next spaces refetch.
 */
export function applyChannelCounts(
  queryClient: QueryClient,
  channelUuid: string,
  patch: ChannelCountsPatch,
): ChannelCountsApplication {
  let prev: Channel | null = null;

  for (const [, data] of queryClient.getQueriesData<ChannelResponse>({
    queryKey: channelsQueries.detailsOf(channelUuid),
  })) {
    if (data?.data.uuid === channelUuid) {
      prev = data.data;
      break;
    }
  }
  if (!prev) {
    for (const [, data] of queryClient.getQueriesData<ChannelListResponse>({
      queryKey: channelsQueries.lists(),
    })) {
      const row = data?.data.find((candidate) => candidate.uuid === channelUuid);
      if (row) {
        prev = row;
        break;
      }
    }
  }

  const prevUnread =
    typeof prev?.unread_count === 'number' ? prev.unread_count : null;
  const prevMention =
    typeof prev?.mention_count === 'number' ? prev.mention_count : null;
  const nextUnread = patch.unreadCount;
  const nextMention =
    patch.mentionCount ?? (patch.unreadCount === 0 ? 0 : null);

  const assignToRow = (row: Channel): Channel => {
    if (row.uuid !== channelUuid) return row;
    // A null nextMention means "leave this row's mention count alone".
    const mentionForRow = nextMention ?? row.mention_count;
    if (row.unread_count === nextUnread && row.mention_count === mentionForRow) {
      return row;
    }
    return { ...row, unread_count: nextUnread, mention_count: mentionForRow };
  };

  queryClient.setQueriesData<ChannelListResponse>(
    { queryKey: channelsQueries.lists() },
    (data) => {
      if (!data) return data;
      let changed = false;
      const rows = data.data.map((row) => {
        const next = assignToRow(row);
        if (next !== row) changed = true;
        return next;
      });
      return changed ? { ...data, data: rows } : data;
    },
  );

  queryClient.setQueriesData<ChannelResponse>(
    { queryKey: channelsQueries.detailsOf(channelUuid) },
    (data) => {
      if (!data) return data;
      const next = assignToRow(data.data);
      return next === data.data ? data : { ...data, data: next };
    },
  );

  let deltas: SpaceRollupDeltas | null = null;
  if (prevUnread !== null) {
    const muted = prev?.my_notify_level === 'muted';
    deltas = {
      mentionDelta:
        prevMention !== null && nextMention !== null
          ? nextMention - prevMention
          : 0,
      unreadChannelsDelta: muted
        ? 0
        : (nextUnread > 0 ? 1 : 0) - (prevUnread > 0 ? 1 : 0),
    };
  }

  return {
    found: prev !== null,
    spaceUuid: prev?.space.uuid ?? null,
    channelName: prev?.name ?? null,
    notifyLevel: prev?.my_notify_level ?? null,
    deltas,
  };
}
