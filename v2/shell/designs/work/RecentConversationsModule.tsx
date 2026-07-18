'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';

import { stripPastedTags } from '@/lib/utils';
import { conversationsQueries } from '@/v2/features/conversations/queries';
import {
  Module,
  ModuleEmpty,
  ModuleError,
  ModuleList,
  ModuleRow,
  ModuleSkeleton,
  RowIconTile,
  formatRelativeTime,
} from '../modules';

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
    <Module
      title="Recent conversations"
      icon={MessageSquare}
      action={{ href: '/conversations', label: 'All' }}
    >
      {query.isPending ? (
        <ModuleSkeleton rows={3} lines={1} />
      ) : query.isError ? (
        <ModuleError
          message="Couldn't load conversations"
          onRetry={() => query.refetch()}
        />
      ) : conversations.length === 0 ? (
        <ModuleEmpty icon={MessageSquare} title="No conversations yet" />
      ) : (
        <ModuleList>
          {conversations.map((conversation) => (
            <ModuleRow
              key={conversation.id}
              href={`/c/${conversation.id}`}
              leading={<RowIconTile icon={MessageSquare} />}
              title={stripPastedTags(conversation.title)}
              meta={formatRelativeTime(conversation.updated_at, now)}
            />
          ))}
        </ModuleList>
      )}
    </Module>
  );
}
