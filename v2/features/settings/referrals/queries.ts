import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { ambassadorsApi } from '@/lib/api/ambassadors';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Referrals: the same four calls as the shared ambassador screen
 * (`components/ambassadors/ReferralScreen.tsx`), which v2 may not import.
 *
 *   GET  /ambassadors/my-application   the door: 200 with data null for somebody
 *                                      who never applied (measured, 11 Aug 2026)
 *   GET  /ambassadors/code             current code and every retired one
 *   GET  /ambassadors/performance      the three counts, and one per code
 *   POST /ambassadors/code             claim or change; 409 taken, 422 not
 *                                      allowed (the server's sentence), 429 slow down
 */
export const referralsQueries = {
  all: ['settings', 'referrals'] as const,

  application: () =>
    queryOptions({
      queryKey: [...referralsQueries.all, 'application'] as const,
      queryFn: async () => (await ambassadorsApi.getMyApplication()).data ?? null,
      staleTime: STALE_TIMES.standard,
    }),

  code: (enabled: boolean) =>
    queryOptions({
      queryKey: [...referralsQueries.all, 'code'] as const,
      queryFn: async () => (await ambassadorsApi.getCode()).data ?? null,
      staleTime: STALE_TIMES.standard,
      enabled,
    }),

  performance: (enabled: boolean) =>
    queryOptions({
      queryKey: [...referralsQueries.all, 'performance'] as const,
      queryFn: async () => (await ambassadorsApi.getPerformance()).data ?? null,
      staleTime: STALE_TIMES.standard,
      enabled,
    }),
};

/**
 * Claim or change the code. The POST's body is NOT read: its shape is not the
 * GET's, and trusting it once made a successful claim look like nothing
 * happened (the v1 screen's 11 August fix). The code and the counts are
 * re-read instead, and the mutation stays pending until they are.
 */
export function useClaimCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => ambassadorsApi.claimCode(code),
    meta: { silentError: true },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [...referralsQueries.all, 'code'] }),
        queryClient.invalidateQueries({ queryKey: [...referralsQueries.all, 'performance'] }),
      ]),
  });
}
