'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { conversationsQueries } from '@/v2/features/conversations/queries';
import {
  FOCUS_RING,
  ModuleCard,
  ModuleEmpty,
  ModuleError,
  ModuleSkeletonRows,
  formatRelativeTime,
} from './parts';

/**
 * RecentConversations — the Study tab's conversations strip (owner #34). Reuses
 * the SHARED `conversationsQueries.recents()` peek (the same single cache entry
 * the Design-B home and the other tabs read — no extra fetch), showing a few of
 * the newest threads with a compact relative time. Rows navigate to `/c/{id}`
 * (proxied to v1 until the v2 conversation screen ships).
 *
 * Rendered by StudyHome only for signed-in users. Skeleton → content cross-fade,
 * a distinct error (never error-as-empty), and a designed empty state.
 */

const MAX_ROWS = 5;

export function RecentConversations() {
  // `now` is captured ONCE via a lazy initializer so no clock read runs in render
  // (React Compiler lint); relative times are computed against this fixed anchor.
  const [now] = useState(() => Date.now());
  const recentsQuery = useQuery(conversationsQueries.recents());
  const recents = (recentsQuery.data?.data ?? []).slice(0, MAX_ROWS);

  return (
    <ModuleCard
      title="Recent chats"
      icon={MessageSquare}
      action={{ label: 'All', href: '/conversations' }}
    >
      {recentsQuery.isError ? (
        <ModuleError onRetry={() => recentsQuery.refetch()}>
          Couldn&apos;t load conversations.
        </ModuleError>
      ) : recentsQuery.isPending ? (
        <ModuleSkeletonRows rows={3} />
      ) : recents.length === 0 ? (
        <ModuleEmpty>No conversations yet.</ModuleEmpty>
      ) : (
        <ul className="flex flex-col px-2 pb-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {recents.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/c/${conversation.id}`}
                className={cn(
                  'group flex min-h-11 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/60',
                  FOCUS_RING,
                )}
              >
                <MessageSquare
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground/60"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground/90 transition-colors group-hover:text-foreground">
                  {stripPastedTags(conversation.title)}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
                  {formatRelativeTime(conversation.updated_at, now)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ModuleCard>
  );
}
