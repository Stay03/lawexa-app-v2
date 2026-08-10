'use client';

import {
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
      void client.invalidateQueries({ queryKey: ['space', parentUuid] });
      void client.invalidateQueries({ queryKey: ['channel', parentUuid] });
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

export function useDiscoverSpaces(params: DiscoverSpacesParams) {
  return useQuery({
    queryKey: inviteKeys.discover(params),
    queryFn: () => discoverApi.spaces(params),
  });
}

export function useJoinPublicSpace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (spaceUuid: string) => discoverApi.join(spaceUuid),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['discover-spaces'] });
      void client.invalidateQueries({ queryKey: ['spaces'] });
    },
  });
}
