'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Hourglass, Link2, LogOut, Pencil, Plus, Trash2, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { channelsQueries } from '@/v2/features/channels/queries';
import { useMinuteNow } from '@/v2/features/channels/use-minute-now';
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
import { SpaceFormDialog } from '../dialogs/SpaceFormDialog';
import {
  defaultSpaceTab,
  parseSpaceTab,
  spaceMenuItems,
  spaceShowsChannels,
  type SpaceMenuItem,
  type SpaceTab,
} from '../model';
import { NO_SPACE_THREADS } from './activity-digest';
import { CachedSpaceFrame } from './CachedSpaceFrame';
import { SpaceContentPanel } from './content/SpaceContentPanel';
import {
  spacePageColumn,
  SPACE_LOBBY_GRID,
  SPACE_TAB_PANEL,
  SPACE_TABS_ROW,
} from './lobby-parts';
import { SpacePeoplePanel } from './people/SpacePeoplePanel';
import { SpaceAboutSheet } from './SpaceAboutSheet';
import { SpacePlaceHeader } from './SpacePlaceHeader';
import { SpaceTabs } from './SpaceTabs';
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
 * What stays local is what is genuinely this page's: the rename dialog's URL
 * overlay. The leave and delete confirmations moved to the frame in design
 * round 1, because the members sheet's footer opens them too.
 *
 * ── ONE SPACE, FOUR TABS (Spaces F2, 11 October 2026) ──────────────────────
 * Stay decided that one Space holds chats, folders and files for every
 * member, and that channels stay with team spaces, for researchers and above.
 * So under the identity block the page is a tab strip: Conversations, Folders
 * and Files for every member (F3 lets the Owner and Contributors add to them,
 * see `SpaceContentPanel`), and first of all a Channels tab holding the lobby
 * above (the activity digest,
 * the people, the facts) wherever the space shows its channels to this viewer
 * (`scope.showsChannels`, the frame's answer, so the tab and the rail can
 * never disagree). Every space opens on Conversations, with the message box
 * at its bottom (Stay and Arthur, 15 October 2026); a People tab ends the
 * strip.
 *
 * THE TAB IS IN THE URL, QUIETLY (`?tab=`, the radar screen's idiom): read
 * once from the address, then held here and written back with a quiet
 * replace, so switching tabs costs no history entry and no router round trip,
 * and a copied link opens the same tab. The default tab writes nothing, and a
 * value this viewer does not have (`channels` on a shared space) resolves to
 * the default rather than to an empty strip.
 */
/** Stable empty reference — a fresh `[]` per render would churn the publish. */
const NO_SCREEN_ACTIONS: readonly ScreenAction[] = [];

/** The one tab panel's id; `TabRow` mints the tab ids from it. */
const PANEL_ID = 'space-tab-panel';

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
  // The shared minute clock, so the digest's ages stay true while the reader
  // sits here. `0` before hydration; the rows treat that as "no age yet".
  const now = useMinuteNow();

  const space = scope?.space ?? null;
  const canManage = scope?.canManage ?? false;
  const showsChannels = scope?.showsChannels ?? false;

  /* ── The tab (see the docblock) ──────────────────────────────────────────
     The raw `?tab=` value, read once, then owned here. Held RAW rather than
     resolved, because which tabs exist is only known once the space has
     loaded: a `?tab=channels` link must survive the pending render. */
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
  const tab = parseSpaceTab(tabParam, showsChannels);
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
   *
   * AND ONLY WHERE THE DIGEST IS ON SCREEN (Spaces F2): the space shows its
   * channels to this viewer, and the Channels tab is the one open. Threads are
   * channels, so below researcher the backend refuses the route (B0), and a
   * shared space has none.
   */
  const eligible = collabAccessState(session) === 'eligible';
  const threadsQuery = useQuery({
    ...channelsQueries.threadsBySpace({
      spaceUuid,
      viewerId: session.userId,
      per_page: 50,
    }),
    enabled: eligible && space !== null && showsChannels && tab === 'channels',
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
   * Members, Rename, Leave, Delete, as the role allows (`spaceMenuItems`, where
   * the order and the rules are pinned). Every member gets
   * Members and Leave, so a Viewer who wants out no longer has to guess that
   * the faces are a button. The Owner (and a team space's admin) adds Invite
   * links and Waiting to join, which open those steps of the members sheet,
   * and Rename. Delete is the Owner's alone. The bar draws a rule before
   * Rename, so the people rows read as one group, and one before Leave, the
   * first destructive row (`ruledAbove`).
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
  const openRename = useCallback(() => showPanel('edit'), [showPanel]);
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
        label: 'Rename',
        icon: Pencil,
        separatorBefore: true,
        onSelect: openRename,
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
    openRename,
    openLeave,
    openDelete,
  ]);

  useEffect(() => {
    setScreenContext({ pathname, back: null, actions });
  }, [pathname, actions]);
  useEffect(() => () => clearScreenContext(), []);

  // Before the detail lands, the silhouette draws the tab the page is most
  // likely to open: the cached row's kind (a cold arrival reads as a team
  // space, which every space before shared ones is), the `CachedSpaceFrame`
  // rule, plus whatever `?tab=` asked for.
  const pendingShowsChannels = spaceShowsChannels(
    { kind: cachedIdentity?.kind ?? 'team' },
    session,
  );
  const pendingFrame = (
    <SpaceScreenFrame
      identity={cachedIdentity}
      showsChannels={pendingShowsChannels}
      tab={parseSpaceTab(tabParam, pendingShowsChannels)}
    />
  );

  // Defensive, and never expected: this page is a child of the `(collab)`
  // layout, which always provides the scope. Drawing the silhouette is the
  // honest answer if that ever stops being true — never a crash, never a lie.
  if (scope === null) return pendingFrame;

  if (scope.isSpacePending) return pendingFrame;

  if (scope.isSpaceError || space === null) {
    const status = scope.spaceErrorStatus ?? 0;
    return (
      <div className={spacePageColumn(false)}>
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
    <div className={spacePageColumn(showsChannels)}>
      <SpacePlaceHeader space={space} membership={scope.membership} onOpenAbout={openAbout} />

      <div className={SPACE_TABS_ROW}>
        <SpaceTabs
          showsChannels={showsChannels}
          value={tab}
          onChange={setTab}
          panelId={PANEL_ID}
        />
      </div>

      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={`${PANEL_ID}-tab-${tab}`}
        className={SPACE_TAB_PANEL}
      >
        {tab === 'channels' ? (
          <>
            {/* New channel moved here from the top of the space (Stay, 15
                October 2026). From `lg:` the docked rail carries it at its
                foot, so it is shown only below `lg:`: one at every width. */}
            {canManage && showsChannels ? (
              <div className="mb-4 lg:hidden">
                <Button size="sm" className="v2-interactive" onClick={scope.openCreateChannel}>
                  <Plus aria-hidden className="size-4" />
                  New channel
                </Button>
              </div>
            ) : null}
            <div className={SPACE_LOBBY_GRID}>
              <SpaceActivityBlock
                sections={scope.sections}
                // THE ONE WIRING POINT for the space's threads, live since
                // 2026-08-16 (`GET /spaces/{uuid}/threads`). The digest merges
                // these with the channel rows so the space's mention badge has
                // rows to land on; see the query mount above for the gate and
                // the page size.
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
          </>
        ) : tab === 'people' ? (
          <SpacePeoplePanel key="people" space={space} />
        ) : (
          // `key` per tab: each list is its own query and its own frozen
          // clock, so a switch is a fresh mount, never one list's rows
          // briefly under another tab's name.
          <SpaceContentPanel key={tab} tab={tab} spaceUuid={space.uuid} />
        )}
      </div>

      <SpaceFormDialog
        key={panel.keyFor('edit')}
        space={space}
        viewerId={session.userId}
        {...panel.bind('edit')}
      />
      <SpaceAboutSheet space={space} membership={scope.membership} {...panel.bind('about')} />
    </div>
  );
}
