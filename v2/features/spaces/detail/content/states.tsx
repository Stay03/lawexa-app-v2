'use client';

import type { ReactNode } from 'react';
import {
  Folder,
  LayoutList,
  MessageSquare,
  Paperclip,
  SearchX,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import {
  ConversationsListSkeleton,
  NextPageSkeleton as ConversationsNextPageSkeleton,
} from '@/v2/features/conversations/list/states';
import { spaceEmptyCopy, type SpaceContentTab } from '../../content-model';

/**
 * The states of a space home's list (Spaces F2, 11 October 2026; one list
 * since B4, 17 October 2026): All, Conversations, Files, Folders.
 *
 * ONE SKELETON FOR EVERY PILL. The three rows share the conversation row's box
 * in the list (`ConversationRow`; `SpaceFileRow`; `FolderRow` with
 * `layout="feed"`), so the conversations list's own skeleton is the geometry
 * of whatever is about to land, and the swap is content resolving rather than
 * a layout change.
 *
 * EMPTY IS NOT A FAILURE, AND IT SAYS WHAT COMES NEXT (Spaces F3; design
 * rounds 0 and 1, 12 October 2026). An Owner or Contributor reads how the
 * list gets filled, with the way to add right under it (the host passes it as
 * `action`). A Viewer cannot add, so they read who fills it instead, and get
 * no button. The words are `spaceEmptyCopy`'s, where the tests pin them. A
 * failure keeps its retry.
 *
 * AN OWNER ALONE IN THE SPACE IS OFFERED PEOPLE (design round 1). With nobody
 * else in it, "shared with everyone in this space" shares with no one.
 * `onInvite` adds a quiet "Invite people" under the add action, straight into
 * the invite dialog.
 */

export type { SpaceContentTab };

/** The first load of the list: rows at the real geometry. */
export function SpaceContentSkeleton() {
  return <ConversationsListSkeleton rows={6} />;
}

/** The next page in flight, at the sentinel. */
export function SpaceContentNextPageSkeleton() {
  return <ConversationsNextPageSkeleton />;
}

const EMPTY_ICON: Readonly<Record<SpaceContentTab, LucideIcon>> = {
  all: LayoutList,
  conversations: MessageSquare,
  folders: Folder,
  files: Paperclip,
};

/** A pill with nothing in it. `action` is the way to add, passed only for a
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

const FAILURE_TITLE: Readonly<Record<SpaceContentTab, string>> = {
  all: 'Couldn’t load this space',
  conversations: 'Couldn’t load the conversations',
  folders: 'Couldn’t load the folders',
  files: 'Couldn’t load the files',
};

/**
 * The list failed with nothing loaded: the PANEL, because the pill has
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
