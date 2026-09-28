import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { authApi } from '@/lib/api/auth';
import type { Session } from '@/types/auth';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Signed-in devices: the read and the two sign-outs, against the routes the
 * backend confirmed on 28 September 2026 (2d6803ba):
 *
 *   GET    /auth/sessions        every token, the current one marked
 *   DELETE /auth/sessions/{id}   sign one out; 400 for the current one,
 *                                404 for another account's
 *   DELETE /auth/sessions        sign out every OTHER token; keeps this one
 *
 * `standard` freshness: a device signed in elsewhere a minute ago can wait for
 * the next focus or visit; nothing on this screen is live.
 */
export const devicesQueries = {
  all: ['settings', 'devices'] as const,

  list: () =>
    queryOptions({
      queryKey: devicesQueries.all,
      queryFn: async (): Promise<Session[]> => (await authApi.getSessions()).data ?? [],
      staleTime: STALE_TIMES.standard,
    }),
};

/**
 * Sign one device out. On success the row leaves the cached list at once
 * (the server has already ended that session), then the list is re-read.
 */
export function useSignOutDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) => authApi.revokeSession(sessionId),
    meta: { silentError: true },
    onSuccess: (_response, sessionId) => {
      queryClient.setQueryData<Session[]>(devicesQueries.all, (list) =>
        list?.filter((session) => session.id !== sessionId),
      );
      void queryClient.invalidateQueries({ queryKey: devicesQueries.all });
    },
  });
}

/** Sign out every device except this one. */
export function useSignOutOtherDevices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.revokeAllSessions(),
    meta: { silentError: true },
    onSuccess: () => {
      queryClient.setQueryData<Session[]>(devicesQueries.all, (list) =>
        list?.filter((session) => session.is_current),
      );
      void queryClient.invalidateQueries({ queryKey: devicesQueries.all });
    },
  });
}
