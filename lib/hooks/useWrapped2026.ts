'use client';

import { useQuery } from '@tanstack/react-query';

import { wrappedApi } from '@/lib/api/wrapped';
import { useAuthStore } from '@/lib/stores/authStore';
import { WRAPPED_STALE_MS, wrappedSignedIn } from '@/lib/wrapped/access';
import { WRAPPED26_WINDOW_STALE_MS, wrapped2026Keys } from '@/lib/wrapped26/window';


/**
 * The signed-in person's Wrapped 2026, for the /wrapped route. `null` is "no
 * 2026 Wrapped": none built, hidden, or outside the window; the page then
 * falls back to the Bar Finals record. Every signed-in account asks: the
 * general edition covers everyone with activity this year.
 */
/** Whether Wrapped 2026 is open to everyone (the server's public window, cached five minutes). */
export function useWrapped2026Window() {
  return useQuery({
    queryKey: wrapped2026Keys.window,
    queryFn: wrappedApi.window2026,
    staleTime: WRAPPED26_WINDOW_STALE_MS,
    retry: 1,
  });
}

export function useWrapped2026(options: { enabled?: boolean } = {}) {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isGuest = useAuthStore((state) => state.isGuest);
  const signedIn = wrappedSignedIn({ token, user, isGuest });
  return useQuery({
    queryKey: wrapped2026Keys.me(user?.id ?? null),
    queryFn: wrappedApi.me2026,
    enabled: signedIn && (options.enabled ?? true),
    staleTime: WRAPPED_STALE_MS,
    gcTime: 2 * WRAPPED_STALE_MS,
    retry: 1,
  });
}
