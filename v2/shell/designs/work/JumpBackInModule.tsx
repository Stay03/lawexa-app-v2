'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Hash, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ChannelListParams } from '@/types/collab';
import { channelsQueries } from '@/v2/features/channels/queries';
import {
  CountBadge,
  ModuleError,
  ModuleRowSkeleton,
  ROW_CLASS,
  UnreadDot,
  WorkModule,
  formatRelativeTime,
} from './primitives';

/**
 * "Jump back in" — the caller's most-active channels across ALL their spaces, so
 * a returning user lands back in the conversation they left.
 *
 * ASK-B, LIVE. Backed by a SINGLE `channelsQueries.mine()` query
 * (GET /api/channels): the server returns the caller's active-membership
 * channels cross-space, sorted `last_message_at` desc (empty channels last),
 * muted excluded unless @mentioned, each row carrying its `space` context and a
 * `last_message` preview (author + flattened snippet). The earlier per-space
 * fan-out + client merge/sort is GONE — all of that ranking is now server-side,
 * so this module just renders a flat, sorted `Channel[]`.
 *
 * Only mounted for signed-in users behind the spaces soft-launch gate (WorkHome
 * gates it). Hidden entirely when the caller has no channels — never an empty
 * "Jump back in" panel.
 */

/** One small page of the caller's most-recent channels. A module constant so the
 *  query key is stable and every render resolves to a single cache entry. */
const MINE_PARAMS: ChannelListParams = { per_page: 6 };

export function JumpBackInModule() {
  const [now] = useState(() => Date.now());
  const query = useQuery(channelsQueries.mine(MINE_PARAMS));
  const channels = query.data?.data ?? [];

  // Resolved-but-empty → hide the module (never an empty "Jump back in" panel).
  if (!query.isPending && !query.isError && channels.length === 0) {
    return null;
  }

  return (
    <WorkModule title="Jump back in">
      {query.isPending ? (
        <ModuleRowSkeleton rows={3} />
      ) : query.isError ? (
        <ModuleError
          message="Couldn't load channels"
          onRetry={() => query.refetch()}
        />
      ) : (
        <ul className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {channels.map((channel) => {
            const hasUnread = (channel.unread_count ?? 0) > 0;
            const Icon = channel.visibility === 'private' ? Lock : Hash;
            const preview = channel.last_message;
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
                    {/* Preview line — author + flattened snippet, one quiet
                        truncated line. `author_name` is "Lawexa" for AI messages
                        (rendered like any other name). Null (no surviving
                        message) ⇒ line omitted; the row stays compact, no gap. */}
                    {preview ? (
                      <span className="truncate text-xs text-muted-foreground/80">
                        <span className="font-medium text-foreground/70">
                          {preview.author_name}
                        </span>
                        {`: ${preview.snippet}`}
                      </span>
                    ) : null}
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
