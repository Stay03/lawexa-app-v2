import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type {
  Channel,
  ChannelListResponse,
  ChannelResponse,
  Message,
  MessageListResponse,
  MessageReaction,
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
 * W3 CLOSED THE SEAM THIS BLOCK ANNOUNCED. `types/collab.ts` now carries the
 * per-viewer engagement fields (`is_bookmarked`, `reactions`), and the digest's
 * §F.2 rule is absolute: those two are OMITTED from `message.created` /
 * `message.updated` broadcasts AND from post/edit responses — the omission is
 * deliberate, after a real backend bug where broadcasts hardcoded
 * `is_bookmarked: false`. So EVERY writer that replaces a cached row now runs
 * it through {@link mergeViewerFields}: a stranger's edit can no longer wipe
 * the viewer's saves or reaction state. `is_pinned` is the safe shared one and
 * is taken from the payload whenever the payload defines it.
 *
 * ENGAGEMENT WRITERS (the third family): {@link applyReactionToggled},
 * {@link applyPinState} and {@link applyBookmarkState} are per-message field
 * deltas onto the same `messagesOf(channel)` caches — the same
 * `setQueryData`-from-events sanction, same no-op stability contract.
 */

type MessagePages = InfiniteData<MessageListResponse, string | null>;

/**
 * Carry the PER-VIEWER engagement fields across a row replacement.
 *
 * `incoming` wins wherever it actually defines a value; `previous` fills every
 * field the incoming payload left `undefined`. That single rule is correct for
 * both transports at once:
 *  - a BROADCAST / post-edit response omits `is_bookmarked` + `reactions`
 *    entirely, so the viewer's state survives;
 *  - a REST feed page carries them, so the server's values win — including the
 *    legitimate transitions (a save removed on another device, a reaction
 *    bucket emptied) that a "preserve unconditionally" rule would freeze.
 *
 * Returns `incoming` UNCHANGED when nothing had to be carried, so a writer that
 * changed nothing still returns its exact input (the stability contract).
 */
export function mergeViewerFields(previous: Message, incoming: Message): Message {
  const needsBookmark =
    incoming.is_bookmarked === undefined && previous.is_bookmarked !== undefined;
  const needsReactions =
    incoming.reactions === undefined && previous.reactions !== undefined;
  const needsPin = incoming.is_pinned === undefined && previous.is_pinned !== undefined;
  if (!needsBookmark && !needsReactions && !needsPin) return incoming;
  return {
    ...incoming,
    ...(needsBookmark ? { is_bookmarked: previous.is_bookmarked } : {}),
    ...(needsReactions ? { reactions: previous.reactions } : {}),
    ...(needsPin ? { is_pinned: previous.is_pinned } : {}),
  };
}

/** Every message-history cache entry for one channel (all params variants). */
function messageEntries(queryClient: QueryClient, channelUuid: string) {
  return queryClient.getQueriesData<MessagePages>({
    queryKey: channelsQueries.messagesOf(channelUuid),
  });
}

/**
 * Insert an incoming message at the head of the newest page, de-duplicated.
 * Dedupe matters three times now: the sender's own optimistic reconcile has
 * usually already placed the row, Reverb can redeliver after a reconnect, and —
 * since W3 — SKIPPING a row that is already present is also what protects its
 * per-viewer engagement fields from a redelivered `message.created` that omits
 * them (§F.2). A brand-new row legitimately has none of them.
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

/**
 * Replace an edited message wherever it is cached, PRESERVING the per-viewer
 * engagement fields the payload omits (§F.2 — see the module docblock).
 *
 * Also the one path a message-edit MUTATION should settle through, for exactly
 * the same reason: the edit response omits those fields too.
 */
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
        return mergeViewerFields(row, message);
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

/* ── Engagement writers (phase-5 W3) ───────────────────────────────────────
   All three walk the same `messagesOf(channel)` entries and patch ONE row's
   ONE field family. Each returns the untouched cache when the row isn't there
   (a pin event for a message far outside the loaded pages is a legitimate
   no-op — the pins PANEL is the surface that shows it).                     */

/** Patch one cached message in place; `patch` returns the SAME row reference
 *  to signal "nothing changed" (which keeps the whole cache entry stable). */
function patchMessage(
  queryClient: QueryClient,
  channelUuid: string,
  messageUuid: string,
  patch: (row: Message) => Message,
): void {
  for (const [queryKey, data] of messageEntries(queryClient, channelUuid)) {
    if (!data) continue;
    let changed = false;
    const pages = data.pages.map((page) => {
      let pageChanged = false;
      const rows = page.data.map((row) => {
        if (row.uuid !== messageUuid) return row;
        const next = patch(row);
        if (next === row) return row;
        pageChanged = true;
        return next;
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

/**
 * Set one emoji bucket's absolute state on a message.
 *
 * ORDER IS DELIBERATELY NOT RE-DERIVED. The server sorts count-desc then
 * first-reacted, but re-sorting on every delta would make chips hop under the
 * cursor mid-click — the exact jitter the "quiet chips" direction rules out. So
 * an existing bucket keeps its slot, a new one appends, and an emptied one
 * disappears; the server's canonical order returns with the next history fetch.
 *
 * `count: 0` REMOVES the bucket (the server stops listing an emoji nobody
 * holds). `reactedByMe` is `null` when the event belongs to someone else — the
 * viewer's own flag is then left exactly as it was.
 */
export function applyReactionToggled(
  queryClient: QueryClient,
  channelUuid: string,
  input: { messageUuid: string; emoji: string; count: number; reactedByMe: boolean | null },
): void {
  patchMessage(queryClient, channelUuid, input.messageUuid, (row) => {
    const current = row.reactions ?? [];
    const index = current.findIndex((entry) => entry.emoji === input.emoji);
    const existing = index >= 0 ? current[index] : null;

    if (input.count <= 0) {
      if (!existing) return row;
      return { ...row, reactions: current.filter((_, i) => i !== index) };
    }

    const reactedByMe = input.reactedByMe ?? existing?.reacted_by_me ?? false;
    if (
      existing &&
      existing.count === input.count &&
      existing.reacted_by_me === reactedByMe
    ) {
      return row;
    }
    const next: MessageReaction = {
      emoji: input.emoji,
      count: input.count,
      reacted_by_me: reactedByMe,
    };
    const reactions = existing
      ? current.map((entry, i) => (i === index ? next : entry))
      : [...current, next];
    return { ...row, reactions };
  });
}

/** Apply the SHARED pin state (`.message.pinned` / `.unpinned`, or a toggle's
 *  own response). Idempotent — a duplicate broadcast is a no-op (§F.18). */
export function applyPinState(
  queryClient: QueryClient,
  channelUuid: string,
  messageUuid: string,
  isPinned: boolean,
): void {
  patchMessage(queryClient, channelUuid, messageUuid, (row) =>
    row.is_pinned === isPinned ? row : { ...row, is_pinned: isPinned },
  );
}

/** Apply the PRIVATE save state. REST-only by design — nothing broadcasts it,
 *  so this writer only ever runs from the viewer's own toggle. */
export function applyBookmarkState(
  queryClient: QueryClient,
  channelUuid: string,
  messageUuid: string,
  isBookmarked: boolean,
): void {
  patchMessage(queryClient, channelUuid, messageUuid, (row) =>
    row.is_bookmarked === isBookmarked ? row : { ...row, is_bookmarked: isBookmarked },
  );
}

/* ── Collection writers (pins / saved panels) ──────────────────────────────
   The panels are LISTS OF MESSAGES with their own key families, so the message
   writers above never reach them. Removal is written optimistically because
   the row the reader just unpinned or unsaved must leave under 200ms — waiting
   for the settle refetch is the one place in this wave where a click would
   visibly hang. ADDITION is deliberately NOT written: a pin needs `pinned_by`
   and `pinned_at`, which no client-side toggle knows, so a new pin arrives with
   the refetch rather than as a half-built row.                              */

/** The one field these two list shapes share — everything else is per-list. */
interface MessageCollectionCache {
  data: { uuid: string }[];
}

/** A cache entry captured before an optimistic write, for exact rollback. */
export interface CollectionSnapshot {
  queryKey: readonly unknown[];
  data: unknown;
}

/**
 * Drop one message from every cached entry under a collection prefix, and
 * return what was there. Entries the row wasn't in are left untouched (and
 * produce no snapshot), so a rollback restores exactly what it changed.
 */
export function removeFromMessageCollection(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  messageUuid: string,
): CollectionSnapshot[] {
  const snapshots: CollectionSnapshot[] = [];
  for (const [key, data] of queryClient.getQueriesData<MessageCollectionCache>({
    queryKey,
  })) {
    if (!data) continue;
    const rows = data.data.filter((row) => row.uuid !== messageUuid);
    if (rows.length === data.data.length) continue;
    snapshots.push({ queryKey: key, data });
    queryClient.setQueryData(key, { ...data, data: rows });
  }
  return snapshots;
}

/** Put back exactly what {@link removeFromMessageCollection} took. */
export function restoreMessageCollections(
  queryClient: QueryClient,
  snapshots: readonly CollectionSnapshot[],
): void {
  for (const snapshot of snapshots) {
    queryClient.setQueryData(snapshot.queryKey, snapshot.data);
  }
}

/** Read one cached message (any history variant) — the snapshot an optimistic
 *  engagement toggle rolls back to. `null` when it isn't loaded. */
export function findCachedMessage(
  queryClient: QueryClient,
  channelUuid: string,
  messageUuid: string,
): Message | null {
  for (const [, data] of messageEntries(queryClient, channelUuid)) {
    if (!data) continue;
    for (const page of data.pages) {
      const row = page.data.find((candidate) => candidate.uuid === messageUuid);
      if (row) return row;
    }
  }
  return null;
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
