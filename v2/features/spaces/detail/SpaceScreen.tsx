'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { extractApiError } from '@/lib/utils/api-error';
import { useMinuteNow } from '@/v2/features/channels/use-minute-now';
import { useCollabSpaceScope } from '@/v2/features/collab/shell/space-scope';
import { useV2Session } from '@/v2/runtime/session-context';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { InviteLinksPanel } from '@/v2/features/invites/InviteLinksPanel';
import { SpaceJoinRequestsPanel } from '@/v2/features/invites/JoinRequestsPanel';
import { SpaceFormDialog } from '../dialogs/SpaceFormDialog';
import { useDeleteSpace } from '../mutations';
import { SPACE_LOBBY_COLUMN, SPACE_LOBBY_GRID } from './lobby-parts';
import { SpacePlaceHeader } from './SpacePlaceHeader';
import {
  SpaceAboutBlock,
  SpaceActivityBlock,
  SpacePeopleBlock,
} from './SpaceLobbyBlocks';
import { useCachedSpaceIdentity } from './cached-identity';
import {
  SpaceAccessDeniedState,
  SpaceErrorState,
  SpaceScreenFrame,
} from './states';

/**
 * SpaceScreen — the `/spaces/{uuid}` LOBBY.
 *
 * ── IT STOPPED BEING A MENU ────────────────────────────────────────────────
 * It used to be a document header over a `divide-y` list of channels: heading,
 * hairline, list, and nothing else. Navigation now belongs to the persistent
 * `SpaceRail` (docked beside this pane, drawered on a phone), which frees this
 * page to be what a space's own page should be — an identity block, a digest of
 * what is happening in the rooms, the people, and the facts that place it.
 *
 * ── IT OWNS ALMOST NO DATA ─────────────────────────────────────────────────
 * The space, its channels, its roster and the reader's role all come from
 * `CollabFrame` through `useCollabSpaceScope()`. That is not a shortcut: the
 * frame has to hold them anyway for the rail, and one derivation of
 * `canManage` from every available source is the only version that cannot
 * drift from the rail's. It also means arriving here from a channel paints
 * from queries that never unmounted.
 *
 * What stays local is what is genuinely this page's: the edit dialog's URL
 * overlay, and the delete confirmation — which is DELIBERATELY NOT in the URL,
 * because a shareable, refresh-surviving link that re-opens "Delete this
 * space?" is an armed trigger, and this dialog carries the server's sentence
 * from the last failed attempt, which a restored URL cannot reproduce.
 */
