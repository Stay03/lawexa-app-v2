'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  FileText,
  Folder,
  GitBranch,
  Loader2,
  MessageSquare,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { Channel, SpaceFile, SpaceItem } from '@/types/collab';
import type { ConversationListItem } from '@/types/chat';
import { channelVisibilityFace } from '@/lib/collab/visibility';
import { channelUnreadGrammar } from '@/v2/features/channels/model';
import { useOpenFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { channelDisplayName, threadUnreadState } from '@/v2/features/channels/thread-model';
import {
  channelStatusCountsLine,
  knownThreadStatus,
  threadStatusLabel,
} from '@/v2/features/channels/thread-status-model';
import { LastMessagePreview } from '@/v2/features/collab/kit/LastMessagePreview';
import { ThreadStatusDot } from '@/v2/features/collab/kit/ThreadStatusChip';
import { lastActivityAt } from '@/v2/features/conversations/activity';
import {
  ConversationRowMenu,
  type ConversationMenuAction,
} from '@/v2/features/conversations/list/ConversationRow';
import { FolderActionsMenu } from '@/v2/features/folders/FolderActionsMenu';
import { rememberFolderPeek } from '@/v2/features/folders/folder-peek';
import { folderCountsLabel, type FolderRowModel } from '@/v2/features/folders/folder-row-model';
import { CountBadge, FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { MoveFirstLink } from '@/v2/shell/move-first';
import { fileTypeLabel } from '../../content-model';
import { SpaceFileMenu } from './SpaceFileMenu';

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
 * ONE RIGHT COLUMN OF THE SAME WIDTH ON EVERY ROW, for the "…" of a chat, a
 * file or a folder. A room has no menu and keeps the column empty, so every
 * row's time and count end at the same edge.
 *
 * A folder's time sits on its name line with its counts under it, one unit
 * like every other row (Arthur, 17 October 2026, item 5).
 */

/** What each row's menu holds, decided by the feed (the live rows' own rules). */
export interface FeedRowMenus {
  conversation: (item: ConversationListItem) => readonly ConversationMenuAction[];
  folder: (entry: Extract<SpaceItem, { type: 'folder' }>) => {
    onRename?: (row: FolderRowModel) => void;
    onMove?: (row: FolderRowModel) => void;
    onRemoveFromSpace?: (row: FolderRowModel) => void;
  };
  file: (file: SpaceFile) => {
    onMove?: (file: SpaceFile) => void;
    onRemoveFromSpace?: (file: SpaceFile) => void;
    onCopyToMine?: (file: SpaceFile) => void;
    onDelete?: (file: SpaceFile) => void;
  };
  folderRow: (entry: Extract<SpaceItem, { type: 'folder' }>) => FolderRowModel;
  byline: (item: ConversationListItem) => string;
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
  menu?: ReactNode;
  /** The icon turns: a file opening. */
  busy?: boolean;
  /** A line under the row, indented to the name: a file's failed open. */
  note?: ReactNode;
}

const BODY = cn(
  'group v2-interactive flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left',
  'transition-colors duration-150 hover:bg-secondary/50 motion-reduce:transition-none',
  FOCUS_RING,
);

function Line({
  line,
  render,
}: {
  line: LineModel;
  /** The row's open control (a link, a move-first link, a button) around its content. */
  render: (className: string, content: ReactNode) => ReactNode;
}) {
  const Icon = line.icon;
  const mentions = line.mentions ?? 0;
  const content = (
    <>
      <Icon
        aria-hidden
        className={cn(
          'size-5 shrink-0',
          line.busy && 'animate-spin',
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
        {line.meta || mentions > 0 ? (
          <span className="mt-0.5 flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{line.meta}</span>
            {mentions > 0 ? (
              <CountBadge
                count={mentions}
                label={`${mentions} unread ${mentions === 1 ? 'mention' : 'mentions'} in ${line.title}`}
              />
            ) : null}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <li>
      <div className="flex min-w-0 items-center gap-1">
        {render(BODY, content)}
        {/* The one right column: the "…" menu, or empty on a room. */}
        <span className="flex size-9 shrink-0 items-center justify-center">{line.menu ?? null}</span>
      </div>
      {/* Indented to the name: the body's px-3, the 20px icon and its gap-3. */}
      {line.note ? <div className="pb-1 pl-11 text-[11px] text-muted-foreground">{line.note}</div> : null}
    </li>
  );
}

/** A thread's status after its name, "● Working": the dot and the word. */
function ThreadStatus({ thread }: { thread: Channel }) {
  const status = knownThreadStatus(thread.status);
  if (!status) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <ThreadStatusDot value={status.value} />
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
 * A file opens through the tap-first opener (`useOpenFileInNewTab`), which
 * reports only a real refusal (`failed`) or a file that no longer exists
 * (`gone`, a 404). A gone file has nothing to open, so its body is plain text
 * and says so; a refused open offers a fresh tap, which an engine that refused
 * the first one will honour.
 */
function FeedFileRow({ file, now, menus }: { file: SpaceFile; now: number; menus: FeedRowMenus }) {
  // Per row: one opener shared by the list would turn every row's icon at once.
  const { open, opening, failed, gone } = useOpenFileInNewTab();
  return (
    <Line
      line={{
        icon: opening ? Loader2 : FileText,
        busy: opening,
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
        menu: <SpaceFileMenu file={file} {...menus.file(file)} />,
        note: gone ? (
          <p role="status">This file is no longer available.</p>
        ) : failed ? (
          <p role="status" className="flex items-center gap-2">
            <span>Couldn&rsquo;t open it.</span>
            <button
              type="button"
              onClick={() => open(file.id)}
              className={cn('rounded font-medium text-foreground underline underline-offset-2', FOCUS_RING)}
            >
              Try again
            </button>
          </p>
        ) : null,
      }}
      render={(className, content) =>
        gone ? (
          <div className={className}>{content}</div>
        ) : (
          <button
            type="button"
            onClick={() => open(file.id)}
            disabled={opening}
            className={cn(className, 'disabled:cursor-progress')}
          >
            <span className="sr-only">Open </span>
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
      const actions = menus.conversation(conversation);
      return (
        <Line
          key={key}
          line={{
            icon: conversation.is_confidential ? ShieldCheck : MessageSquare,
            title,
            meta: conversation.is_confidential ? 'Confidential' : menus.byline(conversation),
            time: formatRelativeTime(lastActivityAt(conversation), now),
            menu: actions.length > 0 && !conversation.is_confidential ? <ConversationRowMenu title={title} actions={actions} /> : null,
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
      const { onRename, onMove, onRemoveFromSpace } = menus.folder(entry);
      return (
        <Line
          key={key}
          line={{
            icon: Folder,
            title: row.name,
            quiet: !row.hasName,
            meta: folderCountsLabel(row.itemsCount, row.childrenCount),
            time: formatRelativeTime(row.trailAt, now),
            menu:
              onRename || onMove || onRemoveFromSpace ? (
                <FolderActionsMenu
                  folder={{ uuid: row.uuid, name: row.name, itemsCount: row.itemsCount, childrenCount: row.childrenCount }}
                  onRename={onRename ? () => onRename(row) : undefined}
                  onMove={onMove ? () => onMove(row) : undefined}
                  onRemoveFromSpace={onRemoveFromSpace ? () => onRemoveFromSpace(row) : undefined}
                  moveLabel="Change space"
                />
              ) : null,
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
        <Line
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
    case 'thread': {
      const thread = entry.item;
      const grammar = channelUnreadGrammar(thread);
      const state = threadUnreadState(thread);
      const behind = state === 'behind' && !grammar.muted;
      return (
        <Line
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
