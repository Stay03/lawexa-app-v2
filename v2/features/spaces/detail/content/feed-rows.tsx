'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  FileText,
  Folder,
  GitBranch,
  MessageSquare,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { Radar } from '@/v2/shell/icons/radar-icon';

import { cn, stripPastedTags } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { Channel, SpaceFile, SpaceItem } from '@/types/collab';
import type { ConversationListItem } from '@/types/chat';
import { channelVisibilityFace } from '@/lib/collab/visibility';
import { channelUnreadGrammar } from '@/v2/features/channels/model';
import { channelDisplayName, threadUnreadState } from '@/v2/features/channels/thread-model';
import {
  channelStatusCountsLine,
  knownThreadStatus,
  threadStatusLabel,
  waitsOnSomeoneElse,
} from '@/v2/features/channels/thread-status-model';
import { LastMessagePreview } from '@/v2/features/collab/kit/LastMessagePreview';
import { ThreadStatusDot } from '@/v2/features/collab/kit/ThreadStatusChip';
import { lastActivityAt } from '@/v2/features/conversations/activity';
import { rememberFolderPeek } from '@/v2/features/folders/folder-peek';
import { folderCountsLabel, type FolderRowModel } from '@/v2/features/folders/folder-row-model';
import { useV2Session } from '@/v2/runtime/session-context';
import { CountBadge, FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { MoveFirstLink } from '@/v2/shell/move-first';
import { fileTypeLabel } from '../../content-model';
import { reportRowModel } from '../radars/radar-rows';

/**
 * feed-rows — the rows of a space's one list (Stay picked version A, 17
 * October 2026, 22:19 UTC, after "wasted space on the right", "too cluttered"
 * at 19:11 UTC).
 *
 * EVERY KIND IS THE SAME ROW. A plain icon (no tile behind it), the name and
 * the time on the first line, and one quiet fact under it: the last message of
 * a chat, a channel or a thread ("Sender: text"), a file's type, size and
 * uploader, a folder's counts.
 *
 * THE TIME AND THE @YOU COUNT SHARE ONE EDGE (Stay, 18 October 2026, 01:50
 * UTC, after WhatsApp's list: "no weird look"). The time ends line 1 and the
 * count sits right under it, ending line 2. A thread's status is a dot and a
 * word after its name, and a channel's thread counts sit there too, so line 2
 * is free for what was last said.
 *
 * NO "…" ON A ROW (Stay, 18 October 2026, 10:46 UTC: the dots on the right
 * "create lack of uniformity"; the options belong in "the three dots on top
 * right of each page"). A chat's actions are in its page's ⋮, a folder's in
 * the folder page's, and a file's in the card its row opens (`SpaceFileCard`,
 * Stay, 18 October 2026, 12:50 UTC, option a), so every row's time and count
 * end at the same edge.
 *
 * A folder's time sits on its name line with its counts under it, one unit
 * like every other row (Arthur, 17 October 2026, item 5).
 */

/** What the feed decides for its rows: a file's card, a folder's model, a chat's byline. */
export interface FeedRowMenus {
  /** The space the feed lists: a Radar report's row links inside it. */
  spaceUuid: string;
  /** Opens the file's card (its name, "Open file" and its ⋮), hung from the tapped row on a computer. */
  openFile: (file: SpaceFile, row: HTMLElement) => void;
  folderRow: (entry: Extract<SpaceItem, { type: 'folder' }>) => FolderRowModel;
  byline: (item: ConversationListItem) => string;
  /**
   * The space's files are being ticked (bulk select): a file's row is its tick box
   * and a tap ticks it instead of opening its card.
   */
  fileSelect?: { isSelected: (id: number) => boolean; toggle: (id: number) => void };
}

interface LineModel {
  icon: LucideIcon;
  /** Gold icon: something new here for the reader. */
  warm?: boolean;
  title: string;
  /** Unread: the name in semibold. */
  strong?: boolean;
  /** Muted ink: a thread the reader does not follow, a Closed one, an unnamed folder. */
  quiet?: boolean;
  /** After the name on line 1: a thread's status, a channel's thread counts. */
  status?: ReactNode;
  /** The second line. */
  meta?: ReactNode;
  time: string;
  /** The @you count, under the time. */
  mentions?: number;
  /** Another count in the same place, with its own words for a screen
   *  reader: a Radar's unread reports. */
  count?: { value: number; label: string };
}

const BODY = cn(
  'group v2-interactive flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left',
  'transition-colors duration-150 hover:bg-secondary/50 motion-reduce:transition-none',
  FOCUS_RING,
);

/** The feed's one row, for any list in a space that reads like the feed
 *  (the Radars pill's rows). */
export function FeedLine({
  line,
  render,
}: {
  line: LineModel;
  /** The row's open control (a link, a move-first link, a button) around its content. */
  render: (className: string, content: ReactNode) => ReactNode;
}) {
  const Icon = line.icon;
  const mentions = line.mentions ?? 0;
  const count = line.count && line.count.value > 0 ? line.count : null;
  const content = (
    <>
      <Icon
        aria-hidden
        className={cn(
          'size-5 shrink-0',
          line.warm ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span
            title={line.title}
            className={cn(
              'min-w-0 truncate text-sm',
              line.strong ? 'font-semibold' : 'font-medium',
              line.quiet ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {line.title}
          </span>
          {line.status ? (
            <span className="flex max-w-[55%] shrink-0 items-center text-xs text-muted-foreground">{line.status}</span>
          ) : null}
          {line.time ? (
            <span className="ml-auto shrink-0 pl-1 text-xs tabular-nums text-muted-foreground">{line.time}</span>
          ) : null}
        </span>
        {line.meta || mentions > 0 || count ? (
          <span className="mt-0.5 flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{line.meta}</span>
            {mentions > 0 ? (
              <CountBadge
                count={mentions}
                label={`${mentions} unread ${mentions === 1 ? 'mention' : 'mentions'} in ${line.title}`}
              />
            ) : count ? (
              <CountBadge count={count.value} label={count.label} />
            ) : null}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <li className="flex min-w-0">{render(BODY, content)}</li>
  );
}

/** A thread's status after its name, "● Working": the dot and the word. */
function ThreadStatus({ thread }: { thread: Channel }) {
  const status = knownThreadStatus(thread.status);
  const { userUuid } = useV2Session();
  if (!status) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <ThreadStatusDot
        value={status.value}
        outline={waitsOnSomeoneElse(status, userUuid)}
      />
      <span className="truncate">{threadStatusLabel(status.value)}</span>
    </span>
  );
}

/**
 * A room's second line: what was last said, "Sender: text". The feed carries
 * it on thread rows, and on channel rows once the backend loads it there
 * (18 October 2026); it is optional on both (the resource withholds it on a
 * metadata-only read). Without it a channel says what it is for, and an empty
 * room says so.
 */
function roomLastLine(room: Channel, fallback: string | null): ReactNode {
  if (room.last_message) return <LastMessagePreview preview={room.last_message} />;
  return fallback ?? 'No messages yet';
}

function roomLink(href: string) {
  return function renderRoomLink(className: string, content: ReactNode) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  };
}

/**
 * A file's row opens its card (`SpaceFileCard`): the open itself, with its
 * "Couldn't open it" and "no longer available", and the file's actions live
 * there, so the row is one plain button like every other row's one link.
 */
function FeedFileRow({ file, now, menus }: { file: SpaceFile; now: number; menus: FeedRowMenus }) {
  const select = menus.fileSelect;
  return (
    <FeedLine
      line={{
        icon: FileText,
        title: file.original_name,
        // The type and size hold their width; only the uploader's name
        // truncates on a phone (design round 2).
        meta: (
          <span className="flex min-w-0 gap-1">
            <span className="shrink-0">
              {fileTypeLabel(file)} · {formatBytes(file.size)} ·
            </span>
            <span className="min-w-0 truncate">{file.uploader.name}</span>
          </span>
        ),
        time: formatRelativeTime(file.created_at, now),
      }}
      render={(className, content) =>
        select ? (
          <label className={cn(className, 'cursor-pointer', select.isSelected(file.id) && 'bg-secondary/60')}>
            <Checkbox
              checked={select.isSelected(file.id)}
              onCheckedChange={() => select.toggle(file.id)}
              aria-label={`Select ${file.original_name}`}
              className="shrink-0"
            />
            {content}
          </label>
        ) : (
          <button type="button" onClick={(event) => menus.openFile(file, event.currentTarget)} aria-haspopup="dialog" className={className}>
            {content}
          </button>
        )
      }
    />
  );
}

/** One row of the feed, for any kind. */
export function renderFeedRow({
  entry,
  now,
  menus,
  key,
}: {
  entry: SpaceItem;
  now: number;
  menus: FeedRowMenus;
  key: string;
}): ReactNode {
  switch (entry.type) {
    case 'conversation': {
      const conversation = entry.item;
      const title = stripPastedTags(conversation.title);
      return (
        <FeedLine
          key={key}
          line={{
            icon: conversation.is_confidential ? ShieldCheck : MessageSquare,
            title,
            meta: conversation.is_confidential ? 'Confidential' : menus.byline(conversation),
            time: formatRelativeTime(lastActivityAt(conversation), now),
          }}
          render={(className, content) => (
            <MoveFirstLink
              href={`/c/${conversation.id}`}
              kind="conversation"
              title={title}
              header={{ title, confidential: Boolean(conversation.is_confidential) }}
              headerOwner={conversation.id}
              className={className}
            >
              {content}
            </MoveFirstLink>
          )}
        />
      );
    }
    case 'file':
      return <FeedFileRow key={key} file={entry.item} now={now} menus={menus} />;
    case 'folder': {
      const row = menus.folderRow(entry);
      return (
        <FeedLine
          key={key}
          line={{
            icon: Folder,
            title: row.name,
            quiet: !row.hasName,
            meta: folderCountsLabel(row.itemsCount, row.childrenCount),
            time: formatRelativeTime(row.trailAt, now),
          }}
          // The folder page draws this row's name at once, before any request
          // answers (`folder-peek.ts`, speed step 5).
          render={(className, content) => (
            <Link href={row.href} onClick={() => rememberFolderPeek(row)} className={className}>
              {content}
            </Link>
          )}
        />
      );
    }
    case 'channel': {
      const channel = entry.item;
      const grammar = channelUnreadGrammar(channel);
      return (
        <FeedLine
          key={key}
          line={{
            icon: channelVisibilityFace(channel.visibility).icon,
            warm: grammar.unread || grammar.mentions > 0,
            title: channel.name,
            strong: grammar.unread,
            // A muted channel reads quiet; its @you count stays loud under the
            // time (a mute never hides a direct mention).
            quiet: grammar.muted,
            // Its threads that need someone sit after its name, so line 2 is
            // free for what was last said.
            status: channelStatusCountsLine(channel.thread_status_counts) ?? undefined,
            meta: roomLastLine(channel, channel.description?.trim() || null),
            time: now > 0 ? formatRelativeTime(channel.last_message_at ?? channel.created_at, now) : '',
            mentions: grammar.mentions,
          }}
          render={roomLink(`/channels/${channel.uuid}`)}
        />
      );
    }
    case 'radar_report': {
      const row = reportRowModel(entry.item, menus.spaceUuid, now);
      return (
        <FeedLine
          key={key}
          line={{
            icon: Radar,
            // Unread by this reader: gold and semibold, as an unread room reads.
            warm: row.unread,
            strong: row.unread,
            title: row.title,
            meta: row.meta,
            time: row.time,
          }}
          render={roomLink(row.href)}
        />
      );
    }
    case 'thread': {
      const thread = entry.item;
      const grammar = channelUnreadGrammar(thread);
      const state = threadUnreadState(thread);
      const behind = state === 'behind' && !grammar.muted;
      return (
        <FeedLine
          key={key}
          line={{
            icon: GitBranch,
            warm: behind || grammar.mentions > 0,
            title: channelDisplayName(thread),
            strong: behind,
            quiet: state === 'none' || grammar.muted || knownThreadStatus(thread.status)?.value === 'closed',
            status: <ThreadStatus thread={thread} />,
            meta: roomLastLine(thread, null),
            time: now > 0 ? formatRelativeTime(thread.last_message_at ?? thread.created_at, now) : '',
            mentions: grammar.mentions,
          }}
          render={roomLink(`/channels/${thread.uuid}`)}
        />
      );
    }
  }
}
