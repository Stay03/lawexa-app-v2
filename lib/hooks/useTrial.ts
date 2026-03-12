'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trialApi } from '@/lib/api/trial';
import { subscriptionKeys } from '@/lib/hooks/useSubscriptions';

/******************************************************************************
                               Constants
******************************************************************************/

export const trialKeys = {
  all: ['trial'] as const,
  eligibility: (planId?: number) => [...trialKeys.all, 'eligibility', planId] as const,
  status: () => [...trialKeys.all, 'status'] as const,
};

/******************************************************************************
                               Query Hooks
******************************************************************************/

/**
 * Check trial eligibility for the current user.
 */
export function useTrialEligibility(planId?: number) {
  return useQuery({
    queryKey: trialKeys.eligibility(planId),
    queryFn: () => trialApi.checkEligibility(planId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch the current user's most recent trial status.
 */
export function useTrialStatus(enabled: boolean = true) {
  return useQuery({
    queryKey: trialKeys.status(),
    queryFn: () => trialApi.getStatus(),
    staleTime: 1 * 60 * 1000,
    enabled,
  });
}

/******************************************************************************
                               Mutation Hooks
******************************************************************************/

/**
 * Initialize a trial via Paystack tokenization.
 */
export function useStartTrial() {
  return useMutation({
    mutationFn: (planId: number) => trialApi.startTrial(planId),
  });
}

/**
 * Verify a trial tokenization payment reference.
 */
export function useVerifyTrial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) => trialApi.verifyTrial(reference),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      queryClient.invalidateQueries({ queryKey: trialKeys.status() });
      queryClient.invalidateQueries({ queryKey: trialKeys.eligibility() });
    },
  });
}

/**
 * Cancel the current active trial.
 */
export function useCancelTrial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => trialApi.cancelTrial(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      queryClient.invalidateQueries({ queryKey: trialKeys.status() });
      queryClient.invalidateQueries({ queryKey: trialKeys.eligibility() });
    },
  });
}
