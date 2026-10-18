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
 * a chat, a file's type, size and uploader, a folder's counts, a channel's
 * threads that need someone, a thread's status word and its channel.
 *
 * ONE RIGHT COLUMN OF THE SAME WIDTH ON EVERY ROW. A chat, file or folder puts
 * its "…" there; a channel or thread puts its mention count there, or leaves
 * it empty. So every row's text ends at the same edge: the empty strip Stay saw
 * beside the channel and thread rows is gone.
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
  /** The second line. */
  meta?: ReactNode;
  time: string;
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
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            title={line.title}
            className={cn(
              'min-w-0 flex-1 truncate text-sm',
              line.strong ? 'font-semibold' : 'font-medium',
              line.quiet ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {line.title}
          </span>
          {line.time ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{line.time}</span>
          ) : null}
        </span>
        {line.meta ? (
          <span className="mt-0.5 block min-w-0 truncate text-xs text-muted-foreground">{line.meta}</span>
        ) : null}
      </span>
    </>
  );

  return (
    <li>
      <div className="flex min-w-0 items-center gap-1">
        {render(BODY, content)}
        {/* The one right column: the menu, else the mention count, else empty. */}
        <span className="flex size-9 shrink-0 items-center justify-center">
          {line.menu ??
            ((line.mentions ?? 0) > 0 ? (
              <CountBadge
                count={line.mentions ?? 0}
                label={`${line.mentions} unread ${line.mentions === 1 ? 'mention' : 'mentions'} in ${line.title}`}
              />
            ) : null)}
        </span>
      </div>
      {/* Indented to the name: the body's px-3, the 20px icon and its gap-3. */}
      {line.note ? <div className="pb-1 pl-11 text-[11px] text-muted-foreground">{line.note}</div> : null}
    </li>
  );
}

/** A thread's second line, "● Needs Action · #general". */
function ThreadMeta({ thread }: { thread: Channel }) {
  const status = knownThreadStatus(thread.status);
  const parent = thread.parent_channel_name?.trim();
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      {status ? (
        <>
          <ThreadStatusDot value={status.value} />
          <span className="shrink-0">{threadStatusLabel(status.value)}</span>
        </>
      ) : null}
      {status && parent ? <span aria-hidden className="text-muted-foreground/50">·</span> : null}
      {parent ? <span className="min-w-0 truncate">#{parent}</span> : null}
    </span>
  );
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
            // A muted channel reads quiet; its @you count stays loud in the
            // right column (a mute never hides a direct mention).
            quiet: grammar.muted,
            meta: channelStatusCountsLine(channel.thread_status_counts) ?? channel.description ?? null,
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
            meta: <ThreadMeta thread={thread} />,
            time: now > 0 ? formatRelativeTime(thread.last_message_at ?? thread.created_at, now) : '',
            mentions: grammar.mentions,
          }}
          render={roomLink(`/channels/${thread.uuid}`)}
        />
      );
    }
  }
}
