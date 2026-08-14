'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { GitBranch, Loader2, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type { Channel } from '@/types/collab';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { quietReplaceUrlParams } from '@/v2/runtime/url-params';
import { TabRow } from '@/v2/shell/TabRow';
import { CountBadge, FOCUS_RING, UnreadDot } from '@/v2/shell/designs/modules';
import { channelsQueries } from '../queries';
import {
  channelDisplayName,
  threadUnreadState,
  type ThreadUnreadState,
} from '../thread-model';
import { RelativeTime } from '../ui/RelativeTime';

/**
 * ThreadsSheet — where the conversations went. Threads Phase 4, 2026-08-12.
 *
 * ── IT IS AN OBLIGATION, NOT A NICETY ──────────────────────────────────────
 * `listChannels` / `listUserChannels` apply `topLevel()`, so a thread appears
 * in no rail, no drawer, no `/channels` and no home section — correct, and
 * deliberate. But `SpaceService`'s `unread_channels_count` and `mention_count`
 * subselects do NOT exclude threads, and the backend author ruled on
 * 2026-08-12 that they stay that way: "the badge is telling the truth; taking
 * it out would hide real news to avoid explaining it". So an unread thread
 * lights a space's dot and the app badge, and this panel is the only surface
 * in the product that can say what the badge is about.
 *
 * It is also the only way to reach a STANDALONE thread at all. One started
 * with no message behind it hangs under nothing, so there is no line in any
 * transcript to open it from.
 *
 * ── A LENS, NOT A SECTION ──────────────────────────────────────────────────
 * Chat / Lists / Files REPLACE the transcript; this sits over it, like Pinned
 * and Saved, and is entered from the same lens cluster in the header. Same
 * reasoning as DIRECTION 14: a lens over the channel's own conversations is
 * never a second place to read them, and every row's job is to leave.
 *
 * ── PAGE-BASED PAGING, AND THAT IS THE TRAP ────────────────────────────────
 * `GET /channels/{uuid}/threads` is length-aware (`page` / `per_page` 1–100),
 * while the message feed one route away is cursor-paginated. `InlineReplies`
 * carries the same warning for `/replies`. Measured on prod 2026-08-12:
 * `?cursor=` is ignored outright, so the feed's `getNextPageParam` copied here
 * would page for ever over page one.
 *
 * ── ROWS SPEAK PHASE 2's GRAMMAR, NOT A NEW ONE ────────────────────────────
 * Muted / full-strength / semibold-plus-gold-dot, off {@link threadUnreadState}
 * — the same three states `ThreadLine` draws under a message, so a reader
 * learns them once. There is no numeric unread badge: a gold NUMBER means a
 * mention and only a mention in this product, and the one on these rows IS a
 * mention count — the very thing the space rollup is counting and nothing else
 * could explain.
 *
 * ── AND THERE IS NO "NEW THREAD" BUTTON ────────────────────────────────────
 * Starting one cold takes a title (the server has nothing to derive one from),
 * which is a form standing between a thought and the room it belongs in — the
 * same reason Phase 3 branches with no dialog. Threads are started from a
 * message, and the empty state says so.
 */

/** All, or only the threads this reader follows. */
type ThreadsFilter = 'all' | 'mine';

const FILTER_TABS: readonly { id: ThreadsFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Following' },
];

/** The scroll region is the tab panel — one panel whose CONTENT changes. */
const PANEL_ID = 'v2-channel-threads';

/**
 * The title's three weights. Byte-for-byte the tones `ThreadLine` uses in
 * `feed/MessageRow.tsx`: a reader who learns the grammar under a message must
 * not have to learn it again in the list.
 */
const TITLE_TONE: Record<ThreadUnreadState, string> = {
  none: 'text-muted-foreground',
  'caught-up': 'text-foreground',
  behind: 'font-semibold text-foreground',
};

/**
 * `?mine=1` off the LIVE URL, never a React snapshot.
 *
 * Every URL write on this screen is QUIET (it never wakes the App Router), so
 * `useSearchParams` and the navigation-time props derived from it can be stale
 * while the address bar is current — the same rule `useUrlOverlay` and the
 * screen's own `?tab=` are built on. Exactly `'1'` counts: a hand-edited
 * `?mine=0` means All, which is what it says.
 */
