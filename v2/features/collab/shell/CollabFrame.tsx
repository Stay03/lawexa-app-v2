'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { useAuthStore } from '@/lib/stores/authStore';
import type { Member } from '@/types/collab';
import { channelsQueries } from '@/v2/features/channels/queries';
import { collabAccessState } from '@/v2/features/collab/model';
import { ChannelFormDialog } from '@/v2/features/spaces/dialogs/ChannelFormDialog';
import { SpaceMembersSheet } from '@/v2/features/spaces/detail/SpaceMembersSheet';
import { canManageSpace, isSpaceOwner, roleInRoster } from '@/v2/features/spaces/model';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import {
  buildRailSections,
  channelPreviewIndex,
  parseCollabRoute,
  NO_RAIL_SECTIONS,
  type CollabRoute,
} from './collab-route';
import { clearCollabHeader, setCollabHeader } from './collab-header';
import { RailFrameSkeleton } from './rail-states';
import { SPACE_RAIL_WIDTH, SpaceRail } from './SpaceRail';
import { SpaceDrawer } from './SpaceDrawer';
import {
  CollabSpaceScopeProvider,
  type CollabSpaceIdentity,
  type CollabSpaceScope,
} from './space-scope';

/**
 * CollabFrame — the space that stays on screen while you move between its
 * channels.
 *
 * Rendered by `app/v2/(collab)/layout.tsx`, which Next preserves across every
 * navigation between its descendants. Everything below therefore OUTLIVES a
 * channel switch: the rail's DOM and scroll offset, the space and channel-list
 * queries, the mobile drawer, the create-channel dialog and the roster sheet.
 * Choosing a channel fetches and repaints the PANE and nothing else.
 *
 * ── THE FRAME IS THE SPACE-SCOPE DATA OWNER ────────────────────────────────
 * It holds the space, its channels, its roster and its governance, and
 * publishes them DOWN to the page through `CollabSpaceScopeProvider`. The
 * lobby reads that instead of mounting the same three leaves again — same
 * keys, so no second request either way, but ONE derivation of `canManage`
 * rather than two half-sources drifting apart.
 *
 * It costs the CHANNEL route two queries it did not previously make (the space
 * and its channel list). That is the rail, and it is paid once per space: both
 * mounts survive every channel hop inside it, and both are already warm when
 * the reader arrived from `/spaces`.
 *
 * ── HOW IT KNOWS WHICH SPACE IT IS IN ──────────────────────────────────────
 * On `/spaces/{uuid}` the address says so. On `/channels/{uuid}` the space is
 * a fact about the channel, so it comes from the channel detail — the SAME
 * cache entry `ChannelScreen` mounts, so learning it costs no request. The
 * channel row carries `space {uuid, name, type}`, which is exactly the crest
 * and the name, so the rail's identity and the header's kicker paint the
 * moment the channel does rather than waiting on a second round trip.
 *
 * THE RAIL'S WIDTH IS RESERVED FROM THE FIRST FRAME on a channel route, before
 * any of that resolves, because every channel has a space. Waiting would let
 * the pane paint full-width and then jump sideways.
 *
 * ── A REFUSED PLACE HAS NO CHROME ──────────────────────────────────────────
 * A 403/404 on the space (or on the channel that would have named it) means
 * there is no place to draw, and `identity` can then never resolve. So the
 * whole frame stands down: no rail, no reserved width, no drawer, and NO
 * published header context. Without that the reserved rail pulsed forever
 * beside the access-denied panel, the header shimmered a crest that would
 * never arrive, and the header's crest button still wrote `?rail=1` for a
 * drawer that was never mounted — a visibly live control that did nothing. The
 * designed refusal in the pane is the whole screen, which is what a refusal
 * should be.
 *
 * ── THREE URL-OWNED OVERLAYS, ALL QUIET, ALL SINGLY OWNED ──────────────────
 * `?rail=1` (the mobile drawer), `?create=channel` (the one create-channel
 * dialog in the product) and `?roster=1` (the SPACE roster). They live here
 * rather than on a screen because the first two must work from BOTH addresses,
 * and because the create affordance exists in four places that would otherwise
 * be four dialogs at four addresses. The writes are quiet: these are dynamic
 * routes, and a loud history write on one restarts the `/undefined` refetch
 * loop documented in `v2/runtime/url-params.ts`.
 *
 * `?roster=1` IS RESTRICTED TO THE SPACE ROUTE, AND THAT IS A HARD RULE.
 * `SpaceMembersSheet` and the channel screen's own `ChannelMembersSheet` each
 * own a nested `?invite=` param, and `useUrlOverlay` permits exactly ONE owner
 * per param. Two owners on one screen means the one whose `canOpen` refuses
 * STRIPS the value the other just wrote — so a channel admin who is a plain
 * space member would tap Invite and watch the panel open and shut in the same
 * beat, permanently, and everyone would hit it whenever `GET /spaces/{uuid}`
 * omits `my_role`. Keeping the space roster off channel routes leaves exactly
 * one `?invite=` owner at every address. It also settles the design question
 * underneath: a channel screen's "who is here" is the CHANNEL's roster, which
 * that screen already owns; the SPACE's people belong to the space's own page.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────────
 * It never wraps `/spaces` or `/channels` — those index routes keep scrolling
 * in the shell's own container, so `ScrollMemory` still restores them. Inside a
 * place the PANE owns the scroll instead (it has to: the channel screen is a
 * fixed-height column with its own transcript scroller, and a rail that
 * scrolled away with the page would not be a rail). KNOWN COST, recorded
 * rather than worked around: `ScrollMemory` restores `.v2-shell__content`
 * alone, so the lobby's own scroll offset is not restored on Back. The fix
 * belongs in `v2/shell/scroll-memory.tsx` — it needs to restore the innermost
 * scroller, and this file must not second-guess that module's private history
 * stamp from the outside.
 */
