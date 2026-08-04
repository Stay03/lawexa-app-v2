import { queryOptions } from '@tanstack/react-query';
import { invitationsApi } from '@/lib/api/collab';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';

/**
 * invitations query factory — the three invitee inboxes behind the ONE
 * `/invitations` surface (owner decision D5; study A7). Sources: plan W4 item
 * 3, `api-digest.md` §C — 2026-08-04.
 *
 * THREE ENDPOINTS, ONE SCREEN. `GET /channel-invitations`,
 * `/space-invitations` and `/organization-invitations` are separate routes with
 * separate shapes, so they stay separate cache entries; the screen composes
 * them into three sections and the entry badge sums them. Keeping them apart
 * also means one inbox failing does not blank the other two.
 *
 * TIER: standard + `REFETCH_ON_VISIT`. An invitation always arrives from
 * SOMEONE ELSE, so an arrival at `/spaces` or `/invitations` must ask —
 * there is no local event that could have told us. Window-focus refetch stays
 * on (the QueryClient default), which covers "accepted on my phone, still
 * listed on my laptop".
 *
 * KNOWN SEAM FOR W5: the realtime spine's `.notification` handler invalidates
 * `notificationsQueries.all` only, so a `space_invite` / `channel_invite` /
 * `organization_invite` push does not currently refresh THESE keys — the badge
 * catches up on the next visit or focus. Adding `invitationsQueries.all` to
 * that handler is a one-line change in `v2/runtime/realtime/spine.tsx`, a file
 * outside this wave's ownership; it is reported rather than made here.
 */

/**
 * VIEWER PARTITION — the same required-by-type rule as the spaces and channels
 * factories: `viewerId` is not a request parameter (the bearer token
 * authorizes the call), it is a CACHE PARTITION, and making it required means
 * forgetting it is a type error rather than a silent cross-account leak.
 */
export interface ViewerScoped {
  /** The server-verified viewer id (`V2SessionSnapshot.userId`), `null` if signed out. */
  viewerId: number | null;
}

/** Pagination for the inboxes. One page of 50 is the whole inbox in practice;
 *  the screen does not paginate (an inbox you cannot clear in 50 rows is a
 *  problem no "load more" button solves). */
const PAGE = { per_page: 50 } as const;

export const invitationsQueries = {
  /** The prefix every accept/decline invalidates, and the W5 spine seam. */
  all: ['invitations'] as const,

  /** Pending channel invitations. Rows carry the channel + its space, the
   *  offered role, and the inviter. */
  channels: ({ viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...invitationsQueries.all, 'channels', { viewerId }] as const,
      queryFn: () => invitationsApi.channels.list(PAGE),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /** Pending space invitations. */
  spaces: ({ viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...invitationsQueries.all, 'spaces', { viewerId }] as const,
      queryFn: () => invitationsApi.spaces.list(PAGE),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /** Pending organization invitations. A person belongs to at most one
   *  organization, so this inbox is short by construction. */
  organizations: ({ viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...invitationsQueries.all, 'organizations', { viewerId }] as const,
      queryFn: () => invitationsApi.organizations.list(PAGE),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),
};
