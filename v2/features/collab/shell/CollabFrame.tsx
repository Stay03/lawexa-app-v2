'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { useAuthStore } from '@/lib/stores/authStore';
import type { Member } from '@/types/collab';
import { channelsQueries } from '@/v2/features/channels/queries';
import {
  channelDisplayName,
  threadParentHref,
} from '@/v2/features/channels/thread-model';
import { useCachedChannelIdentity } from '@/v2/features/channels/screen/cached-identity';
import { canOpenTeamChannels, collabAccessState } from '@/v2/features/collab/model';
import { useCachedSpaceIdentity } from '@/v2/features/spaces/detail/cached-identity';
import { ChannelFormDialog } from '@/v2/features/spaces/dialogs/ChannelFormDialog';
import { DeleteSpaceDialog } from '@/v2/features/spaces/detail/DeleteSpaceDialog';
import { SpaceMembersSheet } from '@/v2/features/spaces/detail/SpaceMembersSheet';
import {
  canManageMembership,
  contentRoleInRoster,
  isMembershipOwner,
  MEMBERS_SHEET_PARAM,
  parseMembersSheetView,
  roleInRoster,
  spaceLeaveRoute,
  spaceShowsChannels,
  type MembershipSubject,
  type MembersSheetView,
} from '@/v2/features/spaces/model';
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
 * ── A SPACE WITHOUT CHANNELS HAS NO CHANNEL CHROME (Spaces F2) ─────────────
 * Stay, 11 October 2026: one Space holds chats, folders and files for every
 * member; channels stay with TEAM spaces, for researchers and above. So the
 * rail, its reserved width, the drawer, the header's drawer toggle, the
 * create-channel dialog and every channel request here exist only when the
 * space shows its channels to this viewer (`showsChannels`). A shared space,
 * or any space seen by someone below researcher, gets none of them and sends
 * no `GET /spaces/{uuid}/channels`: the backend would refuse it below
 * researcher (B0), and a shared space has no channels to list.
 *
 * On a CHANNEL route the answer is yes before anything resolves: the collab
 * gate above this frame already turned away everyone below researcher there
 * (F1), and a channel always lives in a team space. On a SPACE route the kind
 * is a fact about the space, known from the detail or from the list row the
 * reader tapped when it is still cached.
 *
 * TWO ANSWERS, KEPT APART (fix after review, 11 October 2026). The rail's
 * PRESENCE (the aside and its 240px, the drawer, the header's drawer toggle)
 * may GUESS while the kind is unknown, and guesses exactly as the page's
 * silhouette does (`CachedSpaceFrame`): no cached row reads as a team space,
 * because every space before shared ones is one. Reserving nothing on a hard
 * load (a refresh, a notification tap, an outside link) made the rail pop in
 * with the detail and re-centre the column under the reader for every team
 * space. With the guess, only a researcher cold-arriving on a SHARED space
 * sees the rail stand down, and nobody else sees a jump. Every REQUEST, and
 * the scope the page reads, waits for the KNOWN kind (`showsChannels`): a
 * guess may draw a skeleton, never spend a request the server might refuse.
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
 * `?roster=` CARRIES THE SHEET'S STEP (design round 1, 12 October 2026): `1`
 * for the roster, `links` and `requests` for the invite links and the waiting
 * list that moved into it, and `invite` for the roster with the invite dialog
 * already open. The three Owner steps are gated on `canManage` like the
 * create param, so a copied link cannot open them for anyone else.
 *
 * ── AND TWO CONFIRMATIONS THAT ARE NOT IN THE URL ──────────────────────────
 * Leave and Delete each have two doors since design round 1: the space menu
 * (the page) and the members sheet's footer (here). One dialog each, mounted
 * here, opened by both. Their open state is local, never a param: a link that
 * re-opens a destructive confirm on refresh is an armed trigger.
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
   * Whether this place shows its channels to this viewer (see "A space
   * without channels" in the docblock). The cached row is read here, ahead of
   * the identity derivation below, because the channel requests are gated on
   * the answer.
   */
  const cachedSpace = useCachedSpaceIdentity(isSpaceRoute ? route.spaceUuid : null);
  const showsChannels = isSpaceRoute
    ? space !== null
      ? spaceShowsChannels(space, session)
      : cachedSpace !== null && spaceShowsChannels(cachedSpace, session)
    : canOpenTeamChannels(session);
  /**
   * Whether the rail is DRAWN: the known answer once there is one, otherwise
   * the page silhouette's guess (an unknown kind reads as team). Chrome only;
   * no request reads this (see "Two answers" in the docblock).
   */
  const railShown = isSpaceRoute
    ? space !== null
      ? spaceShowsChannels(space, session)
      : spaceShowsChannels({ kind: cachedSpace?.kind ?? 'team' }, session)
    : canOpenTeamChannels(session);

  /**
   * The channel list. On the SPACE route it waits for the space to succeed —
   * a 403 there means the reader is not a member, and the blocked read must
   * not be requested. On a CHANNEL route no such gate is needed or wanted: the
   * channel detail having resolved is already proof of access, so the two run
   * in parallel and the rail paints a beat sooner. And on either route, only
   * where the place shows its channels.
   */
  const channelsQuery = useQuery({
    ...channelsQueries.bySpace({
      spaceUuid: spaceUuid ?? '',
      viewerId,
      per_page: 50,
    }),
    enabled:
      eligible &&
      showsChannels &&
      spaceUuid !== null &&
      (!isSpaceRoute || spaceQuery.isSuccess),
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
   * no skeleton, and previews that move with the spine's writers. Gated like
   * the rail it feeds: below researcher the spine never fetches it (F1), and
   * this mount must not be the one that does.
   */
  const myChannelsQuery = useQuery({
    ...channelsQueries.mine({ viewerId }),
    enabled: eligible && showsChannels,
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
  // On a SHARED space governance is the CONTENT Owner's (Spaces F7, backend
  // B2), read the same way: the row's stamp, then the roster. A team space
  // keeps today's `my_role` rule exactly (`canManageMembership`).
  const myContentRole =
    space?.my_content_role ?? contentRoleInRoster(members, viewerUuid);
  const membership = {
    kind: space?.kind,
    my_role: myRole,
    my_content_role: myContentRole,
  };
  const canManage = canManageMembership(membership);
  const isOwner = isMembershipOwner(membership);
  // The page reads the same answers (its header's role line, its menu), so
  // the object it gets is stable while none of the three facts moves.
  const membershipKind = space?.kind;
  const stableMembership: MembershipSubject = useMemo(
    () => ({ kind: membershipKind, my_role: myRole, my_content_role: myContentRole }),
    [membershipKind, myRole, myContentRole],
  );

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

  /**
   * The place's crest and name, from the freshest source that HAS one.
   *
   * The last two are the seeding the owner asked for on 15 August 2026 ("why
   * have full skeletons that are empty when the list page already has some of
   * the details"): the row the reader tapped is still in the cache, and it
   * names the space either directly or through the channel's own `space` stub.
   * So the header's crest and title paint on the first frame instead of
   * shimmering for the length of a round trip.
   *
   * ORDER IS TRUTH, NOT PREFERENCE. A live payload always wins; a cached row is
   * only consulted when there is nothing better, and it only ever supplies a
   * uuid, a name and a type — none of which can have changed between the tap
   * and the paint, and none of which is a permission.
   */
  const cachedChannel = useCachedChannelIdentity(channelUuid);

  const identity: CollabSpaceIdentity | null = useMemo(
    () =>
      (space
        ? { uuid: space.uuid, name: space.name, type: space.type }
        : (channel?.space ?? cachedChannel?.space)) ??
      (cachedSpace
        ? { uuid: cachedSpace.uuid, name: cachedSpace.name, type: cachedSpace.type }
        : null),
    [space, channel, cachedChannel, cachedSpace],
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

  // A place with no channels has no drawer, so a copied `?rail=1` is stripped
  // there; `undefined` while a space route's kind is still unknown, so the
  // param survives until the answer lands (the `roleSettled` rule below).
  // Without Team Channels the answer is no from the first frame, whatever the
  // kind (the F1 gate, 12 October 2026).
  const teamChannelsOpen = canOpenTeamChannels(session);
  const kindSettled = !isSpaceRoute || space !== null || spaceQuery.isError;
  const rail = useUrlOverlay('rail', {
    canOpen: !teamChannelsOpen ? false : kindSettled ? showsChannels : undefined,
  });
  // Space-route only, so the `?invite=` param nested inside the sheet has
  // exactly one owner at every address (see the docblock). A refused value is
  // stripped, so a copied `/channels/{uuid}?roster=1` degrades to the channel.
  const roster = useUrlOverlay('roster', {
    canOpen: !isSpaceRoute
      ? false
      : roleSettled
        ? { links: canManage, requests: canManage, invite: canManage }
        : undefined,
  });
  const rosterView = parseMembersSheetView(roster.value);
  const create = useUrlOverlay('create', {
    // The same `canManage` the affordances are gated on, so a copied
    // `?create=channel` link cannot hand a plain member a form that would 403.
    // `undefined` ONLY while the role is genuinely unknown — see `roleSettled`.
    // Without Team Channels the answer is no at once, whatever the role.
    canOpen: !teamChannelsOpen
      ? { channel: false }
      : roleSettled
        ? { channel: canManage && showsChannels }
        : undefined,
  });

  // The hooks' dispatchers are stable; the hook OBJECTS are not, so the
  // dispatchers are what these depend on — `openRail` in particular must keep
  // one identity forever, because it rides the header store's snapshot.
  const { show: showRail, closeInPlace: closeRailInPlace } = rail;
  const { show: showRoster, swap: swapRoster } = roster;
  const { show: showCreate, closeInPlace: closeCreateInPlace } = create;

  const openRail = useCallback(() => showRail(), [showRail]);
  // What the header gets: the opener, or nothing where there is no drawer.
  const headerOpenRail = railShown ? openRail : null;
  const openRoster = useCallback(() => showRoster(), [showRoster]);
  const openInviteLinks = useCallback(
    () => showRoster(MEMBERS_SHEET_PARAM.links),
    [showRoster],
  );
  const openJoinRequests = useCallback(
    () => showRoster(MEMBERS_SHEET_PARAM.requests),
    [showRoster],
  );
  const openInvite = useCallback(
    () => showRoster(MEMBERS_SHEET_PARAM.invite),
    [showRoster],
  );
  // Steps inside the open sheet REPLACE the entry, so Back closes the sheet
  // from any of them rather than walking back through each.
  const changeRosterView = useCallback(
    (next: MembersSheetView) => swapRoster(MEMBERS_SHEET_PARAM[next]),
    [swapRoster],
  );

  /* The two confirmations with two doors each (see the docblock). */
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const openLeave = useCallback(() => setLeaveOpen(true), []);
  const openDelete = useCallback(() => setDeleteOpen(true), []);
  const leaveRoute = spaceLeaveRoute(
    { kind: membershipKind },
    members,
    viewerUuid,
    isSpaceRoute && membersQuery.isSuccess,
  );
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
  const channelName =
    channelUuid === null || channel === null ? null : channelDisplayName(channel);

  /**
   * "Up" out of a thread is its PARENT CHANNEL, not the space.
   *
   * A thread has two containers and only one of them is where the reader came
   * from: the space is where it is FILED, the parent is the conversation it is
   * PART OF. Threads never appear in the rail (the listings apply `topLevel()`),
   * so a chevron to the space would drop the reader in a list that does not
   * contain the thing they just left. The `?m=` on it lands the parent on the
   * branched message, restoring the place rather than the room.
   *
   * The label travels with the address, because "Back to the space" is simply
   * untrue once the address is a channel.
   *
   * IT WAS UNTRUE ON THE SPACE ROUTE TOO, and had been since this shipped. On
   * `/spaces/{uuid}` there is no channel, so the address is `/spaces` — the
   * LIST — and the chevron beside it still read "Back to the space", naming the
   * place the reader was already standing in. Three addresses, three labels, and
   * each one now says where it actually goes (owner, 15 August 2026).
   */
  const threadHref = channel === null ? null : threadParentHref(channel);
  const backHref =
    threadHref ??
    (channelUuid === null ? '/spaces' : `/spaces/${spaceUuid ?? ''}`);
  const backLabel =
    threadHref !== null
      ? 'Back to the channel'
      : channelUuid === null
        ? 'Back to your spaces'
        : 'Back to the space';

  /**
   * Which row the rail lights. A thread has no row of its own — `listChannels`
   * applies `topLevel()`, deliberately, so a space's channel list is its
   * channels and not every tangent inside them. Lighting nothing while a thread
   * is open would say the reader has left the space; lighting the PARENT says
   * what is true, which is that they are still inside that conversation.
   */
  const railChannelUuid = channel?.is_thread
    ? (channel.parent_channel_uuid ?? null)
    : channelUuid;

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
      backLabel,
      openRail: headerOpenRail,
    });
    return () => clearCollabHeader();
  }, [
    placeRefused,
    headerSpaceUuid,
    spaceName,
    spaceType,
    channelName,
    backHref,
    backLabel,
    headerOpenRail,
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
      membership: stableMembership,
      leaveRoute,
      showsChannels,
      openCreateChannel,
      openRoster,
      openInviteLinks,
      openJoinRequests,
      openInvite,
      openLeave,
      openDelete,
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
      stableMembership,
      leaveRoute,
      showsChannels,
      openCreateChannel,
      openRoster,
      openInviteLinks,
      openJoinRequests,
      openInvite,
      openLeave,
      openDelete,
      openRail,
    ],
  );

  /** The rail and its drawer: a place that was not refused, and shows (or,
   *  while its kind is unknown, is expected to show) its channels. Until the
   *  channel list is allowed to load, the rail draws its skeleton. */
  const hasRail = !placeRefused && railShown;

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
              hook, so the right chrome paints before hydration. Absent, with
              its width, where the place shows no channels. ─────────────── */}
        {hasRail ? (
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
                activeChannelUuid={railChannelUuid}
                atLobby={isSpaceRoute}
                // The docked rail shows no ages — its rows are single-line —
                // so it takes no clock, and no minute tick re-renders it.
                now={0}
                variant="docked"
              />
            )}
          </aside>
        ) : null}

        {/* ── The pane. It owns the scroll inside a place (see the docblock);
              `overscroll-contain` keeps a rubber-band from leaking out to the
              shell behind it. ────────────────────────────────────────────── */}
        {/* `data-v2-scroller` hands this pane to ScrollMemory as the route's
            scroller, so Back restores the lobby where the reader left it. The
            shell's own scroller does not move inside a place. */}
        <div
          data-v2-scroller
          className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {children}
        </div>
      </div>

      {/* ── The same rail as a left sheet, for every width below `lg:`.
            Mounted from the first frame — NOT gated on the space having
            resolved — because the header's opener exists from the first frame
            too, and a live control that opens nothing is worse than a
            skeleton. It stands down when the place was refused or shows no
            channels, where the opener is gone as well. ─────────────────── */}
      {hasRail ? (
        <SpaceDrawer
          scope={scope}
          open={rail.open}
          onOpenChange={rail.setOpen}
          onNavigate={closeRailInPlace}
          activeChannelUuid={railChannelUuid}
          atLobby={isSpaceRoute}
        />
      ) : null}

      {/* ── The ONE create-channel dialog, mounted only for a reader who may
            actually create. The `canOpen` gate above strips the param for
            everyone else, and a form whose param has been stripped must not be
            left rendering on top of a refusal with a live Create that would
            POST into a 403. `keyFor` makes every ARRIVAL a fresh mount (fields
            re-derived) while every DEPARTURE is the same instance playing its
            exit. ───────────────────────────────────────────────────────── */}
      {spaceUuid !== null && space !== null && canManage && showsChannels ? (
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
      {/* Keyed by the space, so nothing the sheet holds about one space (a
          hand-over in progress, a refusal) is carried into the next. The
          prefix keeps the key apart from the delete dialog's: both are
          children of the same provider. */}
      {isSpaceRoute && space !== null ? (
        <SpaceMembersSheet
          key={`members-${space.uuid}`}
          space={space}
          viewerId={viewerId}
          viewerUuid={viewerUuid}
          open={roster.open}
          onOpenChange={roster.setOpen}
          view={rosterView}
          onViewChange={changeRosterView}
          inviteArrivalKey={roster.keyFor(MEMBERS_SHEET_PARAM.invite)}
          leaveOpen={leaveOpen}
          onLeaveOpenChange={setLeaveOpen}
          onDeleteSpace={openDelete}
        />
      ) : null}

      {/* The ONE delete confirmation, for the Owner only (see the docblock).
          Keyed by the space for the same reason as the sheet. */}
      {isSpaceRoute && space !== null && isOwner ? (
        <DeleteSpaceDialog
          key={`delete-${space.uuid}`}
          space={space}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      ) : null}
    </CollabSpaceScopeProvider>
  );
}
