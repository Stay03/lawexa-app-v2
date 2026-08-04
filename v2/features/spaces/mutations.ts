'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { channelsApi, spacesApi } from '@/lib/api/collab';
import type {
  CreateChannelPayload,
  CreateSpacePayload,
  InviteMemberPayload,
  SpaceResponse,
  TransferOwnershipPayload,
  UpdateMemberRolePayload,
  UpdateSpacePayload,
} from '@/types/collab';
import { channelsQueries } from '@/v2/features/channels/queries';
import { spacesQueries } from './queries';

/**
 * spaces mutations — space CRUD, the membership edges (invite / role /
 * remove / transfer / leave) and channel creation, ported from v1's
 * `useCollab.ts` onto the v2 viewer-scoped keys (ported, never imported —
 * boundary rule). Sources: plan W4 items 1–2, `api-digest.md` §C, study A1/A2
 * verdicts — 2026-08-04.
 *
 * WHY THESE ARE NOT `optimisticMutation`s. The v2 optimistic helper edits ONE
 * cache entry from a pure updater. Every write here changes membership or
 * governance, which the server re-derives across several payloads at once
 * (`my_role` on the space row, `active_members_count`, the roster, the
 * channels a new member may now see). Guessing all of that client-side would
 * be inventing server state; these mutations therefore write nothing
 * optimistically and INVALIDATE the exact keys the edge dirtied. The rows the
 * reader is looking at stay on screen throughout (TanStack refetches behind
 * them), so nothing flickers — see each invalidation set below.
 *
 * ERROR CHANNEL. Dialog- and sheet-driven writes are `silentError` and render
 * the server's own sentence INLINE, next to the control that failed — the
 * house rule, and the only way a 409 ("already a member") or a 30/min 429 can
 * be read as an answer rather than an interruption. Fire-and-forget row
 * actions (role change, remove) fall through to the ONE global mutation-error
 * toast raised by the runtime, so these screens raise no toasts of their own
 * (design-research DIRECTION 6).
 */

/**
 * Everything a SPACE-membership edge dirties. Deliberately broad on the two
 * list families and narrow everywhere else: a membership change re-ranks and
 * re-stamps rows (`my_role`, counts, which channels are visible at all), and
 * both `spacesQueries.lists()` and `channelsQueries.lists()` are single
 * prefixes covering every cached variant.
 */
function invalidateSpaceMembership(
  queryClient: QueryClient,
  spaceUuid: string,
): void {
  void queryClient.invalidateQueries({ queryKey: spacesQueries.membersOf(spaceUuid) });
  void queryClient.invalidateQueries({ queryKey: spacesQueries.detailsOf(spaceUuid) });
  void queryClient.invalidateQueries({ queryKey: spacesQueries.lists() });
  void queryClient.invalidateQueries({ queryKey: channelsQueries.lists() });
}

/* ── Space CRUD ───────────────────────────────────────────────────────────── */

/** Create a space (personal, or org-owned when the caller governs the org).
 *  The dialog navigates to the new space from the resolved response. */
export function useCreateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSpacePayload) => spacesApi.create(payload),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: spacesQueries.lists() });
    },
  });
}

/**
 * Edit a space (owner/admin). The server's row is written straight into every
 * cached detail variant so the header re-renders with the canonical values in
 * the same frame the dialog closes; the lists re-ask because the row's name,
 * type and privacy all appear there.
 */
export function useUpdateSpace(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSpacePayload) => spacesApi.update(spaceUuid, payload),
    meta: { silentError: true },
    onSuccess: (response) => {
      queryClient.setQueriesData<SpaceResponse>(
        { queryKey: spacesQueries.detailsOf(spaceUuid) },
        (data) => (data ? { ...data, data: response.data } : data),
      );
      void queryClient.invalidateQueries({ queryKey: spacesQueries.lists() });
    },
  });
}

/** Delete a space (owner). The screen navigates to `/spaces`; the detail
 *  entry is REMOVED rather than invalidated — refetching a deleted uuid would
 *  only spend a 404. */
export function useDeleteSpace(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => spacesApi.remove(spaceUuid),
    meta: { silentError: true },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: spacesQueries.detailsOf(spaceUuid) });
      queryClient.removeQueries({ queryKey: spacesQueries.membersOf(spaceUuid) });
      void queryClient.invalidateQueries({ queryKey: spacesQueries.lists() });
      void queryClient.invalidateQueries({ queryKey: channelsQueries.lists() });
    },
  });
}

/* ── Membership ───────────────────────────────────────────────────────────── */

/** Invite to a space (**30/min** server throttle). `silentError`: the dialog
 *  owns the failure line — duplicate → 409, unknown email → 422, and the
 *  throttle's 429, all shown as the server wrote them. */
export function useInviteSpaceMember(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteMemberPayload) => spacesApi.invite(spaceUuid, payload),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: spacesQueries.membersOf(spaceUuid) });
      void queryClient.invalidateQueries({ queryKey: spacesQueries.detailsOf(spaceUuid) });
    },
  });
}

export function useUpdateSpaceMemberRole(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userUuid: string; role: UpdateMemberRolePayload['role'] }) =>
      spacesApi.updateMemberRole(spaceUuid, vars.userUuid, { role: vars.role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: spacesQueries.membersOf(spaceUuid) });
    },
  });
}

export function useRemoveSpaceMember(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userUuid: string) => spacesApi.removeMember(spaceUuid, userUuid),
    onSuccess: () => invalidateSpaceMembership(queryClient, spaceUuid),
  });
}

/**
 * Transfer ownership (owner only). The old owner is DEMOTED TO ADMIN
 * server-side (digest §C), so this changes the caller's own `my_role` on every
 * surface — hence the full membership invalidation rather than a roster-only
 * one. `silentError`: the confirm dialog shows the reason in place.
 */
export function useTransferSpaceOwnership(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransferOwnershipPayload) =>
      spacesApi.transferOwnership(spaceUuid, payload),
    meta: { silentError: true },
    onSuccess: () => invalidateSpaceMembership(queryClient, spaceUuid),
  });
}

/**
 * Leave a space. `silentError` because the ONE refusal this call has is a
 * designed inline state, not a failure toast: an owner with other members
 * present gets **400 "Transfer ownership…"**, which the sheet renders as an
 * explanation with the transfer affordance right beside it (model's
 * `isOwnerMustTransferError`).
 */
export function useLeaveSpace(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => spacesApi.leave(spaceUuid),
    meta: { silentError: true },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: spacesQueries.detailsOf(spaceUuid) });
      queryClient.removeQueries({ queryKey: spacesQueries.membersOf(spaceUuid) });
      void queryClient.invalidateQueries({ queryKey: spacesQueries.lists() });
      void queryClient.invalidateQueries({ queryKey: channelsQueries.lists() });
    },
  });
}

/* ── Channels within a space ──────────────────────────────────────────────── */

/**
 * Create a channel in a space (space owner/admin). Lives in the SPACES feature
 * because the space screen owns the affordance and `POST /spaces/{space}/
 * channels` is a space-scoped route; the channel screen's own edit/delete pair
 * stays with the channels feature. The new row must appear in this space's
 * list AND in the cross-space "My channels" index, both of which sit under the
 * one `channelsQueries.lists()` prefix.
 */
export function useCreateChannel(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChannelPayload) =>
      channelsApi.create(spaceUuid, payload),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: channelsQueries.lists() });
      void queryClient.invalidateQueries({ queryKey: spacesQueries.detailsOf(spaceUuid) });
    },
  });
}
