'use client';

import { useQuery } from '@tanstack/react-query';
import { messagePacksApi } from '@/lib/api/message-packs';
import { useAuthStore } from '@/lib/stores/authStore';

/******************************************************************************
                               Constants
******************************************************************************/

export const userLimitsKeys = {
  all: ['userLimits'] as const,
  limits: () => [...userLimitsKeys.all, 'limits'] as const,
};

/******************************************************************************
                               Query Hooks
******************************************************************************/

/**
 * Fetch the user's usage limits (plan messages, PAYG, etc.).
 *
 * Disabled for guests and unauthenticated visitors — the endpoint requires a
 * real-user Bearer token, and a 401 here on a non-guest-allowlisted page (e.g. `/`)
 * would trip the axios interceptor's redirect-to-/login fallback.
 */
export function useUserLimits() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);

  return useQuery({
    queryKey: userLimitsKeys.limits(),
    queryFn: () => messagePacksApi.getUserLimits(),
    enabled: isAuthenticated && !isGuest,
    staleTime: 1 * 60 * 1000,
  });
}
