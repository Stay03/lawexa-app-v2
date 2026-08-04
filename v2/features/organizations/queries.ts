import { queryOptions } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api/collab';
import type { MemberListParams } from '@/types/collab';
import { GC_TIMES, REFETCH_ON_VISIT, STALE_TIMES } from '@/v2/runtime/query';

/**
 * organizations query factory — the `/organization` surface's two reads
 * (owner decision D7: an organization is a thing you VISIT, so it is a
 * top-level route, not a setting). Sources: plan W4 item 4, `api-digest.md`
 * §C Organizations, study A8 — 2026-08-04.
 *
 * `enabled` stays a call-site concern, gated on the collab access state
 * (`v2/features/collab/model.ts`) — never baked into the leaves.
 */

/**
 * VIEWER PARTITION — required by type, same rule as the spaces, channels and
 * invitations factories: `viewerId` is a CACHE PARTITION, not a request
 * parameter, so forgetting it is a type error rather than a silent
 * cross-account leak. It matters especially here: `GET /my-organization`
 * answers a different organization for every viewer, and one of the answers is
 * `null`.
 */
export interface ViewerScoped {
  /** The server-verified viewer id (`V2SessionSnapshot.userId`), `null` if signed out. */
  viewerId: number | null;
}

export const organizationsQueries = {
  all: ['organizations'] as const,

  /**
   * THE caller's organization, or `data: null` when they have none — a person
   * belongs to at most one. The `null` is a real answer, not an empty state
   * of an error: the screen renders the designed "create one" panel for it.
   *
   * Standard tier + `REFETCH_ON_VISIT`: membership here changes through other
   * people's actions (an accepted invitation, a removal, a verification
   * decision by a reviewer), none of which produce a local event — so an
   * arrival must ask.
   */
  mine: ({ viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...organizationsQueries.all, 'mine', { viewerId }] as const,
      queryFn: () => organizationsApi.myOrganization(),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),

  /** Invalidation handle for one organization's roster (all params variants). */
  membersOf: (uuid: string) => [...organizationsQueries.all, 'members', uuid] as const,

  /**
   * An organization's member roster — drives the members sheet AND the screen's
   * governance check (the org payload's embedded `members` array is
   * members-only and not guaranteed on every response, so the roster is the
   * one honest source for "what am I here?").
   */
  members: (uuid: string, { viewerId, ...params }: MemberListParams & ViewerScoped) =>
    queryOptions({
      queryKey: [...organizationsQueries.membersOf(uuid), params, { viewerId }] as const,
      queryFn: () => organizationsApi.getMembers(uuid, params),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchOnMount: REFETCH_ON_VISIT,
    }),
};