function readMineParam(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('mine') === '1';
}

export function ThreadsSheet({
  channel,
  viewerId,
  canBranch,
  open,
  onOpenChange,
  onNavigate,
}: {
  channel: Channel;
  viewerId: number | null;
  /**
   * False for a space member previewing a `space_public` channel they never
   * joined. The list itself is open to them — the endpoint authorizes on
   * `previewMessages` — but they cannot branch anything, so the empty state
   * must not tell them to.
   */
  canBranch: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * A row is leaving for another channel, so the screen closes this sheet IN
   * PLACE. A dismissal walks back over the entry the sheet was opened on, and
   * the navigation about to happen would land on an entry a queued
   * `history.back()` is going to discard — the `MessageCollectionSheet` rule.
   */
  onNavigate: () => void;
}) {
  /* THE FILTER IS MIRRORED INTO `?mine=`, THE WAY `?tab=` IS — component state
     plus a quiet REPLACE, plus a popstate adopter. It is not an overlay and
     must not push a history entry: switching to Following is a change of view,
     not a place, and a reader who pressed Back expecting to leave the panel
     would instead walk back through their own filter presses.

     The adopter is what keeps the two honest. Closing the sheet POPS the entry
     that carried both params, so without it the state would still say
     "Following" while the URL said nothing at all. */
  const [filter, setFilter] = useState<ThreadsFilter>(() =>
    readMineParam() ? 'mine' : 'all',
  );
  useEffect(() => {
    const onPopState = () => setFilter(readMineParam() ? 'mine' : 'all');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const selectFilter = (next: ThreadsFilter) => {
    setFilter(next);
    quietReplaceUrlParams({ mine: next === 'mine' ? '1' : null });
  };

  const mine = filter === 'mine';
  const query = useInfiniteQuery({
    ...channelsQueries.threads({ channelUuid: channel.uuid, mine, viewerId }),
    enabled: open,
  });
  const threads = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Variant-matched width, or these are dead classes — see `SpaceDrawer`.
          The primitive's `data-[side=right]:*` sizing outranks a bare utility,
          so `w-full sm:max-w-md` would lose silently and this sheet would draw
          at three quarters of a phone screen. */}
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <GitBranch aria-hidden className="size-4 text-primary" />
            Threads
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Conversations branched out of {channelDisplayName(channel)}
          </p>
          {/* A block wrapper, so the pill keeps its content width: the header
              is a flex COLUMN, and a bare `inline-flex` child would be
              stretched to the full width by `align-items: stretch`. */}
          <div className="mt-1">
            <TabRow
              tabs={FILTER_TABS}
              value={filter}
              onChange={selectFilter}
              ariaLabel="Filter threads"
              panelId={PANEL_ID}
              className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-full bg-secondary/60 p-0.5"
              tabClassName={(selected) =>
                cn(
                  'v2-interactive min-h-8 shrink-0 rounded-full px-3.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
                  selected
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {(tab) => tab.label}
            </TabRow>
          </div>
        </SheetHeader>

        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={`${PANEL_ID}-tab-${filter}`}
          className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto"
        >
          {query.isPending ? (
            <ThreadsSkeleton />
          ) : query.isError ? (
            <div className="px-4 py-6">
              <CollabMessage
                icon={WifiOff}
                tone="alert"
                title="Couldn't load threads"
                description="We couldn't load this channel's threads. Please try again."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void query.refetch()}
                  >
                    Try again
                  </Button>
                }
              />
            </div>
          ) : threads.length === 0 ? (
            <div className="px-4 py-6">
              <CollabMessage
                icon={GitBranch}
                tone="neutral"
                title={
                  mine ? 'You’re not following any threads' : 'No threads here yet'
                }
                description={
                  mine
                    ? 'You follow a thread by posting in it. Switch to All to see every thread in this channel.'
                    : canBranch
                      ? 'Branch a message to start one.'
                      : 'Nobody has branched a message into a thread here yet.'
                }
              />
            </div>
          ) : (
            <ul className="divide-y">
              {threads.map((thread) => (
                <ThreadRow
                  key={thread.uuid}
                  thread={thread}
                  onNavigate={onNavigate}
                />
              ))}
              {query.hasNextPage && (
                <li className="flex justify-center p-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void query.fetchNextPage()}
                    disabled={query.isFetchingNextPage}
                  >
                    {query.isFetchingNextPage && (
                      <Loader2 aria-hidden className="size-4 animate-spin" />
                    )}
                    Load more threads
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * How many people have spoken in a thread — which is what following IS here,
 * so the count and the word agree. `0` is a real value and reads as one: a
 * branch nobody has answered yet has no followers, not "0 following".
 */
function followerLabel(count: number): string {
  if (count === 0) return 'Nobody following yet';
  return `${count} following`;
}

/**
 * One thread.
 *
 * A LINK, LIKE `ThreadLine`. It goes to another room, so it is an address —
 * openable in a new tab, copyable, restorable by Back — and the sheet closes
 * IN PLACE beneath it rather than popping the entry the navigation is about to
 * land on.
 *
 * THE AGE IS ACTIVITY, NEVER CREATION. A silent thread carries
 * `last_message_at: null` and is given no timestamp at all: the only other
 * clock on the payload is `created_at`, which is when somebody branched it, and
 * those two can be days apart. It says "No messages yet" instead — the same
 * answer `MyChannelRow` gives for a channel with nothing in it. Such a thread
 * sorts to the TOP of this list, which is the whole reason it is reachable.
 *
 * NO LEADING TILE. Every row here is the same kind of object, so a 32px mark
 * down the left edge would say nothing and cost the title 44px of a phone's
 * width — the "row of identical grey squares" the header redesign was called in
 * to remove. The branch glyph rides the title line instead, at the size and
 * weight `ThreadLine` gives it under a message.
 */
function ThreadRow({
  thread,
  onNavigate,
}: {
  thread: Channel;
  onNavigate: () => void;
}) {
  const state = threadUnreadState(thread);
  const title = channelDisplayName(thread);
  const mentions = thread.mention_count ?? 0;
  const lastMessageAt = thread.last_message_at;

  return (
    <li>
      <Link
        href={`/channels/${thread.uuid}`}
        onClick={onNavigate}
        className={cn(
          'v2-interactive flex items-start gap-3 px-4 py-3',
          'transition-colors duration-150 hover:bg-muted/60 motion-reduce:transition-none',
          FOCUS_RING,
        )}
      >
        {/* `div`s, not `span`s: `MetaLine` renders `div`s by contract and a
            `div` inside a `span` is invalid. An `a` accepts flow content, so
            the whole-row link still nests correctly. */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <GitBranch
              aria-hidden
              className="size-3.5 shrink-0 text-muted-foreground"
            />
            {/* A title runs to 120 chars server-side, so the whole of it lives
                in the tooltip when the row truncates — the same courtesy
                `ThreadLine` and `MyChannelRow` extend. */}
            <span
              title={title}
              className={cn('min-w-0 truncate text-sm', TITLE_TONE[state])}
            >
              {title}
            </span>
            {state === 'behind' && <UnreadDot />}
          </div>
          {/* Hung under the title, not under the glyph — 14px mark plus the
              1.5 gap is exactly 20px. */}
          <MetaLine
            className="mt-0.5 pl-5"
            lead={[
              followerLabel(thread.active_members_count),
              lastMessageAt === null ? 'No messages yet' : null,
            ]}
          />
        </div>

        {/* The trailing column never truncates — a mention badge is the one
            signal that must survive every other pressure on the row. */}
        <div className="flex shrink-0 items-center gap-2">
          {mentions > 0 && (
            <CountBadge
              count={mentions}
              label={`${mentions} unread ${mentions === 1 ? 'mention' : 'mentions'} in this thread`}
            />
          )}
          {lastMessageAt !== null && (
            <RelativeTime
              iso={lastMessageAt}
              className="text-xs tabular-nums text-muted-foreground"
            />
          )}
        </div>
      </Link>
    </li>
  );
}

function ThreadsSkeleton() {
  return (
    <div aria-hidden className="divide-y">
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={index}
          className="flex items-start gap-3 px-4 py-3"
          style={{ opacity: Math.max(0.3, 1 - index * 0.16) }}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/5 rounded" />
            <Skeleton className="ml-5 h-3 w-1/3 rounded" />
          </div>
          <Skeleton className="h-3 w-6 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
}
