'use client';

import { useQuery } from '@tanstack/react-query';

import { organizationsApi } from '@/lib/api/collab';

/**
 * The organization verification queue, for the admin screen.
 *
 * ── WHY THIS EXISTS AT ALL ─────────────────────────────────────────────────
 * @arthur, 16 August 2026: "i just submitted the verification document for Law
 * Guide Technology for an Organization Account, i need to be able to review and
 * approve them in admin". The server could already approve and reject; there
 * was no screen anywhere that called either, so nobody could.
 *
 * ── THE LIST IS NOT A SEPARATE ADMIN ROUTE ─────────────────────────────────
 * It is `/organizations` with one filter, which is why this wraps
 * `organizationsApi.listAwaitingVerification` rather than inventing an admin
 * client. The filter's NAME is the dangerous part and is stated once, there —
 * a wrong name is answered 200 with every organization rather than refused.
 */
const QUEUE_KEY = ['admin', 'organization-verifications'] as const;

export function useAdminOrganizationVerifications(params: {
  page?: number;
  per_page?: number;
}) {
  return useQuery({
    queryKey: [...QUEUE_KEY, params],
    queryFn: () => organizationsApi.listAwaitingVerification(params),
    /**
     * A QUEUE IS A LIVE THING AND SOMEBODY ELSE IS WORKING IT. Two admins on the
     * same list must not both open a company one of them has already answered,
     * so this is deliberately short-lived rather than the app's usual minute.
     */
    staleTime: 15 * 1000,
  });
}

/** The key, for invalidating after an approve or a reject. */
export const adminOrganizationVerificationsKey = QUEUE_KEY;
