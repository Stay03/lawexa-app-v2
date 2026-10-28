'use client';

import type { ReactNode } from 'react';
import {
  Folder,
  LayoutList,
  MessageSquare,
  SearchX,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { Skeleton } from '@/components/ui/skeleton';
import { spaceEmptyCopy, type SpaceContentTab } from '../../content-model';

/**
 * The states of a space home's list (Spaces F2, 11 October 2026; one list
 * since B4, 17 October 2026): All, Conversations, Files, Folders.
 *
 * ONE SKELETON FOR EVERY PILL. Every kind is the same row (`feed-rows`), so
 * the skeleton is that row: the 20px icon, the name and time over the meta
 * line, and the 36px right column. The swap is content resolving rather than
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

/** Every pill that is a list with these states: the feed's, Radars and Tasks. */
export type SpaceListTab = SpaceContentTab | 'radars' | 'tasks';

/** One feed row at its real geometry (`feed-rows`' `Line`; no row has a menu column). */
function FeedRowSkeleton() {
  return (
    <div className="flex min-w-0">
      <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
        <Skeleton className="size-5 shrink-0 rounded" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-1/2 rounded" />
            <Skeleton className="ml-auto h-3 w-8 shrink-0 rounded" />
          </div>
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
      </div>
    </div>
  );
}

/** The first load of the list, fading down the stack like the other lists. */
export function SpaceContentSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.12) }}>
          <FeedRowSkeleton />
        </div>
      ))}
    </div>
  );
}

/** The next page in flight, at the sentinel. */
export function SpaceContentNextPageSkeleton() {
  return (
    <div aria-hidden className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <FeedRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <FeedRowSkeleton />
      </div>
    </div>
  );
}

const EMPTY_ICON: Readonly<Record<SpaceContentTab, LucideIcon>> = {
  all: LayoutList,
  conversations: MessageSquare,
  folders: Folder,
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

const FAILURE_TITLE: Readonly<Record<SpaceListTab, string>> = {
  all: 'Couldn’t load this space',
  conversations: 'Couldn’t load the conversations',
  folders: 'Couldn’t load the folders',
  radars: 'Couldn’t load the Radars',
  tasks: 'Couldn’t load the tasks',
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
  tab: SpaceListTab;
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