export function CollabFrame({ children }: { children: React.ReactNode }) {
  const route = parseCollabRoute(usePathname() ?? '');

  // No place, no frame: the list and index routes render exactly as they did.
  if (route.kind === 'none') return <>{children}</>;
  return <CollabPlaceFrame route={route}>{children}</CollabPlaceFrame>;
}

/** One frozen empty roster, so a space with none keeps a stable reference. */
const NO_MEMBERS: readonly Member[] = [];

function CollabPlaceFrame({
  route,
  children,
}: {
  /** Narrowed: this component only exists inside a place. */
  route: Exclude<CollabRoute, { kind: 'none' }>;
  children: React.ReactNode;
}) {
  const session = useV2Session();
  const viewerId = session.userId;
  // The uuid identity for roster self-checks — the sanctioned auth bridge,
  // read through a primitive selector (stable snapshot).
  const viewerUuid = useAuthStore((state) => state.user?.uuid ?? null);
  const eligible = collabAccessState(session) === 'eligible';
  const router = useRouter();

  const isSpaceRoute = route.kind === 'space';
  const channelUuid = route.kind === 'channel' ? route.channelUuid : null;

  /* ── The space this frame is standing in ───────────────────────────────── */

  // The dependent-query idiom: the uuid rides the key and `enabled` gates the
  // request, so the disabled variant never fetches and never collides with a
  // real entry. Same cache key `ChannelScreen` mounts ⇒ no second request.
  const channelQuery = useQuery({
    ...channelsQueries.detail(channelUuid ?? '', { viewerId }),
    enabled: eligible && channelUuid !== null,
  });
  const channel = channelQuery.data?.data ?? null;

  const spaceUuid = isSpaceRoute
    ? route.spaceUuid
    : (channel?.space.uuid ?? null);

  const spaceQuery = useQuery({
    ...spacesQueries.detail(spaceUuid ?? '', { viewerId }),
    enabled: eligible && spaceUuid !== null,
  });
  const space = spaceQuery.data?.data ?? null;

  /**
   * The channel list. On the SPACE route it waits for the space to succeed —
   * a 403 there means the reader is not a member, and the blocked read must
   * not be requested. On a CHANNEL route no such gate is needed or wanted: the
   * channel detail having resolved is already proof of access, so the two run
   * in parallel and the rail paints a beat sooner.
   */
  const channelsQuery = useQuery({
    ...channelsQueries.bySpace({
      spaceUuid: spaceUuid ?? '',
      viewerId,
      per_page: 50,
    }),
    enabled:
      eligible && spaceUuid !== null && (!isSpaceRoute || spaceQuery.isSuccess),
  });

  /**
   * The roster, on the LOBBY only. It is what the People block reads and what
   * warms the sheet, and it was already mounted there before this frame
   * existed. A channel route does not ask for it: the space detail's own
   * roster covers the rail's faces and the role fallback, and the space roster
   * is not reachable from a channel route at all (see the `?roster=1` rule).
   */
  const membersQuery = useQuery({
    ...spacesQueries.members(spaceUuid ?? '', { viewerId }),
    enabled: eligible && spaceUuid !== null && isSpaceRoute && spaceQuery.isSuccess,
  });

  /**
   * The last-message previews, from the caller's cross-space channel page —
   * the ONE route that stamps `last_message`. The realtime spine already
   * mounts this exact key app-wide, so it resolves to that entry: no request,
   * no skeleton, and previews that move with the spine's writers.
   */
  const myChannelsQuery = useQuery({
    ...channelsQueries.mine({ viewerId }),
    enabled: eligible,
  });

  /* ── Derivations ───────────────────────────────────────────────────────── */

  /**
   * EVERY DERIVATION BELOW IS MEMOISED BY HAND. The React Compiler's LINT is
   * enforced in this repo but its TRANSFORM is not enabled (there is no
   * `reactCompiler` in `next.config.ts` and no babel plugin), so nothing here
   * is optimised for free — and this component re-renders on every pathname
   * change and on every transition of five queries. Left raw, three sorts and
   * a fresh `Map` ran on each of those, and a new `scope` object re-rendered
   * the whole rail, the drawer and the lobby down to every row.
   */
  const members: readonly Member[] =
    membersQuery.data?.data ?? space?.members ?? NO_MEMBERS;

  // Every source, in the order they become trustworthy: the row's own stamp,
  // then the freshest roster available. `GET /spaces/{uuid}` MAY omit
  // `my_role`, and a missing answer degrades to "no manage actions" rather
  // than to a button that would 403.
  const myRole = space?.my_role ?? roleInRoster(members, viewerUuid);
  const canManage = canManageSpace({ my_role: myRole });
  const isOwner = isSpaceOwner({ my_role: myRole });

  const isMembersPending = isSpaceRoute && membersQuery.isPending;

  /**
   * Whether `canManage` is a SETTLED answer rather than a not-yet.
   *
   * It gates the create-channel param, and the distinction is load-bearing in
   * both directions: gate too early and a real admin's deep link is stripped
   * before their roster lands; leave it `undefined` too long and the hook
   * reads that as ALLOW and hands a plain member the admin form.
   *
   * The answer is settled when the space was refused (there is no role), when
   * the space carries its own `my_role`, or when the roster we intend to read
   * has finished arriving — which on a channel route is immediately, because
   * that route deliberately never asks for one.
   */
  const roleSettled =
    spaceQuery.isError ||
    (space !== null && (space.my_role != null || !isMembersPending));

  /**
   * The place was refused, so nothing about it can ever resolve. Both refusals
   * count: a 403/404 on the space itself, and one on the channel that would
   * have named the space.
   */
  const placeRefused =
    spaceQuery.isError || (channelUuid !== null && channelQuery.isError);

  const identity: CollabSpaceIdentity | null = useMemo(
    () =>
      space
        ? { uuid: space.uuid, name: space.name, type: space.type }
        : (channel?.space ?? null),
    [space, channel],
  );

  const previews = useMemo(
    () => channelPreviewIndex(myChannelsQuery.data?.data ?? []),
    [myChannelsQuery.data],
  );

  const sections = useMemo(
    () =>
      channelsQuery.data
        ? buildRailSections(channelsQuery.data.data, previews)
        : NO_RAIL_SECTIONS,
    [channelsQuery.data, previews],
  );

  const spaceApiError = spaceQuery.error ? extractApiError(spaceQuery.error) : null;
  const spaceErrorStatus = spaceApiError?.status ?? null;
  const spaceErrorMessage = spaceApiError?.message ?? null;

  /* ── The three URL-owned overlays ──────────────────────────────────────── */

  const rail = useUrlOverlay('rail');
  // Space-route only, so the `?invite=` param nested inside the sheet has
  // exactly one owner at every address (see the docblock). A refused value is
  // stripped, so a copied `/channels/{uuid}?roster=1` degrades to the channel.
  const roster = useUrlOverlay('roster', { canOpen: isSpaceRoute });
  const create = useUrlOverlay('create', {
    // The same `canManage` the affordances are gated on, so a copied
    // `?create=channel` link cannot hand a plain member a form that would 403.
    // `undefined` ONLY while the role is genuinely unknown — see `roleSettled`.
    canOpen: roleSettled ? { channel: canManage } : undefined,
  });

  // The hooks' dispatchers are stable; the hook OBJECTS are not, so the
  // dispatchers are what these depend on — `openRail` in particular must keep
  // one identity forever, because it rides the header store's snapshot.
  const { show: showRail, closeInPlace: closeRailInPlace } = rail;
  const { show: showRoster } = roster;
  const { show: showCreate, closeInPlace: closeCreateInPlace } = create;

  const openRail = useCallback(() => showRail(), [showRail]);
  const openRoster = useCallback(() => showRoster(), [showRoster]);
  const openCreateChannel = useCallback(() => showCreate('channel'), [showCreate]);

  // `refetch` is stable across renders; the query OBJECT is not, so depending
  // on the object would give these a new identity every render and the memo
  // would be a lie.
  const refetchSpace = spaceQuery.refetch;
  const refetchChannels = channelsQuery.refetch;
  const retrySpace = useCallback(() => void refetchSpace(), [refetchSpace]);
  const retryChannels = useCallback(() => void refetchChannels(), [refetchChannels]);

  /* ── Publish the header's route context ────────────────────────────────── */

  const spaceName = identity?.name ?? null;
  const spaceType = identity?.type ?? null;
  const headerSpaceUuid = identity?.uuid ?? null;
  const channelName = channelUuid === null ? null : (channel?.name ?? null);
  const backHref = channelUuid === null ? '/spaces' : `/spaces/${spaceUuid ?? ''}`;

  useEffect(() => {
    if (placeRefused) {
      // Nothing to say, and nothing that will ever arrive — a context left
      // published would shimmer a crest and a title forever over a refusal.
      clearCollabHeader();
      return;
    }
    setCollabHeader({
      spaceUuid: headerSpaceUuid,
      spaceName,
      spaceType,
      channelName,
      backHref,
      openRail,
    });
    return () => clearCollabHeader();
  }, [
    placeRefused,
    headerSpaceUuid,
    spaceName,
    spaceType,
    channelName,
    backHref,
    openRail,
  ]);

  /* ── The scope handed to the page ──────────────────────────────────────── */

  const isSpacePending = spaceUuid === null || spaceQuery.isPending;
  const isSpaceError = spaceQuery.isError;
  const isChannelsPending = spaceUuid === null || channelsQuery.isPending;
  const isChannelsError = channelsQuery.isError;

  const scope: CollabSpaceScope = useMemo(
    () => ({
      spaceUuid: spaceUuid ?? '',
      space,
      identity,
      isSpacePending,
      isSpaceError,
      spaceErrorStatus,
      spaceErrorMessage,
      retrySpace,
      sections,
      isChannelsPending,
      isChannelsError,
      retryChannels,
      members,
      isMembersPending,
      canManage,
      isOwner,
      openCreateChannel,
      openRoster,
      openRail,
    }),
    [
      spaceUuid,
      space,
      identity,
      isSpacePending,
      isSpaceError,
      spaceErrorStatus,
      spaceErrorMessage,
      retrySpace,
      sections,
      isChannelsPending,
      isChannelsError,
      retryChannels,
      members,
      isMembersPending,
      canManage,
      isOwner,
      openCreateChannel,
      openRoster,
      openRail,
    ],
  );

  return (
    <CollabSpaceScopeProvider scope={scope}>
      <div className="flex h-full min-h-0">
        {/* ── The rail, docked at `lg:` ─────────────────────────────────────
              NOT at `md:`. A 768px window already spends 256px on the app
              sidebar, so docking there left the channel 272px — narrower than
              the same window gives it on a phone, and exactly the width at
              which the channel's own header gains its breadcrumb and section
              switch. Between `md:` and `lg:` the drawer IS the channel list,
              opened from the header's panel toggle. Hidden in CSS, never by a
              hook, so the right chrome paints before hydration. ────────── */}
        {placeRefused ? null : (
          <aside
            aria-label="Space"
            className={cn(
              'hidden min-h-0 shrink-0 flex-col border-r border-border/60 bg-background lg:flex',
              SPACE_RAIL_WIDTH,
            )}
          >
            {identity === null ? (
              // A request really is in flight behind this, which is the case
              // the house rule says must pulse. It cannot outlive that
              // request: a refusal takes the whole `aside` away.
              <RailFrameSkeleton />
            ) : (
              <SpaceRail
                scope={scope}
                activeChannelUuid={channelUuid}
                atLobby={isSpaceRoute}
                // The docked rail shows no ages — its rows are single-line —
                // so it takes no clock, and no minute tick re-renders it.
                now={0}
                variant="docked"
              />
            )}
          </aside>
        )}

        {/* ── The pane. It owns the scroll inside a place (see the docblock);
              `overscroll-contain` keeps a rubber-band from leaking out to the
              shell behind it. ────────────────────────────────────────────── */}
        {/* `data-v2-scroller` hands this pane to ScrollMemory as the route's
            scroller, so Back restores the lobby where the reader left it. The
            shell's own scroller does not move inside a place. */}
        <div
          data-v2-scroller
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {children}
        </div>
      </div>

      {/* ── The same rail as a left sheet, for every width below `lg:`.
            Mounted from the first frame — NOT gated on the space having
            resolved — because the header's opener exists from the first frame
            too, and a live control that opens nothing is worse than a
            skeleton. It stands down only when the place was refused, where the
            opener is gone as well. ──────────────────────────────────────── */}
      {placeRefused ? null : (
        <SpaceDrawer
          scope={scope}
          open={rail.open}
          onOpenChange={rail.setOpen}
          onNavigate={closeRailInPlace}
          activeChannelUuid={channelUuid}
          atLobby={isSpaceRoute}
        />
      )}

      {/* ── The ONE create-channel dialog, mounted only for a reader who may
            actually create. The `canOpen` gate above strips the param for
            everyone else, and a form whose param has been stripped must not be
            left rendering on top of a refusal with a live Create that would
            POST into a 403. `keyFor` makes every ARRIVAL a fresh mount (fields
            re-derived) while every DEPARTURE is the same instance playing its
            exit. ───────────────────────────────────────────────────────── */}
      {spaceUuid !== null && space !== null && canManage ? (
        <ChannelFormDialog
          key={create.keyFor('channel')}
          spaceUuid={spaceUuid}
          onCreated={(createdUuid) => {
            // Success is a MOVE: the dialog's entry is rewritten rather than
            // popped, so the navigation below is not racing a queued
            // `history.back()` that would undo it.
            closeCreateInPlace();
            router.push(`/channels/${createdUuid}`);
          }}
          {...create.bind('channel')}
        />
      ) : null}

      {/* ── The space roster — the SPACE route only (see the `?invite=` rule
            in the docblock). Its own query is `enabled: open`, so mounting it
            here costs nothing until someone asks for it. ────────────────── */}
      {isSpaceRoute && space !== null ? (
        <SpaceMembersSheet
          space={space}
          viewerId={viewerId}
          viewerUuid={viewerUuid}
          open={roster.open}
          onOpenChange={roster.setOpen}
        />
      ) : null}
    </CollabSpaceScopeProvider>
  );
}
