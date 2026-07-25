'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Hash, Lock } from 'lucide-react';

import type { ChannelListParams } from '@/types/collab';
import { channelsQueries } from '@/v2/features/channels/queries';
import {
  CountBadge,
  Module,
  ModuleEmpty,
  ModuleError,
  ModuleList,
  ModuleRow,
  ModuleSkeleton,
  RowIconTile,
  formatRelativeTime,
} from '../modules';

/**
 * "Jump back in" — the caller's most-active channels across ALL their spaces, so
 * a returning user lands back in the conversation they left (research: Notion's
 * home leads with exactly this "jump back in" resume module — it is the primary
 * reason to come back). Promoted to the wide left column on desktop where its
 * previews have room to breathe.
 *
 * ASK-B, LIVE. Backed by a SINGLE `channelsQueries.mine()` query
 * (GET /api/channels): the server returns the caller's active-membership
 * channels cross-space, sorted `last_message_at` desc (empty channels last),
 * muted excluded unless @mentioned, each row carrying its `space` context and a
 * `last_message` preview (author + flattened snippet).
 *
 * ROW HIERARCHY (owner: "name + space + preview with clear primary/secondary
 * contrast, badges aligned"): line one is the channel name (with its lock/hash
 * mark and the quiet space name as inline context); line two is the preview —
 * the author in a slightly stronger tone, then the flattened snippet. The mention
 * pill and the relative time sit in the aligned trailing cluster.
 *
 * Only mounted for signed-in users behind the spaces soft-launch gate (WorkHome
 * gates it).
 *
 * THREE STATES, NEVER A DISAPPEARING ACT. This module used to `return null` once
 * it resolved to zero channels — after having occupied a skeleton. On mobile it
 * sits at `order-2`, directly under the greeting, so that unmount yanked the
 * entire rest of the surface upward the moment the query settled, and left a
 * ghost gap in the reveal stagger on the way there. It now resolves into a
 * designed EMPTY state inside the frame it was already holding.
 *
 * Stated precisely, because the fix is real but partial: the module KEEPS its
 * place and its header, and what changes is only its body — three reserved rows
 * becoming the shorter empty state. That is still a settle of roughly one row's
 * worth of height, not zero. What is gone is the whole-module disappearance and
 * the ghost gap. Closing the remainder would mean padding the empty state to the
 * skeleton's height, which trades an honest small settle for permanent dead
 * space — not worth it.
 */

/** One small page of the caller's most-recent channels. A module constant so the
 *  query key is stable and every render resolves to a single cache entry. The
 *  response is NOT sliced, so this page size is also the row cap — but the
 *  skeleton still reserves the shared median, not this number (see
 *  `ModuleSkeleton`: reserving at the cap makes the collapse-to-sparse worse). */
const MINE_PARAMS: ChannelListParams = { per_page: 6 };

export function JumpBackInModule() {
  const [now] = useState(() => Date.now());
  const query = useQuery(channelsQueries.mine(MINE_PARAMS));
  const channels = query.data?.data ?? [];

  return (
    <Module title="Jump back in" icon={Hash}>
      {query.isPending ? (
        // Shared median reservation — see `ModuleSkeleton`.
        <ModuleSkeleton />
      ) : query.isError ? (
        <ModuleError
          message="Couldn't load channels"
          onRetry={() => query.refetch()}
        />
      ) : channels.length === 0 ? (
        <ModuleEmpty
          icon={Hash}
          title="No recent channels"
          action={{ href: '/spaces', label: 'Browse spaces' }}
        />
      ) : (
        <ModuleList>
          {channels.map((channel) => {
            const mentions = channel.mention_count ?? 0;
            const preview = channel.last_message;
            return (
              <ModuleRow
                key={channel.uuid}
                href={`/channels/${channel.uuid}`}
                leading={
                  <RowIconTile
                    icon={channel.visibility === 'private' ? Lock : Hash}
                  />
                }
                title={channel.name}
                unread={(channel.unread_count ?? 0) > 0}
                titleAside={
                  <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">
                    {channel.space.name}
                  </span>
                }
                secondary={
                  preview ? (
                    <>
                      <span className="font-medium text-foreground/70">
                        {preview.author_name}
                      </span>
                      {`: ${preview.snippet}`}
                    </>
                  ) : null
                }
                badge={
                  <CountBadge count={mentions} label={`${mentions} mentions`} />
                }
                meta={formatRelativeTime(channel.last_message_at, now)}
              />
            );
          })}
        </ModuleList>
      )}
    </Module>
  );
}
