'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagePacksApi } from '@/lib/api/message-packs';
import { userLimitsKeys } from '@/lib/hooks/useUserLimits';
import type { IMessagePackListParams } from '@/types/message-pack';

/******************************************************************************
                               Constants
******************************************************************************/

export const messagePackKeys = {
  all: ['messagePacks'] as const,
  list: (params: IMessagePackListParams) =>
    [...messagePackKeys.all, 'list', params] as const,
  balance: () => [...messagePackKeys.all, 'balance'] as const,
};

/******************************************************************************
                               Query Hooks
******************************************************************************/

/**
 * Fetch paginated message packs.
 */
export function useMessagePacks(params: IMessagePackListParams = {}) {
  return useQuery({
    queryKey: messagePackKeys.list(params),
    queryFn: () => messagePacksApi.list(params),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch the user's PAYG message balance.
 */
export function usePaygBalance() {
  return useQuery({
    queryKey: messagePackKeys.balance(),
    queryFn: () => messagePacksApi.getBalance(),
    staleTime: 1 * 60 * 1000,
  });
}

/******************************************************************************
                               Mutation Hooks
******************************************************************************/

/**
 * Initialize a message pack purchase via Paystack.
 */
export function usePurchaseMessagePack() {
  return useMutation({
    mutationFn: (quantity: number) => messagePacksApi.purchase(quantity),
  });
}

/**
 * Verify a message pack payment reference.
 */
export function useVerifyMessagePack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) => messagePacksApi.verify(reference),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagePackKeys.balance() });
      queryClient.invalidateQueries({ queryKey: messagePackKeys.all });
      queryClient.invalidateQueries({ queryKey: userLimitsKeys.all });
    },
  });
}
