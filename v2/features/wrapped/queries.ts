'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { wrappedApi } from '@/lib/api/wrapped';
import { useAuthStore } from '@/lib/stores/authStore';
import { WRAPPED_STALE_MS, mayHaveWrapped, wrappedAskable, wrappedKeys, wrappedRunning } from '@/lib/wrapped/access';
import { useV2Session } from '@/v2/runtime/session-context';
import { WRAPPED26_WINDOW_STALE_MS, wrapped26Askable, wrapped2026Keys } from '@/lib/wrapped26/window';

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

/**
 * True when the signed-in person has a Wrapped 2026 record: the home banner
 * then offers the 2026 story in place of the Bar Finals one. Asked only once
 * the server's window is open, or by a staff account (who sees it early), so
 * no other account sends a request before launch. The record shares the
 * /wrapped route's cache key, so opening the story reads no second time.
 */
export function useHasWrapped2026(): boolean {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isGuest = useAuthStore((state) => state.isGuest);
  const session = useV2Session();
  const window = useQuery({ queryKey: wrapped2026Keys.window, queryFn: wrappedApi.window2026, staleTime: WRAPPED26_WINDOW_STALE_MS, retry: 1 });
  const open = window.data?.open === true;
  const enabled = wrapped26Askable({
    signedIn: Boolean(token && user && !isGuest),
    hidden: user?.wrapped_hidden ?? session.wrappedHidden,
    open,
    role: session.role,
  });
  const record = useQuery({
    queryKey: wrapped2026Keys.me(user?.id ?? null),
    queryFn: wrappedApi.me2026,
    enabled,
    staleTime: WRAPPED_STALE_MS,
    gcTime: 2 * WRAPPED_STALE_MS,
    retry: 1,
  });
  return enabled && Boolean(record.data);
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
      void queryClient.invalidateQueries({ queryKey: wrapped2026Keys.all });
    },
  });
}
