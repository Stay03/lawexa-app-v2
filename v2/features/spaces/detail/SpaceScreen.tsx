'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Hourglass, Link2, LogOut, Pencil, Trash2, Users } from 'lucide-react';

import { collabAccessState } from '@/v2/features/collab/model';
import { useCollabSpaceScope } from '@/v2/features/collab/shell/space-scope';
import { useV2Session } from '@/v2/runtime/session-context';
import { quietReplaceUrlParams } from '@/v2/runtime/url-params';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import {
  clearScreenContext,
  setScreenContext,
  type ScreenAction,
} from '@/v2/shell/screen-context';
import { useSpaceJoinRequests } from '@/v2/features/invites/queries';
import { SpaceFormDialog } from '../dialogs/SpaceFormDialog';
import { spacesQueries } from '../queries';
import {
  SPACE_TAB_LABELS,
  defaultSpaceTab,
  parseSpaceTab,
  spaceMenuItems,
  type SpaceMenuItem,
  type SpaceTab,
} from '../model';
import { CachedSpaceFrame } from './CachedSpaceFrame';
import { SpaceContentPanel } from './content/SpaceContentPanel';
import { SPACE_BOARD_COLUMN, SPACE_PAGE_COLUMN } from './lobby-parts';
import { SpaceAboutSheet } from './SpaceAboutSheet';
import { SpacePlaceHeader } from './SpacePlaceHeader';
import { useCachedSpaceIdentity } from './cached-identity';
import { useTabTitle } from '@/v2/shell/use-tab-title';
import {
  SpaceAccessDeniedState,
  SpaceErrorState,
  SpaceScreenFrame,
} from './states';

/**
 * SpaceScreen — the `/spaces/{uuid}` home: the space's header, then
 * everything in it (`SpaceContentPanel`).
 *
 * ── IT OWNS ALMOST NO DATA ─────────────────────────────────────────────────
 * The space, its channels, its roster and the reader's role all come from
 * `CollabFrame` through `useCollabSpaceScope()`. That is not a shortcut: the
 * frame has to hold them anyway for the rail, and one derivation of
 * `canManage` from every available source is the only version that cannot
 * drift from the rail's. It also means arriving here from a channel paints
 * from queries that never unmounted.
 *
 * What stays local is what is genuinely this page's: the rename dialog's URL
 * overlay. The leave and delete confirmations moved to the frame in design
 * round 1, because the members sheet's footer opens them too.
 *
 * ── ONE HOME, FIVE PILLS (design B4, Arthur and Stay, 17 October 2026) ────
 * One Space holds chats, folders and files for every member (Stay, Spaces F2,
 * 11 October 2026). Under the header the page is one list of them with the
 * message box at its bottom, filtered by pills (All, Conversations, Files,
 * Folders) and a People pill for the members (`SpaceContentPanel`). The tab
 * strip and the Channels tab's lobby went: channels are not in the first v2,
 * and the space rail keeps them for whoever has them.
 *
 * THE PILL IS IN THE URL, QUIETLY (`?tab=`, the radar screen's idiom): read
 * once from the address, then held here and written back with a quiet
 * replace, so switching pills costs no history entry and no router round
 * trip, and a copied link opens the same pill. All writes nothing, and any
 * value that is not a pill (the old `chats` and `channels`) opens All.
 */
/** Stable empty reference — a fresh `[]` per render would churn the publish. */
const NO_SCREEN_ACTIONS: readonly ScreenAction[] = [];

export function SpaceScreen({ spaceUuid }: { spaceUuid: string }) {
  // `useSearchParams` (the tab) needs a boundary; its fallback is the route's
  // own silhouette, so the boundary cannot show a second shape.
  return (
    <Suspense fallback={<CachedSpaceFrame />}>
      <SpaceScreenBody spaceUuid={spaceUuid} />
    </Suspense>
  );
}

