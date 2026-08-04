import type { QueryClient } from '@tanstack/react-query';
import type { Space, SpaceListResponse, SpaceResponse } from '@/types/collab';
import { spacesQueries } from './queries';

/**
 * spaces cache — the reference-stable writers that keep a space row's §17
 * activity rollups live between refetches. Fed exclusively by the realtime
 * spine (`v2/runtime/realtime/spine.tsx`) and the mark-read hook; components
 * never call these. Sources: `api-digest.md` §D (Ruling A) and plan W1 items
 * 2/4 (2026-08-04).
 *
 * WHY DELTAS AND NOT ABSOLUTES. `.channel.unread` carries ABSOLUTE counts for
 * the CHANNEL only — the space rollups (`unread_channels_count`,
 * `mention_count`) never ride any event. The channel writer
 * (`v2/features/channels/cache.ts`) therefore derives the TRANSITION a channel
 * made (mention +2, went-unread, went-read) and this module moves the space
 * row by exactly that transition, clamped at zero. Drift from a missed event
 * is bounded and self-healing: the spine's baseline spaces query is standard-
 * tier (refetch-on-focus stays ON), reconnect invalidates it, and the
 * unknown-channel fallback invalidates it too — every refetch re-asserts the
 * server's absolute rollups.
 *
 * RULING A LIVES IN THE DELTA, not here: the channel writer zeroes
 * `unreadChannelsDelta` for muted channels (mute kills the activity dot) while
 * letting `mentionDelta` through (a mute never suppresses a direct @you).
 *
 * REFERENTIAL STABILITY ON A NO-OP is deliberate and load-bearing (the
 * `bookmarks/cache.ts` contract): every transform returns its exact input when
 * nothing changed, so TanStack's tracked-props optimisation suppresses
 * re-renders across the fan-out. Consumers must not read `dataUpdatedAt` or
 * set `notifyOnChangeProps: 'all'`.
 */

/** The transition one channel's counts made, expressed as space-row movement. */
export interface SpaceRollupDeltas {
  /** Change in the caller's unread @mentions in that channel (may be negative). */
  mentionDelta: number;
  /** -1 | 0 | +1 — whether the channel crossed the has-unreads boundary.
   *  Already zeroed for muted channels by the channel writer (Ruling A). */
  unreadChannelsDelta: number;
}

/** Move one space row by the deltas; same reference when nothing changes. */
function applyToSpace(row: Space, spaceUuid: string, deltas: SpaceRollupDeltas): Space {
  if (row.uuid !== spaceUuid) return row;
  // The rollup fields are stamped for members only — when the server omitted
  // them we must not invent a number, so an absent field stays absent.
  const nextMention =
    typeof row.mention_count === 'number'
      ? Math.max(0, row.mention_count + deltas.mentionDelta)
      : row.mention_count;
  const nextUnreadChannels =
    typeof row.unread_channels_count === 'number'
      ? Math.max(0, row.unread_channels_count + deltas.unreadChannelsDelta)
      : row.unread_channels_count;
  if (
    nextMention === row.mention_count &&
    nextUnreadChannels === row.unread_channels_count
  ) {
    return row;
  }
  return {
    ...row,
    mention_count: nextMention,
    unread_channels_count: nextUnreadChannels,
  };
}

/**
 * Move a space's rollups across every cached surface that shows them — all
 * list variants and the space's detail entries.
 */
export function applySpaceRollupDeltas(
  queryClient: QueryClient,
  spaceUuid: string,
  deltas: SpaceRollupDeltas,
): void {
  if (deltas.mentionDelta === 0 && deltas.unreadChannelsDelta === 0) return;

  queryClient.setQueriesData<SpaceListResponse>(
    { queryKey: spacesQueries.lists() },
    (data) => {
      if (!data) return data;
      let changed = false;
      const rows = data.data.map((row) => {
        const next = applyToSpace(row, spaceUuid, deltas);
        if (next !== row) changed = true;
        return next;
      });
      return changed ? { ...data, data: rows } : data;
    },
  );

  queryClient.setQueriesData<SpaceResponse>(
    { queryKey: spacesQueries.detailsOf(spaceUuid) },
    (data) => {
      if (!data) return data;
      const next = applyToSpace(data.data, spaceUuid, deltas);
      return next === data.data ? data : { ...data, data: next };
    },
  );
}

/**
 * The unknown-transition fallback: when a `.channel.unread` arrives for a
 * channel with no cached row, the deltas cannot be derived — refetch the
 * server's absolute rollups instead. Invalidation-only (marks stale; active
 * consumers refetch), and the spine throttles calls so a cold-cache message
 * burst cannot turn into a refetch-per-event storm.
 */
export function invalidateSpaceRollups(
  queryClient: QueryClient,
  spaceUuid: string | null,
): void {
  void queryClient.invalidateQueries({ queryKey: spacesQueries.lists() });
  if (spaceUuid) {
    void queryClient.invalidateQueries({
      queryKey: spacesQueries.detailsOf(spaceUuid),
    });
  }
}

/**
 * The app-badge derivation: total unread @mentions across every space the
 * baseline list variant knows. Reads ONE canonical cache entry (the spine's
 * baseline `spacesQueries.list({...})` key) rather than fanning over variants,
 * so a search-filtered list can never double-count. First page only — a user
 * with more spaces than one page undercounts until refetch, which is accepted
 * (the badge is a summary, not a ledger).
 */
export function sumSpaceMentions(response: SpaceListResponse): number {
  return response.data.reduce(
    (total, space) => total + (space.mention_count ?? 0),
    0,
  );
}
