'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { organizationsApi } from '@/lib/api/collab';
import { adminOrganizationVerificationsKey } from './useAdminOrganizationVerifications';

/**
 * Approving and refusing an organization's verification.
 *
 * ── BOTH INVALIDATE THE QUEUE, AND THAT IS THE POINT ───────────────────────
 * A decision removes the company from `awaiting_verification`, so the list the
 * admin came from is wrong the instant either succeeds. Two people work this
 * queue; leaving a stale row on screen invites the second one to open a company
 * the first has already answered.
 *
 * The single organization is invalidated too, because the review screen the
 * admin is standing on has to redraw with the decision on it rather than the
 * buttons that made it.
 */
export function useApproveOrganization(uuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => organizationsApi.verify(uuid),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: adminOrganizationVerificationsKey,
      });
      void queryClient.invalidateQueries({
        queryKey: ['organization', uuid],
      });
    },
  });
}

export function useRejectOrganization(uuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    /** The reason is the server's requirement, not a nicety — it is emailed. */
    mutationFn: (reason: string) =>
      organizationsApi.rejectVerification(uuid, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: adminOrganizationVerificationsKey,
      });
      void queryClient.invalidateQueries({
        queryKey: ['organization', uuid],
      });
    },
  });
}

/** The key the review screen reads one organization under. */
export const adminOrganizationKey = (uuid: string) =>
  ['organization', uuid] as const;
