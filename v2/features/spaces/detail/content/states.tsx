'use client';

import type { ReactNode } from 'react';
import {
  Folder,
  MessageSquare,
  Paperclip,
  SearchX,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { spaceEmptyCopy, type SpaceContentTab } from '../../content-model';

/**
 * The states of a space's three content tabs (Spaces F2, 11 October 2026):
 * Chats, Folders, Files. Each tab draws the skeleton of the row it is about
 * to show, so the swap is content resolving rather than a layout change; the
 * chats and folders skeletons ARE the source lists' own, because the rows are
 * the source lists' own.
 *
 * EMPTY IS NOT A FAILURE, AND IT SAYS WHAT COMES NEXT (Spaces F3; design
 * rounds 0 and 1, 12 October 2026). An Owner or Contributor reads how the tab
 * gets filled, with the way to add right under it (the host passes it as
 * `action`). A Viewer cannot add, so they read who fills the tab instead, and
 * get no button. Stay's two lines are in the space's header now, so they are
 * not repeated here. The words are `spaceEmptyCopy`'s, where the tests pin
 * them. A failure keeps its retry.
 *
 * AN OWNER ALONE IN THE SPACE IS OFFERED PEOPLE (design round 1). With nobody
 * else in it, "shared with everyone in this space" shares with no one, and
 * the only way to invite was a single face to tap. `onInvite` adds a quiet
 * "Invite people" under the add action, straight into the invite dialog.
 */

export type { SpaceContentTab };

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

const EMPTY_ICON: Readonly<Record<SpaceContentTab, LucideIcon>> = {
  chats: MessageSquare,
  folders: Folder,
  files: Paperclip,
};

/** A tab with nothing in it. `action` is the way to add, passed only for a
 *  viewer who may add; `onInvite` only for an Owner alone in the space (see
 *  the docblock). */
export function SpaceContentEmptyState({
  tab,
  canAdd,
  action,
  onInvite,
}: {
  tab: SpaceContentTab;
  canAdd: boolean;
  action?: ReactNode;
  onInvite?: () => void;
}) {
  const { title, description } = spaceEmptyCopy(tab, canAdd);
  return (
    <CollabEmpty
      icon={EMPTY_ICON[tab]}
      title={title}
      description={description}
      action={canAdd ? action : undefined}
      footnote={
        onInvite ? (
          <Button type="button" variant="outline" size="sm" onClick={onInvite}>
            <UserPlus aria-hidden className="size-4" />
            Invite people
          </Button>
        ) : undefined
      }
    />
  );
}

/** A search that found nothing: says so, and offers the way back. */
export function SpaceContentNoMatchState({
  query,
  action,
}: {
  query: string;
  /** The clear-search control. */
  action: ReactNode;
}) {
  return (
    <CollabEmpty
      icon={SearchX}
      title={`Nothing matches “${query}”`}
      description="Try another word, or clear the search to see everything here."
      action={action}
    />
  );
}

/** A folder level with no folders inside it. Its items (cases, notes, files
 *  filed in it) live on the folder's own page, which `action` opens. */
export function SpaceFolderLevelEmptyState({ action }: { action: ReactNode }) {
  return (
    <CollabEmpty
      icon={Folder}
      title="No folders inside"
      description="What is filed in this folder is on its own page."
      action={action}
    />
  );
}

const FAILURE_TITLE: Readonly<Record<SpaceContentTab, string>> = {
  chats: 'Couldn’t load the conversations',
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
