'use client';

import { useQuery } from '@tanstack/react-query';
import { ambassadorsApi } from '@/lib/api/ambassadors';

export const ambassadorKeys = {
  all: ['ambassador'] as const,
  myApplication: () => [...ambassadorKeys.all, 'my-application'] as const,
};

/**
 * Fetch the signed-in user's ambassador application (or `data: null` if none).
 *
 * Gated by `enabled` so the authenticated call only fires for the audience that
 * could actually see the popup — mirrors useUserLimits, which keeps `/` from
 * making needless real-user requests for guests. Not retried: a "no application"
 * response (or 404) should resolve immediately to "hasn't applied".
 */
export function useMyAmbassadorApplication(enabled: boolean) {
  return useQuery({
    queryKey: ambassadorKeys.myApplication(),
    queryFn: () => ambassadorsApi.getMyApplication(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
