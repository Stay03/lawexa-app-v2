'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api/collab';
import type {
  CreateOrganizationPayload,
  InviteMemberPayload,
  MyOrganizationResponse,
  RequestVerificationPayload,
  UpdateMemberRolePayload,
  UpdateOrganizationPayload,
} from '@/types/collab';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { organizationsQueries } from './queries';

/**
 * organizations mutations — create / edit / delete, the membership edges, the
 * self-leave, and the CAC verification request. Ported from v1's `useCollab.ts`
 * onto the v2 keys (ported, never imported — boundary rule). Sources: plan W4
 * item 4, `api-digest.md` §C, study A8 — 2026-08-04.
 *
 * WHY `spacesQueries.lists()` KEEPS APPEARING BELOW. An organization owns
 * spaces: a space row carries its `organization` ref, the space create dialog
 * offers the org as an owner, and deleting the organization leaves its spaces
 * in place but WITHOUT an organization (the server's documented behaviour, and
 * the delete confirmation says so out loud). Every write that changes the
 * organization's identity or the caller's membership therefore re-asserts the
 * spaces list rather than leaving a stale org name on a row.
 *
 * ERROR CHANNEL: dialog-driven writes are `silentError` and show the server's
 * own sentence inline; the fire-and-forget roster actions fall to the ONE
 * global mutation-error toast raised by the runtime.
 */

/** The caller's `/my-organization` answer changed shape — refetch it, and the
 *  space surfaces that quote the organization. */
function invalidateMyOrganization(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: organizationsQueries.all });
  void queryClient.invalidateQueries({ queryKey: spacesQueries.lists() });
}

/* ── Organization CRUD ────────────────────────────────────────────────────── */

/**
 * Create the caller's organization. The response IS the new `/my-organization`
 * answer, so it is written straight into that cache entry — the screen swaps
 * from the empty state to the identity header in the same frame the dialog
 * closes, with no round trip in between (the feel directive).
 */
export function useCreateOrganization(viewerId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrganizationPayload) => organizationsApi.create(payload),
    meta: { silentError: true },
    onSuccess: (response) => {
      queryClient.setQueryData<MyOrganizationResponse>(
        organizationsQueries.mine({ viewerId }).queryKey,
        response,
      );
      invalidateMyOrganization(queryClient);
    },
  });
}

/** Edit the organization (owner/admin). `type` is frozen once verified — the
 *  form locks the control, so this payload never carries a rejected change. */
export function useUpdateOrganization(uuid: string, viewerId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateOrganizationPayload) =>
      organizationsApi.update(uuid, payload),
    meta: { silentError: true },
    onSuccess: (response) => {
      queryClient.setQueryData<MyOrganizationResponse>(
        organizationsQueries.mine({ viewerId }).queryKey,
        response,
      );
      invalidateMyOrganization(queryClient);
    },
  });
}

/** Delete the organization (owner). Its spaces survive without an owner org. */
export function useDeleteOrganization(uuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => organizationsApi.remove(uuid),
    meta: { silentError: true },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: organizationsQueries.membersOf(uuid) });
      invalidateMyOrganization(queryClient);
    },
  });
}

/* ── Membership ───────────────────────────────────────────────────────────── */

/** Invite to the organization (**30/min**). `silentError`: the dialog owns the
 *  line — duplicate → 409, unknown email → 422, throttle → 429 handled quietly. */
export function useInviteOrganizationMember(uuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteMemberPayload) => organizationsApi.invite(uuid, payload),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: organizationsQueries.membersOf(uuid),
      });
    },
  });
}

export function useUpdateOrganizationMemberRole(uuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userUuid: string; role: UpdateMemberRolePayload['role'] }) =>
      organizationsApi.updateMemberRole(uuid, vars.userUuid, { role: vars.role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: organizationsQueries.membersOf(uuid),
      });
    },
  });
}

export function useRemoveOrganizationMember(uuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userUuid: string) => organizationsApi.removeMember(uuid, userUuid),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: organizationsQueries.membersOf(uuid),
      });
      void queryClient.invalidateQueries({ queryKey: organizationsQueries.all });
    },
  });
}

/**
 * Leave the caller's organization (`POST /my-organization/leave`). Note the
 * route: there is no uuid — a person has at most one organization, so "leave"
 * needs no target. `silentError` so the sheet can explain a refusal in place
 * (an owner with members remaining must hand the organization over first).
 */
export function useLeaveMyOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => organizationsApi.leaveMyOrganization(),
    meta: { silentError: true },
    onSuccess: () => invalidateMyOrganization(queryClient),
  });
}

/* ── Verification ─────────────────────────────────────────────────────────── */

/**
 * Submit BN number + CAC document (multipart, ≤10 MB, pdf/jpg/png). The
 * response is the updated organization and is written straight into
 * `/my-organization`, so the screen re-renders from canonical data with no
 * refetch.
 *
 * WHAT THIS RESPONSE CANNOT DO, STATED PLAINLY: it does NOT move the panel to
 * "Verification under review". `verification_requested_at` is admin-only and
 * is stripped from the submitter's copy of the organization, so the written
 * payload looks byte-for-byte unverified — the panel would sit on "Get
 * verified" as if nothing had happened. The dialog's `onSubmitted` callback is
 * what carries that fact to the screen (see
 * `model.ts`'s `verificationState` note, and the backend ask recorded there to
 * expose the field to organization governors). When that ask lands this
 * response becomes sufficient on its own and the client flag becomes a
 * first-render nicety.
 *
 * `silentError`: the dialog shows the server's validation sentence inline.
 */
export function useRequestVerification(uuid: string, viewerId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestVerificationPayload) =>
      organizationsApi.requestVerification(uuid, payload),
    meta: { silentError: true },
    onSuccess: (response) => {
      queryClient.setQueryData<MyOrganizationResponse>(
        organizationsQueries.mine({ viewerId }).queryKey,
        response,
      );
    },
  });
}
