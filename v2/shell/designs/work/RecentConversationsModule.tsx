'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';

import { stripPastedTags } from '@/lib/utils';
import { conversationsQueries } from '@/v2/features/conversations/queries';
import {
  ModuleEmpty,
  ModuleError,
  ModuleRowSkeleton,
  ROW_CLASS,
  WorkModule,
  formatRelativeTime,
} from './primitives';

/** How many conversation rows the strip shows before "All" takes over. */
const MAX_ROWS = 5;

/**
 * Recent conversations — a compact strip reusing `conversationsQueries.recents()`,
 * the SAME single-page cache the sidebar and drawer Recents read, so this never
 * costs a second fetch and stays in lockstep with the chrome. Rows navigate to
 * `/c/{id}` (proxied to v1 until the v2 conversation screen ships). Only mounted
 * for signed-in users (WorkHome gates it).
 */
export function RecentConversationsModule() {
  const [now] = useState(() => Date.now());
  const query = useQuery(conversationsQueries.recents());
  const conversations = (query.data?.data ?? []).slice(0, MAX_ROWS);

  return (
    <WorkModule
      title="Recent conversations"
      action={{ href: '/conversations', label: 'All' }}
    >
      {query.isPending ? (
        <ModuleRowSkeleton rows={3} />
      ) : query.isError ? (
        <ModuleError
          message="Couldn't load conversations"
          onRetry={() => query.refetch()}
        />
      ) : conversations.length === 0 ? (
        <ModuleEmpty icon={MessageSquare} title="No conversations yet" />
      ) : (
        <ul className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link href={`/c/${conversation.id}`} className={ROW_CLASS}>
                <MessageSquare
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground/70"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground/90">
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
    </WorkModule>
  );
}
