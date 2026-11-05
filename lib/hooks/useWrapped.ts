'use client';

import { useQuery } from '@tanstack/react-query';

import { wrappedApi } from '@/lib/api/wrapped';
import { useAuthStore } from '@/lib/stores/authStore';
import { WRAPPED_STALE_MS, wrappedKeys, wrappedSignedIn } from '@/lib/wrapped/access';

/**
 * The signed-in student's Wrapped, for the /wrapped route (a root route, so it
 * uses the shared layers; v2's entry points read the same cache key through
 * v2/features/wrapped/queries.ts). `null` is "no Wrapped": none built, or
 * hidden. Not asked for a guest or when signed out.
 */
export function useWrapped(options: { enabled?: boolean } = {}) {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isGuest = useAuthStore((state) => state.isGuest);
  const signedIn = wrappedSignedIn({ token, user, isGuest });
  return useQuery({
    queryKey: wrappedKeys.me(user?.id ?? null),
    queryFn: wrappedApi.me,
    enabled: signedIn && (options.enabled ?? true),
    staleTime: WRAPPED_STALE_MS,
    gcTime: 2 * WRAPPED_STALE_MS,
    retry: 1,
  });
}
