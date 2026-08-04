'use client';

import { useState } from 'react';
import { useV2Session } from '@/v2/runtime/session-context';
import { BookText, Hash, Lock, MessageSquare, NotebookPen, Scale } from 'lucide-react';

import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';
import { formatCaseName } from '@/v2/features/cases/case-name';
import { channelsQueries } from '@/v2/features/channels/queries';
import { conversationsQueries } from '@/v2/features/conversations/queries';
import { recentlyViewedQueries } from '@/v2/features/recently-viewed/queries';
import type { RecentlyViewedItem } from '@/types/recently-viewed';
import { stripPastedTags } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import {
  HOME_SECTION_ROWS,
  HomeSection,
  HomeSectionEmpty,
  HomeSectionError,
  HomeSectionList,
  HomeSectionRow,
  HomeSectionSkeleton,
} from './HomeSection';

/**
 * The three data sections the Work and Study homes are built from.
 *
 * Each is the SAME shape — heading, at most three rows, one-line empty and error
 * states — so the two tabs read as one product with different contents rather than
 * as two different designs. See `HomeSection` for why the card is gone.
 *
 * EVERY SECTION CAPS AT THREE (owner). The queries still fetch their natural page
 * (the same cache entries the sidebar and the list pages share, so no extra request
 * is made anywhere); the cap is applied at RENDER. That is deliberate: sharing one
 * cache entry with the full list page is worth more than shaving a few rows off a
 * response that is already warm.
 */

/**
 * CHANNEL MESSAGES — "Jump back in". The three channels with the newest activity,
 * each showing who spoke last and what they said.
 *
 * IT ASKS FOR NO `per_page` (audit M3). The realtime spine already mounts
 * `mine({ viewerId })` for every eligible viewer, and params are part of the
 * key — so the `per_page: 6` this section used to pass forked a SECOND cache
 * entry and a second request on every home load, for a list it then sliced to
 * three anyway. Matching the spine's params is what makes this module free.
 */
export function ChannelMessagesSection() {
  const [now] = useState(() => Date.now());
  // Viewer-partitioned since W5 (audit note N4): channel rows carry per-viewer
  // state (`my_role`, `my_notify_level`, both counts), so whose rows these are
  // belongs in the key rather than resting on the cache-identity guard alone.
  const { userId: viewerId } = useV2Session();
  const query = useQuery(channelsQueries.mine({ viewerId }));
  const channels = (query.data?.data ?? []).slice(0, HOME_SECTION_ROWS);

  return (
    <HomeSection title="Jump back in" action={{ href: '/spaces', label: 'All' }}>
      {query.isPending ? (
        <HomeSectionSkeleton />
      ) : query.isError ? (
        <HomeSectionError
          message="Couldn't load channels."
          onRetry={() => void query.refetch()}
        />
      ) : channels.length === 0 ? (
        <HomeSectionEmpty
          title="No channel activity yet."
          action={{ href: '/spaces', label: 'Browse spaces' }}
        />
      ) : (
        <HomeSectionList>
          {channels.map((channel) => {
            const preview = channel.last_message;
            return (
              <HomeSectionRow
                key={channel.uuid}
                href={`/channels/${channel.uuid}`}
                icon={channel.visibility === 'private' ? Lock : Hash}
                title={channel.name}
                titleAside={channel.space.name}
                unread={(channel.unread_count ?? 0) > 0}
                secondary={
                  preview ? (
                    <>
                      <span className="text-foreground/70">{preview.author_name}</span>
                      {`: ${preview.snippet}`}
                    </>
                  ) : null
                }
                meta={formatRelativeTime(channel.last_message_at, now)}
              />
            );
          })}
        </HomeSectionList>
      )}
    </HomeSection>
  );
}

/**
 * CONVERSATIONS — the three most recent chats with Lawexa. Shares the recents peek
 * with the sidebar and the home strip, so it costs no request of its own.
 */
export function ConversationsSection() {
  const [now] = useState(() => Date.now());
  const { userId: viewerId } = useV2Session();
  const query = useQuery(conversationsQueries.recents({ viewerId }));
  const conversations = (query.data?.data ?? []).slice(0, HOME_SECTION_ROWS);

  return (
    <HomeSection
      title="Recent conversations"
      action={{ href: '/conversations', label: 'All' }}
    >
      {query.isPending ? (
        <HomeSectionSkeleton />
      ) : query.isError ? (
        <HomeSectionError
          message="Couldn't load conversations."
          onRetry={() => void query.refetch()}
        />
      ) : conversations.length === 0 ? (
        <HomeSectionEmpty title="No conversations yet — ask something above." />
      ) : (
        <HomeSectionList>
          {conversations.map((conversation) => (
            <HomeSectionRow
              key={conversation.id}
              href={`/c/${conversation.id}`}
              icon={MessageSquare}
              title={stripPastedTags(conversation.title) || 'Untitled conversation'}
              meta={formatRelativeTime(conversation.updated_at, now)}
            />
          ))}
        </HomeSectionList>
      )}
    </HomeSection>
  );
}

/** Map a recently-viewed row to its route, icon and type label. */
function resolveViewed(row: RecentlyViewedItem) {
  switch (row.type) {
    case 'case':
      return {
        href: `/cases/${row.item.slug}`,
        icon: Scale,
        // Same readable-name treatment as every other v2 case surface.
        title: formatCaseName(row.item.display_title || row.item.title),
        label: 'Case',
      };
    case 'note':
      return {
        href: `/notes/${row.item.slug}`,
        icon: NotebookPen,
        title: row.item.title,
        label: 'Note',
      };
    case 'statute':
      return {
        href: `/statutes/${row.item.slug}`,
        icon: BookText,
        title: row.item.short_title || row.item.title,
        label: 'Statute',
      };
    default:
      // Forward-compat: the contract is closed to three types today, but an
      // unknown row is SKIPPED rather than crashed on.
      return null;
  }
}

/**
 * RECENTLY VIEWED — Study only. Cases, notes and statutes the user opened, newest
 * first. Sliced AFTER the unknown-type filter, so three unknown rows cannot render
 * an empty-looking section.
 */
export function RecentlyViewedSection() {
  const [now] = useState(() => Date.now());
  const query = useQuery(recentlyViewedQueries.recentsPeek());
  const rows = (query.data?.data ?? [])
    .map((row) => ({ row, resolved: resolveViewed(row) }))
    .filter((entry): entry is { row: RecentlyViewedItem; resolved: NonNullable<ReturnType<typeof resolveViewed>> } =>
      entry.resolved !== null,
    )
    .slice(0, HOME_SECTION_ROWS);

  return (
    <HomeSection title="Recently viewed">
      {query.isPending ? (
        <HomeSectionSkeleton />
      ) : query.isError ? (
        <HomeSectionError
          message="Couldn't load recently viewed."
          onRetry={() => void query.refetch()}
        />
      ) : rows.length === 0 ? (
        <HomeSectionEmpty
          title="Nothing viewed yet."
          action={{ href: '/cases', label: 'Browse cases' }}
        />
      ) : (
        <HomeSectionList>
          {rows.map(({ row, resolved }) => (
            <HomeSectionRow
              key={`${row.type}-${resolved.href}`}
              href={resolved.href}
              icon={resolved.icon}
              title={resolved.title}
              titleAside={resolved.label}
              meta={formatRelativeTime(row.viewed_at, now)}
            />
          ))}
        </HomeSectionList>
      )}
    </HomeSection>
  );
}
