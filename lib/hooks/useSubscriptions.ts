'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '@/lib/api/subscriptions';
import { useAuthStore } from '@/lib/stores/authStore';
import type { TCurrency, PaymentVerifyRef } from '@/types/payment';
import type { IInvoiceListParams } from '@/types/subscription';

/******************************************************************************
                               Constants
******************************************************************************/

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  plans: () => [...subscriptionKeys.all, 'plans'] as const,
  current: () => [...subscriptionKeys.all, 'current'] as const,
  invoices: (params: IInvoiceListParams) =>
    [...subscriptionKeys.all, 'invoices', params] as const,
};

/******************************************************************************
                               Types
******************************************************************************/

interface IInitializeInput {
  planId: number;
  currency?: TCurrency;
}

/******************************************************************************
                               Query Hooks
******************************************************************************/

/**
 * Fetch all active plans.
 */
export function usePlans() {
  return useQuery({
    queryKey: subscriptionKeys.plans(),
    queryFn: () => subscriptionsApi.getPlans(),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch the current user's subscription status.
 */
export function useCurrentSubscription() {
  const { isAuthenticated, isGuest } = useAuthStore();
  return useQuery({
    queryKey: subscriptionKeys.current(),
    queryFn: () => subscriptionsApi.getCurrent(),
    staleTime: 1 * 60 * 1000,
    enabled: isAuthenticated && !isGuest,
  });
}

/**
 * Fetch paginated invoices.
 */
export function useInvoices(params: IInvoiceListParams = {}) {
  return useQuery({
    queryKey: subscriptionKeys.invoices(params),
    queryFn: () => subscriptionsApi.getInvoices(params),
    staleTime: 2 * 60 * 1000,
  });
}

/******************************************************************************
                               Mutation Hooks
******************************************************************************/

/**
 * Subscribe to the free plan.
 */
export function useSubscribeFree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: number) => subscriptionsApi.subscribeFree(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.plans() });
    },
  });
}

/**
 * Initialize a payment session for a paid plan.
 */
export function useInitializePayment() {
  return useMutation({
    mutationFn: (input: IInitializeInput) => subscriptionsApi.initializePayment(input),
  });
}

/**
 * Verify a payment reference.
 */
export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ref: PaymentVerifyRef) => subscriptionsApi.verifyPayment(ref),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.invoices({}) });
    },
  });
}

/**
 * Initialize an upgrade to a higher plan.
 */
export function useInitializeUpgrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IInitializeInput) => subscriptionsApi.initializeUpgrade(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
    },
  });
}

/**
 * Verify an upgrade payment reference.
 */
export function useVerifyUpgrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ref: PaymentVerifyRef) => subscriptionsApi.verifyUpgrade(ref),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.invoices({}) });
    },
  });
}

/**
 * Cancel the current paid subscription.
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => subscriptionsApi.cancel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
    },
  });
}
