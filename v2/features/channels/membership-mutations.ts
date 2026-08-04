'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { channelsApi } from '@/lib/api/collab';
import type {
  Channel,
  ChannelListResponse,
  ChannelResponse,
  InviteMemberPayload,
  NotifyLevel,
  UpdateChannelPayload,
  UpdateMemberRolePayload,
} from '@/types/collab';
import { invalidateSpaceRollups } from '@/v2/features/spaces/cache';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { channelsQueries } from './queries';

/**
 * membership-mutations — join / leave / invite / roles / notify level and the
 * channel edit/delete pair for the W2 screen. Ported from v1 `useCollab.ts`
 * onto the v2 keys (never imported — boundary rule). Sources: plan W2 item 2,
 * api-digest §C (invite 30/min; `PATCH /members/me` is the ONLY notify-level
 * path), study A3 verdicts — 2026-08-04.
 *
 * N1 (W1 audit carry-forward, honoured here): {@link useSetChannelNotifyLevel}
 * ASSIGNS `my_notify_level` into EVERY cached channel row (detail variants +
 * every row list) and invalidates the space rollups. A stale cached level
 * breaks Ruling A twice over — the dispatcher's mute oracle reads the cached
 * row, and the count writer derives `unreadChannelsDelta` from it — so the
 * level must move everywhere the row lives, atomically with the mutation.
 *
 * Errors: dialog-driven mutations (invite, edit) are `silentError` and
 * surface inline in their dialog; the fire-and-forget ones (role change,
 * remove, notify level) fall to the v2 global mutation error channel — the
 * ONE sanctioned failure toast family (design-research DIRECTION 6), raised
 * by the runtime, not this screen.
 */

/** Everything a membership edge invalidates — v1's set, plus the W2 lists and
 *  files keys (their reads 403 for non-members, exactly like messages). */
function invalidateChannelMembership(
  queryClient: QueryClient,
  channelUuid: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: channelsQueries.detailsOf(channelUuid),
  });
  void queryClient.invalidateQueries({
    queryKey: channelsQueries.membersOf(channelUuid),
  });
  void queryClient.invalidateQueries({
    queryKey: channelsQueries.messagesOf(channelUuid),
  });
  void queryClient.invalidateQueries({
    queryKey: channelsQueries.taskListsOf(channelUuid),
  });
  void queryClient.invalidateQueries({
    queryKey: channelsQueries.filesOf(channelUuid),
  });
  // Row lists re-rank (membership changes counts/ordering), and the space
  // rollups re-assert (a joined channel starts counting).
  void queryClient.invalidateQueries({ queryKey: channelsQueries.lists() });
  void queryClient.invalidateQueries({ queryKey: spacesQueries.lists() });
}

/** Join a `space_public` channel (private → 403; the screen never offers it). */
export function useJoinChannel(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => channelsApi.join(channelUuid),
    onSuccess: () => invalidateChannelMembership(queryClient, channelUuid),
  });
}

export function useLeaveChannel(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => channelsApi.leave(channelUuid),
    onSuccess: () => invalidateChannelMembership(queryClient, channelUuid),
  });
}

/** Invite (30/min server throttle). `silentError`: the dialog owns the
 *  failure line (dup → 409, unknown email → 422 — surfaced verbatim). */
export function useInviteChannelMember(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteMemberPayload) =>
      channelsApi.invite(channelUuid, payload),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: channelsQueries.membersOf(channelUuid),
      });
      void queryClient.invalidateQueries({
        queryKey: channelsQueries.detailsOf(channelUuid),
      });
    },
  });
}

export function useUpdateChannelMemberRole(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userUuid: string; role: UpdateMemberRolePayload['role'] }) =>
      channelsApi.updateMemberRole(channelUuid, vars.userUuid, { role: vars.role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: channelsQueries.membersOf(channelUuid),
      });
    },
  });
}

export function useRemoveChannelMember(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userUuid: string) =>
      channelsApi.removeMember(channelUuid, userUuid),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: channelsQueries.membersOf(channelUuid),
      });
      void queryClient.invalidateQueries({
        queryKey: channelsQueries.detailsOf(channelUuid),
      });
    },
  });
}

/**
 * Assign the caller's notify level onto every cached row of one channel.
 * Reference-stable no-ops (the house writer contract); returns the channel's
 * space uuid when any cached row knew it, for the rollup invalidation.
 */
function applyChannelNotifyLevel(
  queryClient: QueryClient,
  channelUuid: string,
  level: NotifyLevel,
): string | null {
  let spaceUuid: string | null = null;

  const assign = (row: Channel): Channel => {
    if (row.uuid !== channelUuid) return row;
    spaceUuid = spaceUuid ?? row.space.uuid;
    if (row.my_notify_level === level) return row;
    return { ...row, my_notify_level: level };
  };

  queryClient.setQueriesData<ChannelListResponse>(
    { queryKey: channelsQueries.lists() },
    (data) => {
      if (!data) return data;
      let changed = false;
      const rows = data.data.map((row) => {
        const next = assign(row);
        if (next !== row) changed = true;
        return next;
      });
      return changed ? { ...data, data: rows } : data;
    },
  );

  queryClient.setQueriesData<ChannelResponse>(
    { queryKey: channelsQueries.detailsOf(channelUuid) },
    (data) => {
      if (!data) return data;
      const next = assign(data.data);
      return next === data.data ? data : { ...data, data: next };
    },
  );

  return spaceUuid;
}

/**
 * The N1 mutation. `PATCH /channels/{uuid}/members/me` is the only way to
 * change the level (digest §F.13); the response's member row carries the
 * authoritative value, which is assigned everywhere and rolled up.
 */
export function useSetChannelNotifyLevel(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (level: NotifyLevel) =>
      channelsApi.setNotifyLevel(channelUuid, { notify_level: level }),
    onSuccess: (response) => {
      const level = response.data.notify_level;
      if (level) {
        const spaceUuid = applyChannelNotifyLevel(queryClient, channelUuid, level);
        // Mute flips the channel out of (or back into) the space's
        // unread-channels rollup (Ruling A) — the server recomputes; re-ask.
        invalidateSpaceRollups(queryClient, spaceUuid);
      }
      // The caller's own roster row carries `notify_level` too.
      void queryClient.invalidateQueries({
        queryKey: channelsQueries.membersOf(channelUuid),
      });
    },
  });
}

/** Edit the channel (owner/admin). `silentError`: the dialog owns the line. */
export function useUpdateChannel(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateChannelPayload) =>
      channelsApi.update(channelUuid, payload),
    meta: { silentError: true },
    onSuccess: (response) => {
      queryClient.setQueriesData<ChannelResponse>(
        { queryKey: channelsQueries.detailsOf(channelUuid) },
        (data) => (data ? { ...data, data: response.data } : data),
      );
      void queryClient.invalidateQueries({ queryKey: channelsQueries.lists() });
    },
  });
}

/** Delete the channel (owner/admin). The screen navigates away on success;
 *  the space's lists refill behind it. */
export function useDeleteChannel(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => channelsApi.remove(channelUuid),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: channelsQueries.lists() });
      void queryClient.invalidateQueries({ queryKey: spacesQueries.lists() });
      queryClient.removeQueries({
        queryKey: channelsQueries.detailsOf(channelUuid),
      });
    },
  });
}
