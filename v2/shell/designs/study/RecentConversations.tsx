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

/**
 * RecentConversations — the Study tab's conversations strip (owner #34). Reuses
 * the SHARED `conversationsQueries.recents()` peek (the same single cache entry
 * the other tabs read — no extra fetch), showing a few of the newest threads with
 * a compact relative time. Rows navigate to `/c/{id}` (proxied to v1 until the v2
 * conversation screen ships). Identical anatomy to the Work tab's recent-
 * conversations strip, so the two tabs stay in visual lockstep.
 *
 * Rendered by StudyHome only for signed-in users.
 */

const MAX_ROWS = 5;

export function RecentConversations() {
  // `now` is captured ONCE via a lazy initializer so no clock read runs in render
  // (React Compiler lint); relative times are computed against this fixed anchor.
  const [now] = useState(() => Date.now());
  const recentsQuery = useQuery(conversationsQueries.recents());
  const recents = (recentsQuery.data?.data ?? []).slice(0, MAX_ROWS);

  return (
    <Module
      title="Recent chats"
      icon={MessageSquare}
      action={{ href: '/conversations', label: 'All' }}
    >
      {recentsQuery.isError ? (
        <ModuleError
          message="Couldn't load conversations"
          onRetry={() => recentsQuery.refetch()}
        />
      ) : recentsQuery.isPending ? (
        <ModuleSkeleton rows={3} lines={1} />
      ) : recents.length === 0 ? (
        <ModuleEmpty icon={MessageSquare} title="No conversations yet" />
      ) : (
        <ModuleList>
          {recents.map((conversation) => (
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
