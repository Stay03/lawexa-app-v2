'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { wrappedApi } from '@/lib/api/wrapped';
import { useAuthStore } from '@/lib/stores/authStore';
import { WRAPPED_STALE_MS, mayHaveWrapped, wrappedAskable, wrappedKeys, wrappedRunning } from '@/lib/wrapped/access';
import { useV2Session } from '@/v2/runtime/session-context';

/** Read once when the app loads: Wrapped leaves the menu and the home after 31 December. */
const RUNNING = wrappedRunning(Date.now());

/**
 * True when the signed-in student has a Lawexa Wrapped to open: the menu's
 * "Your Wrapped" and the home banner show then. Only a Law School profile asks
 * the server, under the same cache key as the /wrapped route, so opening the
 * story after the banner reads no second time.
 *
 * Whether the profile names a Law School, and whether Wrapped is hidden, come
 * from this page load's `/auth/me` (the v2 session), not from the copy of the
 * user saved at sign-in, which is never refreshed: a student whose Law School
 * was set after they signed in was never asked (Tester a710ccc3, Techlead
 * d4c4a981). The saved copy still counts where it knows more, such as a
 * "Hide from Wrapped" switched in this tab.
 */
export function useHasWrapped(): boolean {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isGuest = useAuthStore((state) => state.isGuest);
  const session = useV2Session();
  const enabled =
    RUNNING &&
    wrappedAskable({
      signedIn: Boolean(token && user && !isGuest),
      lawSchool: session.mayHaveWrapped || mayHaveWrapped(user),
      hidden: user?.wrapped_hidden ?? session.wrappedHidden,
    });
  const wrapped = useQuery({
    queryKey: wrappedKeys.me(user?.id ?? null),
    queryFn: wrappedApi.me,
    enabled,
    staleTime: WRAPPED_STALE_MS,
    gcTime: 2 * WRAPPED_STALE_MS,
    retry: 1,
  });
  return enabled && Boolean(wrapped.data);
}

/** Hide from Wrapped: saves, updates the signed-in user, and drops or re-reads the record. */
export function useSetWrappedHidden() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hidden: boolean) => wrappedApi.setHidden(hidden),
    meta: { silentError: true },
    onSuccess: (_, hidden) => {
      useAuthStore.getState().updateUser({ wrapped_hidden: hidden });
      void queryClient.invalidateQueries({ queryKey: wrappedKeys.all });
    },
  });
}
