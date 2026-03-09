'use client';

import { useQuery } from '@tanstack/react-query';
import { messagePacksApi } from '@/lib/api/message-packs';

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
 */
export function useUserLimits() {
  return useQuery({
    queryKey: userLimitsKeys.limits(),
    queryFn: () => messagePacksApi.getUserLimits(),
    staleTime: 1 * 60 * 1000,
  });
}