export function SpaceScreen({ spaceUuid }: { spaceUuid: string }) {
  const scope = useCollabSpaceScope();
  /* What the spaces list already knew about this space — crest, kicker, name,
     description. It fills the frame below so the silhouette the route boundary
     drew does not empty itself out when the boundary is deleted and this screen
     takes over. Identity only: every ruling still waits for the detail. */
  const cachedIdentity = useCachedSpaceIdentity(spaceUuid);
  const session = useV2Session();
  const router = useRouter();
  const deleteSpace = useDeleteSpace(spaceUuid);
  // The shared minute clock, so the digest's ages stay true while the reader
  // sits here. `0` before hydration; the rows treat that as "no age yet".
  const now = useMinuteNow();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const space = scope?.space ?? null;
  const canManage = scope?.canManage ?? false;

  /**
   * The edit dialog is the ONE overlay this page still owns — creating a
   * channel and opening the roster moved to the frame, because they have to
   * work from the channel routes too.
   *
   * `canOpen` carries the same `canManage` the menu item is gated on, so a
   * copied `?panel=edit` link cannot hand a plain member the admin form. It is
   * `undefined` until the space lands: gating on a role that has not resolved
   * would strip a real admin's deep link before it could work.
   */
  const panel = useUrlOverlay('panel', {
    canOpen: space
      ? { edit: canManage, invites: canManage, requests: canManage }
      : undefined,
  });

  /**
   * NOTHING IS PUBLISHED TO `header-context` FROM HERE, deliberately. This page
   * used to set the space name as the shell header's title; the collab frame
   * one level up now publishes the whole place (crest, name, kicker) and
   * `V2Header` renders that INSTEAD of the generic title on these routes — so a
   * second publish could never be shown, and a write nothing can render is
   * exactly the kind of quiet dead code that outlives the reason for it.
   */

  // Defensive, and never expected: this page is a child of the `(collab)`
  // layout, which always provides the scope. Drawing the silhouette is the
  // honest answer if that ever stops being true — never a crash, never a lie.
  if (scope === null) return <SpaceScreenFrame identity={cachedIdentity} />;

  if (scope.isSpacePending) return <SpaceScreenFrame identity={cachedIdentity} />;

  if (scope.isSpaceError || space === null) {
    const status = scope.spaceErrorStatus ?? 0;
    return (
      <div className={SPACE_LOBBY_COLUMN}>
        {status === 403 || status === 404 ? (
          <SpaceAccessDeniedState />
        ) : (
          <SpaceErrorState
            message={
              status >= 400 && status < 500 ? scope.spaceErrorMessage : undefined
            }
            onRetry={scope.retrySpace}
          />
        )}
      </div>
    );
  }

  const handleDelete = () => {
    setDeleteError(null);
    deleteSpace.mutate(undefined, {
      onSuccess: () => {
        setDeleteOpen(false);
        router.push('/spaces');
      },
      onError: (error) => setDeleteError(extractApiError(error).message),
    });
  };

  return (
    <div className={SPACE_LOBBY_COLUMN}>
      <SpacePlaceHeader
        space={space}
        members={scope.members}
        canManage={canManage}
        isOwner={scope.isOwner}
        onCreateChannel={scope.openCreateChannel}
        onOpenRoster={scope.openRoster}
        onEdit={() => panel.show('edit')}
        onInvites={() => panel.show('invites')}
        onRequests={() => panel.show('requests')}
        onDelete={() => {
          setDeleteError(null);
          setDeleteOpen(true);
        }}
      />

      <div className={SPACE_LOBBY_GRID}>
        <SpaceActivityBlock
          sections={scope.sections}
          isPending={scope.isChannelsPending}
          isError={scope.isChannelsError}
          onRetry={scope.retryChannels}
          canCreate={canManage}
          onCreateChannel={scope.openCreateChannel}
          onOpenRail={scope.openRail}
          now={now}
        />

        <div className="flex min-w-0 flex-col gap-6">
          <SpacePeopleBlock
            space={space}
            members={scope.members}
            isPending={scope.isMembersPending}
            canManage={canManage}
            onOpenRoster={scope.openRoster}
          />
          <SpaceAboutBlock space={space} />
        </div>
      </div>

      {/* INVITE LINKS AND THE WAITING LIST — admin surfaces, on the same
          url-overlay mechanism as Edit so Back closes them (W1 rule). */}
      {/* BOTH SHEETS FILL A PHONE, and both have to say it in the variant shape:
          `SheetContent` sets `data-[side=right]:w-3/4`, and an attribute
          selector beats a bare `w-full` however late it is written. Left plain,
          these two admin queues opened at three quarters of the screen with the
          space page showing down one side (mobile overhaul, phase 7). */}
      <Sheet {...panel.bind('invites')}>
        <SheetContent
          side="right"
          className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>Invite by link</SheetTitle>
            <SheetDescription>
              Share a link with anybody. You decide who actually gets in.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <InviteLinksPanel spaceUuid={space.uuid} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet {...panel.bind('requests')}>
        <SheetContent
          side="right"
          className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>Waiting to join</SheetTitle>
            <SheetDescription>
              People who used a link that needs your approval.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <SpaceJoinRequestsPanel spaceUuid={space.uuid} />
          </div>
        </SheetContent>
      </Sheet>

      <SpaceFormDialog
        key={panel.keyFor('edit')}
        space={space}
        viewerId={session.userId}
        {...panel.bind('edit')}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          setDeleteOpen(next);
          if (!next) setDeleteError(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {space.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the space and every channel in it, for everyone. It
              can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSpace.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={deleteSpace.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSpace.isPending ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : null}
              Delete space
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
