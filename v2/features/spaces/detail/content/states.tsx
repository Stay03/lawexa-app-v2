'use client';

import { Folder, MessageSquare, Paperclip, type LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { FileMarkSkeleton } from '@/v2/features/channels/files/FileMark';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import {
  ConversationsListSkeleton,
  NextPageSkeleton as ConversationsNextPageSkeleton,
} from '@/v2/features/conversations/list/states';
import {
  FoldersListSkeleton,
  FoldersNextPageSkeleton,
} from '@/v2/features/folders/list/states';
import type { SpaceTab } from '../../model';

/**
 * The states of a space's three content tabs (Spaces F2, 11 October 2026):
 * Chats, Folders, Files. Each tab draws the skeleton of the row it is about
 * to show, so the swap is content resolving rather than a layout change; the
 * chats and folders skeletons ARE the source lists' own, because the rows are
 * the source lists' own.
 *
 * EMPTY IS NOT A FAILURE, AND NEITHER OFFERS AN ACTION YET. Adding to a space
 * (start a chat, upload a file, make a folder, move something in) arrives in
 * F3 and F4; until then an empty tab says, in plain words, what will appear
 * there and who puts it there. A failure keeps its retry.
 */

/** The tabs that list contents; `channels` is the lobby and has its own. */
export type SpaceContentTab = Exclude<SpaceTab, 'channels'>;

/** One row at `SpaceFileRow`'s exact geometry: mark, name, meta, the button. */
function FileRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-2.5">
      <FileMarkSkeleton />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5 rounded" />
        <Skeleton className="h-3 w-32 max-w-[60%] rounded" />
      </div>
      <Skeleton className="size-8 shrink-0 rounded-md" />
    </div>
  );
}

function FilesListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.14) }}>
          <FileRowSkeleton />
        </div>
      ))}
    </div>
  );
}

function FilesNextPageSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <FileRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <FileRowSkeleton />
      </div>
    </div>
  );
}

/** The first load of a content tab: rows at the real geometry. */
export function SpaceContentSkeleton({ tab }: { tab: SpaceContentTab }) {
  switch (tab) {
    case 'chats':
      return <ConversationsListSkeleton rows={6} />;
    case 'folders':
      return <FoldersListSkeleton />;
    case 'files':
      return <FilesListSkeleton />;
  }
}

/** The next page in flight, at the sentinel. */
export function SpaceContentNextPageSkeleton({ tab }: { tab: SpaceContentTab }) {
  switch (tab) {
    case 'chats':
      return <ConversationsNextPageSkeleton />;
    case 'folders':
      return <FoldersNextPageSkeleton />;
    case 'files':
      return <FilesNextPageSkeleton />;
  }
}

const EMPTY: Readonly<
  Record<SpaceContentTab, { icon: LucideIcon; title: string; description: string }>
> = {
  chats: {
    icon: MessageSquare,
    title: 'No chats in this space yet',
    description: 'Chats that members add to this space show up here, for everyone in it to read.',
  },
  folders: {
    icon: Folder,
    title: 'No folders in this space yet',
    description: 'Folders that members add to this space show up here, for everyone in it to open.',
  },
  files: {
    icon: Paperclip,
    title: 'No files in this space yet',
    description: 'Files that members add to this space show up here, for everyone in it to open.',
  },
};

export function SpaceContentEmptyState({ tab }: { tab: SpaceContentTab }) {
  const { icon, title, description } = EMPTY[tab];
  return <CollabEmpty icon={icon} title={title} description={description} />;
}

const FAILURE_TITLE: Readonly<Record<SpaceContentTab, string>> = {
  chats: 'Couldn’t load the chats',
  folders: 'Couldn’t load the folders',
  files: 'Couldn’t load the files',
};

/**
 * The tab's list failed with nothing loaded: the PANEL, because the tab has
 * nothing else to show. `message` is the server's own sentence for a 4xx it
 * explained; anything else gets the designed one.
 */
export function SpaceContentErrorState({
  tab,
  message,
  onRetry,
}: {
  tab: SpaceContentTab;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <CollabFailure
      presentation="panel"
      title={FAILURE_TITLE[tab]}
      message={message?.trim() || 'Something went wrong on our side. Please try again.'}
      onRetry={onRetry}
    />
  );
}

/** A later page failed while earlier rows are on screen: the STRIP, under the
 *  rows, so what loaded stays readable. */
export function SpaceContentMoreErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <CollabFailure
      className="mt-2"
      message="Couldn’t load the rest of this list."
      onRetry={onRetry}
    />
  );
}