function SpaceScreenBody({ spaceUuid }: { spaceUuid: string }) {
  const scope = useCollabSpaceScope();
  /* What the spaces list already knew about this space — crest, kicker, name,
     description. It fills the frame below so the silhouette the route boundary
     drew does not empty itself out when the boundary is deleted and this screen
     takes over. Identity only: every ruling still waits for the detail. */
  const cachedIdentity = useCachedSpaceIdentity(spaceUuid);
  const session = useV2Session();

  const space = scope?.space ?? null;
  useTabTitle(space?.name);
  const canManage = scope?.canManage ?? false;

  /* ── The pill (see the docblock) ─────────────────────────────────────────
     The raw `?tab=` value, read once, then owned here. */
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [tabParam, setTabParam] = useState<string | null>(urlTab);
  // A soft navigation to this same space with another `?tab=` (a link from
  // elsewhere in the app) changes the router's search params without
  // remounting this page, so the tab follows it. Adjusted during render, keyed
  // on the previous value, which is React's sanctioned way to reset state from
  // a changed input. The quiet writes below never reach the router, so they
  // can never trigger this.
  const [seenUrlTab, setSeenUrlTab] = useState<string | null>(urlTab);
  if (urlTab !== seenUrlTab) {
    setSeenUrlTab(urlTab);
    setTabParam(urlTab);
  }
  const tab = parseSpaceTab(tabParam);
  const setTab = useCallback(
    (next: SpaceTab) => {
      const value = next === defaultSpaceTab() ? null : next;
      setTabParam(value);
      quietReplaceUrlParams({ tab: value });
    },
    [],
  );
  // Back and Forward restore the address but not this state (the quiet write
  // never told the router), so the tab is re-read from the address on each.
  useEffect(() => {
    const onPopState = () => {
      setTabParam(new URLSearchParams(window.location.search).get('tab'));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const eligible = collabAccessState(session) === 'eligible';

  /* The People pill's two lists for whoever manages the people (the invites
     not accepted yet, and who asked to join), asked for as the space opens, so
     the pill opens with them drawn. Asked for only when the pill mounted, they
     landed a beat after the members, already cached, and popped in under them
     (inside-shots-1, 15 October 2026). Same keys as the pill's own reads, so
     it paints from this cache and asks again for nothing. The header's
     "1 invite sent" is this list's total. */
  const peopleReads = eligible && space !== null && canManage;
  const pendingInvites = useQuery({
    ...spacesQueries.members(spaceUuid, { viewerId: session.userId, status: 'pending' }),
    enabled: peopleReads,
  });
  useSpaceJoinRequests(spaceUuid, peopleReads);

  /**
   * The rename dialog is the ONE overlay this page still owns — creating a
   * channel and opening the roster moved to the frame, because they have to
   * work from the channel routes too, and invite links and the waiting list
   * became steps of the frame's members sheet in design round 1.
   *
   * `canOpen` carries the same `canManage` the menu item is gated on, so a
   * copied `?panel=edit` link cannot hand a plain member the admin form. It is
   * `undefined` until the space lands: gating on a role that has not resolved
   * would strip a real admin's deep link before it could work. The two values
   * that moved into the sheet are refused, so an old `?panel=invites` link is
   * stripped rather than left in the address opening nothing.
   */
  const panel = useUrlOverlay('panel', {
    canOpen: space ? { edit: canManage, about: true, invites: false, requests: false } : undefined,
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
   * overflow menus. `screen-context.ts` folds these rows into the bar's single
   * menu, above a separator, and `SpacePlaceHeader` lost its trigger.
   *
   * ── AND THEY ARE THE APPROVED MENU (design round 1, 12 October 2026) ─────
   * Members, Edit space, Leave, Delete, as the role allows (`spaceMenuItems`, where
   * the order and the rules are pinned). Every member gets
   * Members and Leave, so a Viewer who wants out no longer has to guess that
   * the faces are a button. The Owner (and a team space's admin) adds Invite
   * links and Waiting to join, which open those steps of the members sheet,
   * and Edit space. Delete is the Owner's alone. The bar draws a rule before
   * Edit space, so the people rows read as one group, and one before Leave, the
   * first destructive row (`ruledAbove`).
   *
   * "EDIT SPACE", NOT "RENAME" (techlead, 16 October 2026). The row opens the
   * whole edit form (name, goal, type, who can join), and Arthur looked for an
   * edit and found only a rename. The About sheet offers the same form to
   * whoever may manage the space (`onEdit`). The menu's id stays `rename`, the
   * rule's own name for the row.
   *
   * LEAVE IS NEVER A DEAD END: where it could only be refused, for the last
   * Owner of a space nobody else is in, it is not offered, and Delete is the
   * way out (`scope.leaveRoute`). The last Owner with others in it keeps
   * Leave, which asks them to choose a new owner first.
   *
   * `panel`'s own `canOpen` map is the second gate, so a copied `?panel=edit`
   * still cannot hand a plain member the admin form.
   *
   * Every callback is `useCallback`-stable or comes from the frame's memoised
   * scope, which is what makes the publish a genuine no-op between renders
   * rather than a new snapshot each time. They close over `panel.show` and NOT
   * over `panel`: the dispatchers are stable but the object around them is a
   * fresh literal on every render.
   */
  const pathname = usePathname() ?? '';
  const showPanel = panel.show;
  const openEdit = useCallback(() => showPanel('edit'), [showPanel]);
  const openAbout = useCallback(() => showPanel('about'), [showPanel]);

  const isOwner = scope?.isOwner ?? false;
  const leaveRoute = scope?.leaveRoute ?? 'leave';
  const openRoster = scope?.openRoster;
  const openInviteLinks = scope?.openInviteLinks;
  const openJoinRequests = scope?.openJoinRequests;
  const openLeave = scope?.openLeave;
  const openDelete = scope?.openDelete;
  const hasSpace = space !== null;
  const actions = useMemo<readonly ScreenAction[]>(() => {
    // Nothing until the space has landed: before that there is no membership
    // to offer verbs about.
    if (
      !hasSpace ||
      !openRoster ||
      !openInviteLinks ||
      !openJoinRequests ||
      !openLeave ||
      !openDelete
    ) {
      return NO_SCREEN_ACTIONS;
    }
    const verbs: Record<SpaceMenuItem, ScreenAction> = {
      members: { id: 'members', label: 'Members', icon: Users, onSelect: openRoster },
      'invite-links': {
        id: 'invite-links',
        label: 'Invite links',
        icon: Link2,
        onSelect: openInviteLinks,
      },
      waiting: {
        id: 'waiting',
        label: 'Waiting to join',
        icon: Hourglass,
        onSelect: openJoinRequests,
      },
      rename: {
        id: 'rename',
        label: 'Edit space',
        icon: Pencil,
        separatorBefore: true,
        onSelect: openEdit,
      },
      leave: {
        id: 'leave',
        label: 'Leave space',
        icon: LogOut,
        destructive: true,
        onSelect: openLeave,
      },
      delete: {
        id: 'delete',
        label: 'Delete space',
        icon: Trash2,
        destructive: true,
        onSelect: openDelete,
      },
    };
    return spaceMenuItems({ canManage, isOwner, leaveRoute }).map((item) => verbs[item]);
  }, [
    hasSpace,
    canManage,
    isOwner,
    leaveRoute,
    openRoster,
    openInviteLinks,
    openJoinRequests,
    openEdit,
    openLeave,
    openDelete,
  ]);

  // The desktop breadcrumb ends at the space on All, and names any other pill
  // after it (Arthur, 16 October 2026: the trail's last part is where the
  // reader is). Only once the space has landed: `null` is a skeleton.
  const crumb = !hasSpace ? null : tab === defaultSpaceTab() ? '' : SPACE_TAB_LABELS[tab];
  useEffect(() => {
    setScreenContext({ pathname, back: null, actions, crumb });
  }, [pathname, actions, crumb]);
  useEffect(() => () => clearScreenContext(), []);

  // Before the detail lands, the silhouette draws the pill `?tab=` asked for.
  const pendingFrame = <SpaceScreenFrame identity={cachedIdentity} tab={tab} />;

  // Defensive, and never expected: this page is a child of the `(collab)`
  // layout, which always provides the scope. Drawing the silhouette is the
  // honest answer if that ever stops being true — never a crash, never a lie.
  if (scope === null) return pendingFrame;

  if (scope.isSpacePending) return pendingFrame;

  if (scope.isSpaceError || space === null) {
    const status = scope.spaceErrorStatus ?? 0;
    return (
      <div className={SPACE_PAGE_COLUMN}>
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

  return (
    <div className={tab === 'tasks' ? SPACE_BOARD_COLUMN : SPACE_PAGE_COLUMN}>
      <SpacePlaceHeader
        space={space}
        membership={scope.membership}
        onOpenAbout={openAbout}
        onOpenRoster={scope.openRoster}
        invitesSent={peopleReads ? pendingInvites.data?.pagination.total : undefined}
      />

      <SpaceContentPanel space={space} tab={tab} onTabChange={setTab} />

      <SpaceFormDialog
        key={panel.keyFor('edit')}
        space={space}
        {...panel.bind('edit')}
      />
      <SpaceAboutSheet
        space={space}
        membership={scope.membership}
        onEdit={canManage ? openEdit : undefined}
        {...panel.bind('about')}
      />
    </div>
  );
}
