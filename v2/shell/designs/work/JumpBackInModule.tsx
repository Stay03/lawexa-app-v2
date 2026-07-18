'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { Hash, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Channel, ChannelListParams, ChannelListResponse } from '@/types/collab';
import { channelsQueries } from '@/v2/features/channels/queries';
import { spacesQueries } from '@/v2/features/spaces/queries';
import {
  CountBadge,
  ModuleError,
  ModuleRowSkeleton,
  ROW_CLASS,
  UnreadDot,
  WorkModule,
  formatRelativeTime,
} from './primitives';
import { WORK_SPACES_PARAMS } from './spaces-source';

/**
 * "Jump back in" — the caller's most-active channels, so a returning user lands
 * back in the conversation they left.
 *
 * BOUNDED DEPENDENT FETCH (the intended, single waterfall). No cross-space
 * my-channels endpoint exists yet, so this fans out over just the top
 * `TOP_SPACES` work spaces (ranked by unread rollup, then recency), fetches each
 * one's channels newest-first, and merges + re-sorts them into one capped list.
 * The spaces query is SHARED with "Your work spaces" (same `WORK_SPACES_PARAMS`
 * key → one fetch), so the only added round-trips are the ≤ TOP_SPACES channel
 * lists — a deliberate, bounded fan-out, never an unbounded per-space waterfall.
 *
 * THE ASK-B SEAM. When the cross-space my-channels endpoint ships (backend Ask
 * B), this module swaps its data source at ONE boundary: replace the
 * spaces-query + `useQueries` fan-out with a single `channelsQueries.mine()`
 * leaf. The row rendering, badges, sorting, and layout below stay exactly as-is
 * — the module already consumes a flat, sorted `Channel[]`.
 *
 * Only mounted for signed-in users (WorkHome gates it). Hidden entirely when the
 * caller has no work spaces, or when those spaces surface no channels.
 */

/** How many spaces to fan out over, and how many merged rows to show. */
const TOP_SPACES = 2;
const MAX_CHANNELS = 5;

/** Newest-first channels within each fanned-out space. */
const CHANNEL_PARAMS: ChannelListParams = {
  sort: 'last_message_at',
  order: 'desc',
  per_page: MAX_CHANNELS,
};

interface JumpBackInData {
  channels: Channel[];
  isPending: boolean;
  isError: boolean;
}

/**
 * Merge the fanned-out channel lists into one capped, recency-sorted list.
 * Module-scope (stable reference) so `useQueries` only re-runs it when a result
 * changes, and its structurally-shared return stays referentially stable across
 * renders (no selector-churn re-render loop).
 */
function combineChannels(
  results: UseQueryResult<ChannelListResponse>[],
): JumpBackInData {
  const channels = results
    .flatMap((result) => result.data?.data ?? [])
    .sort((a, b) =>
      (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''),
    )
    .slice(0, MAX_CHANNELS);

  return {
    channels,
    isPending: results.some((result) => result.isPending),
    // Errored only when EVERY fanned-out list failed (one space's channels
    // failing while another loads still shows what we got).
    isError: results.length > 0 && results.every((result) => result.isError),
  };
}

export function JumpBackInModule() {
  const [now] = useState(() => Date.now());
  const queryClient = useQueryClient();
  const spacesQuery = useQuery(spacesQueries.list(WORK_SPACES_PARAMS));
  const spaces = spacesQuery.data?.data ?? [];

  // Rank by unread rollup, then recency (ISO strings sort lexicographically, so
  // no Date parsing in render). Pure — a fresh sorted array is fine; the derived
  // query keys are stable, so re-deriving never churns the fetches.
  const topSpaces = [...spaces]
    .sort(
      (a, b) =>
        (b.unread_channels_count ?? 0) - (a.unread_channels_count ?? 0) ||
        (b.updated_at ?? '').localeCompare(a.updated_at ?? ''),
    )
    .slice(0, TOP_SPACES);

  const { channels, isPending: channelsPending, isError: channelsError } =
    useQueries({
      queries: topSpaces.map((space) =>
        channelsQueries.bySpace(space.uuid, CHANNEL_PARAMS),
      ),
      combine: combineChannels,
    });

  // No work spaces → nothing to jump back into: hide the module entirely.
  if (!spacesQuery.isPending && spaces.length === 0) return null;
  // Spaces resolved with channels resolved-but-empty → also hide (never an
  // empty "Jump back in" panel).
  if (
    !spacesQuery.isPending &&
    !channelsPending &&
    !channelsError &&
    channels.length === 0
  ) {
    return null;
  }

  const pending = spacesQuery.isPending || channelsPending;

  return (
    <WorkModule title="Jump back in">
      {pending ? (
        <ModuleRowSkeleton rows={3} />
      ) : channelsError ? (
        <ModuleError
          message="Couldn't load channels"
          onRetry={() =>
            topSpaces.forEach((space) =>
              queryClient.invalidateQueries({
                queryKey: channelsQueries.bySpace(space.uuid, CHANNEL_PARAMS)
                  .queryKey,
              }),
            )
          }
        />
      ) : (
        <ul className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {channels.map((channel) => {
            const hasUnread = (channel.unread_count ?? 0) > 0;
            const Icon = channel.visibility === 'private' ? Lock : Hash;
            return (
              <li key={channel.uuid}>
                <Link href={`/channels/${channel.uuid}`} className={ROW_CLASS}>
                  <Icon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground/70"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          hasUnread
                            ? 'font-semibold text-foreground'
                            : 'font-medium text-foreground/90',
                        )}
                      >
                        {channel.name}
                      </span>
                      {hasUnread ? <UnreadDot /> : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {channel.space.name}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <CountBadge
                      count={channel.mention_count ?? 0}
                      label={`${channel.mention_count} mentions`}
                    />
                    <span className="text-xs tabular-nums text-muted-foreground/70">
                      {formatRelativeTime(channel.last_message_at, now)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </WorkModule>
  );
}
