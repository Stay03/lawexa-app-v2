'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Link2, Loader2, Pencil, Trash2, UserPlus } from 'lucide-react';

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
import { channelsQueries } from '@/v2/features/channels/queries';
import { useMinuteNow } from '@/v2/features/channels/use-minute-now';
import { collabAccessState } from '@/v2/features/collab/model';
import { useCollabSpaceScope } from '@/v2/features/collab/shell/space-scope';
import { useV2Session } from '@/v2/runtime/session-context';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import {
  clearScreenContext,
  setScreenContext,
  type ScreenAction,
} from '@/v2/shell/screen-context';
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
import { NO_SPACE_THREADS } from './activity-digest';
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
/** Stable empty reference — a fresh `[]` per render would churn the publish. */
const NO_SCREEN_ACTIONS: readonly ScreenAction[] = [];

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
   * ── THE SPACE'S THREADS, THE LOBBY'S OWN READ ─────────────────────────────
   * The one query this page mounts that the frame does not, and the reason is
   * that nothing else wants it: the rail and the drawer are channels-only by
   * design, so holding this in `CollabFrame` would make every channel route pay
   * for a list only the lobby draws.
   *
   * GATED EXACTLY AS `CollabFrame` GATES `channelsQueries.bySpace` ON THIS
   * ROUTE, and for the same two reasons. `eligible` because an unverified or
   * out-of-audience account's collab reads are refused by the door before the
   * network is worth spending (`collab/model.ts`). And it waits for the SPACE to
   * have succeeded, which `space !== null` is exactly: `spaceQuery.data` is the
   * only thing that fills it, and a 403 there means the reader is not a member,
   * so the blocked read must not be requested. There is no parallel-fetch case
   * to give up here, unlike on the channel route: this screen only exists at
   * `/spaces/{uuid}`.
   *
   * `per_page: 50`, THE SAME PAGE THE CHANNEL LIST ASKS FOR, and the size is
   * about ranking rather than about drawing. The digest paints six rows, so a
   * bigger page buys nothing to draw; what it buys is a truer FIRST six. An
   * unread thread sorts into the unread tier however old it is, and a thread
   * that fell off the page cannot be ranked at all - so a short page is exactly
   * how the mention this block exists to explain would go missing again. Both
   * halves of one merged list are therefore cut off at the same depth, and the
   * heading's "N threads" is a page count in the same way "N channels" already
   * is.
   */
  const eligible = collabAccessState(session) === 'eligible';
  const threadsQuery = useQuery({
    ...channelsQueries.threadsBySpace({
      spaceUuid,
      viewerId: session.userId,
      per_page: 50,
    }),
    enabled: eligible && space !== null,
  });
  /* The frozen empty default while the list is pending, refused or ungated:
     a fresh `[]` here would give `SpaceActivityBlock`'s digest memo a new
     dependency on every render and re-rank the whole list for nothing. */
  const threads = threadsQuery.data?.data ?? NO_SPACE_THREADS;

  /* ONE DIGEST, SO ONE PENDING STATE AND ONE ERROR STATE. The block ranks
     channels and threads into a single list, so painting it while half of it is
     still in flight would show a ranking that is wrong: the thread that should
     be the first row arriving fourth, a beat later, under the reader's finger.
     The two requests are fired together and run in parallel, so the wait is the
     slower of them and not the sum. The retry is likewise both, because the
     panel says "try again" about the list and the list has two halves. */
  const retryChannels = scope?.retryChannels;
  const refetchThreads = threadsQuery.refetch;
  const retryActivity = useCallback(() => {
    retryChannels?.();
    void refetchThreads();
  }, [retryChannels, refetchThreads]);

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

  /**
   * ── THE SPACE'S OWN VERBS GO TO THE BAR'S ONE MENU (phase 7) ─────────────
   *
   * They were a kebab at y183, in the lobby's header block, under a shell bar
   * that already had one at the top right. On a 390px phone that screen spent
   * 225px on chrome before the first word and offered three ways out and two
   * overflow menus. `screen-context.ts` folds these four rows into the bar's
   * single menu, above a separator, and `SpacePlaceHeader` lost its trigger.
   *
   * THE ROWS FOLLOW THE SAME RULES THEY ALWAYS DID: nothing at all for a reader
   * who cannot manage the space (a menu that only 403s is worse than none), and
   * Delete for the OWNER only. `panel`'s own `canOpen` map is the second gate,
   * so a copied `?panel=edit` still cannot hand a plain member the admin form.
   *
   * Every callback is `useCallback`-stable, which is what makes the publish a
   * genuine no-op between renders rather than a new snapshot each time. They
   * close over `panel.show` and NOT over `panel`: the dispatchers are stable but
   * the object around them is a fresh literal on every render, so depending on
   * it would mint a new action set each time and re-publish for nothing.
   */
  const pathname = usePathname() ?? '';
  const showPanel = panel.show;
  const openEdit = useCallback(() => showPanel('edit'), [showPanel]);
  const openInvites = useCallback(() => showPanel('invites'), [showPanel]);
  const openRequests = useCallback(() => showPanel('requests'), [showPanel]);
  const openDelete = useCallback(() => {
    setDeleteError(null);
    setDeleteOpen(true);
  }, []);

  const isOwner = scope?.isOwner ?? false;
  const actions = useMemo<readonly ScreenAction[]>(() => {
    if (!canManage) return NO_SCREEN_ACTIONS;
    const rows: ScreenAction[] = [
      {
        id: 'invites',
        label: 'Invite by link',
        icon: Link2,
        onSelect: openInvites,
      },
      {
        id: 'requests',
        label: 'Waiting to join',
        icon: UserPlus,
        onSelect: openRequests,
      },
      { id: 'edit', label: 'Edit space', icon: Pencil, onSelect: openEdit },
    ];
    if (isOwner) {
      rows.push({
        id: 'delete',
        label: 'Delete space',
        icon: Trash2,
        destructive: true,
        onSelect: openDelete,
      });
    }
    return rows;
  }, [canManage, isOwner, openInvites, openRequests, openEdit, openDelete]);

  useEffect(() => {
    setScreenContext({ pathname, back: null, actions });
  }, [pathname, actions]);
  useEffect(() => () => clearScreenContext(), []);

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
        onCreateChannel={scope.openCreateChannel}
        onOpenRoster={scope.openRoster}
      />

      <div className={SPACE_LOBBY_GRID}>
        <SpaceActivityBlock
          sections={scope.sections}
          // THE ONE WIRING POINT for the space's threads, live since
          // 2026-08-16 (`GET /spaces/{uuid}/threads`). The digest merges these
          // with the channel rows so the space's mention badge has rows to land
          // on; see the query mount above for the gate and the page size.
          threads={threads}
          isPending={scope.isChannelsPending || threadsQuery.isPending}
          isError={scope.isChannelsError || threadsQuery.isError}
          onRetry={retryActivity}
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
