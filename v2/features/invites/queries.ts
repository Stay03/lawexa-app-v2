'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { discoverApi, inviteLinksApi, joinRequestsApi } from '@/lib/api/collab';
import type {
  CreateInviteLinkPayload,
  DiscoverSpacesParams,
} from '@/types/collab';
import { channelsQueries } from '@/v2/features/channels/queries';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { STALE_TIMES } from '@/v2/runtime/query';
import { DISCOVER_PER_PAGE, nextDiscoverPage } from '@/v2/features/spaces/discover/discover-model';

/**
 * Queries and mutations for invite links, the two waiting lists, and browsing
 * public spaces.
 *
 * ── ONE RULE RUNS THROUGH ALL OF IT ────────────────────────────────────────
 * Approving, rejecting and revoking are addressed by an `id` that came off a
 * row the server sent. Nothing here builds one. The API shipped once without
 * that field and thirty green tests missed it, because a test keeps the id it
 * created while an app has to read it back.
 */

export const inviteKeys = {
  links: (spaceUuid: string) => ['invite-links', spaceUuid] as const,
  spaceRequests: (spaceUuid: string) => ['space-join-requests', spaceUuid] as const,
  channelRequests: (channelUuid: string) =>
    ['channel-join-requests', channelUuid] as const,
  discover: (params: DiscoverSpacesParams) => ['discover-spaces', params] as const,
};

export function useInviteLinks(spaceUuid: string, enabled = true) {
  return useQuery({
    queryKey: inviteKeys.links(spaceUuid),
    queryFn: () => inviteLinksApi.list(spaceUuid),
    enabled: enabled && Boolean(spaceUuid),
  });
}

export function useCreateInviteLink(spaceUuid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInviteLinkPayload) =>
      inviteLinksApi.create(spaceUuid, payload),
    // Said where the link is made (a Space limit in the server's words, else "try again"), not in a toast too.
    meta: { silentError: true },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: inviteKeys.links(spaceUuid) });
    },
  });
}

export function useRevokeInviteLink(spaceUuid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => inviteLinksApi.revoke(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: inviteKeys.links(spaceUuid) });
    },
  });
}

export function useSpaceJoinRequests(spaceUuid: string, enabled = true) {
  return useQuery({
    queryKey: inviteKeys.spaceRequests(spaceUuid),
    queryFn: () => joinRequestsApi.listForSpace(spaceUuid),
    enabled: enabled && Boolean(spaceUuid),
  });
}

export function useChannelJoinRequests(channelUuid: string, enabled = true) {
  return useQuery({
    queryKey: inviteKeys.channelRequests(channelUuid),
    queryFn: () => joinRequestsApi.listForChannel(channelUuid),
    enabled: enabled && Boolean(channelUuid),
  });
}

/**
 * Approve / reject, for either queue.
 *
 * The space roster is invalidated too: approving ADDS A MEMBER, and a member
 * list still showing the old count beside a queue that just shrank reads as a
 * failure. Approving a request that carries `also_joins_channel` adds them to
 * that channel as well, so its roster goes with it.
 *
 * THROUGH THE QUERY FACTORIES' OWN HANDLES (fix, Spaces F3, 12 October 2026).
 * This used to invalidate `['space', uuid]` and `['channel', uuid]`, keys no
 * query has: the space's detail and roster live under `['spaces', 'detail' |
 * 'members', uuid]` and the channel's under `['channels', …]`, so an approval
 * refreshed the queue and left the roster and the member count stale. The
 * spaces list goes too, since its rows carry the member count.
 */
export function useDecideJoinRequest(
  kind: 'space' | 'channel',
  parentUuid: string,
): UseMutationResult<unknown, Error, { id: number; approve: boolean }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve }) => {
      if (kind === 'space') {
        return approve
          ? joinRequestsApi.approveSpace(id)
          : joinRequestsApi.rejectSpace(id);
      }
      return approve
        ? joinRequestsApi.approveChannel(id)
        : joinRequestsApi.rejectChannel(id);
    },
    onSuccess: () => {
      const key =
        kind === 'space'
          ? inviteKeys.spaceRequests(parentUuid)
          : inviteKeys.channelRequests(parentUuid);
      void client.invalidateQueries({ queryKey: key });
      if (kind === 'space') {
        void client.invalidateQueries({ queryKey: spacesQueries.detailsOf(parentUuid) });
        void client.invalidateQueries({ queryKey: spacesQueries.membersOf(parentUuid) });
        void client.invalidateQueries({ queryKey: spacesQueries.lists() });
        return;
      }
      void client.invalidateQueries({ queryKey: channelsQueries.detailsOf(parentUuid) });
      void client.invalidateQueries({ queryKey: channelsQueries.membersOf(parentUuid) });
    },
  });
}

/**
 * Ask to be let into a private channel.
 *
 * `200` (you already had a request waiting) is a SUCCESS and must not draw an
 * error — react-query treats any 2xx as success, so nothing extra is needed
 * here; the caller must simply not assume `201`.
 */
export function useRequestChannelAccess(channelUuid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => joinRequestsApi.requestChannel(channelUuid),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: inviteKeys.channelRequests(channelUuid),
      });
    },
  });
}

/** Public Spaces, a page of 20 at a time; the list asks for the next as it scrolls. */
export function useDiscoverSpaces(params: Pick<DiscoverSpacesParams, 'search'>) {
  return useInfiniteQuery({
    queryKey: inviteKeys.discover(params),
    queryFn: ({ pageParam }) => discoverApi.spaces({ ...params, per_page: DISCOVER_PER_PAGE, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: nextDiscoverPage,
    // Read on every visit: the card's Join or Open is the reader's membership, which a
    // join anywhere else changes (an invite link, a Space's own page). A list kept for a
    // minute offered Join to a member, and that Join answered 409 (Arthur, 14 November 2026).
    staleTime: STALE_TIMES.live,
  });
}

/** Ask to join a public shared space, or take the ask back. The Discover
 *  rows re-ask the server, which says the reader's status (`my_status`). */
/** Take back a request to join that is still waiting for the Owner. */
export function useCancelJoinRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (spaceUuid: string): Promise<void> => {
      await discoverApi.cancelRequest(spaceUuid);
    },
    meta: { silentError: true },
    onSuccess: () => client.invalidateQueries({ queryKey: ['discover-spaces'] }),
  });
}

export function useJoinPublicSpace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (spaceUuid: string) => discoverApi.join(spaceUuid),
    // Settled, not only succeeded: a 409 says the list was out of date (`joinOpensSpace`).
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['discover-spaces'] });
      void client.invalidateQueries({ queryKey: ['spaces'] });
    },
    // Every refusal is said on the card (`joinRefusal`), so no toast says it a second time.
    meta: { silentError: true },
  });
}
