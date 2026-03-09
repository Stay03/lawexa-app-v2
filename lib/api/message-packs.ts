import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type {
  IMessagePacksResponse,
  IMessagePackListParams,
  IPaygBalance,
  IMessagePackPurchaseData,
  IMessagePack,
  IUserLimits,
} from '@/types/message-pack';

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Get the authenticated user's message packs (paginated).
 */
async function list(params: IMessagePackListParams = {}): Promise<IMessagePacksResponse> {
  const response = await apiClient.get<IMessagePacksResponse>('/message-packs', {
    params: {
      status: params.status,
      page: params.page ?? 1,
      per_page: params.per_page ?? 15,
    },
  });
  return response.data;
}

/**
 * Get the user's total PAYG message balance.
 */
async function getBalance(): Promise<ApiResponse<IPaygBalance>> {
  const response = await apiClient.get<ApiResponse<IPaygBalance>>(
    '/message-packs/balance'
  );
  return response.data;
}

/**
 * Initialize a Paystack payment for message pack purchase.
 */
async function purchase(
  quantity: number,
  callbackUrl?: string
): Promise<ApiResponse<IMessagePackPurchaseData>> {
  const response = await apiClient.post<ApiResponse<IMessagePackPurchaseData>>(
    '/message-packs/purchase',
    {
      quantity,
      callback_url: callbackUrl || `${window.location.origin}/payg/callback`,
    }
  );
  return response.data;
}

/**
 * Verify a Paystack payment and complete the message pack purchase.
 */
async function verify(reference: string): Promise<ApiResponse<IMessagePack>> {
  const response = await apiClient.get<ApiResponse<IMessagePack>>(
    `/message-packs/verify/${encodeURIComponent(reference)}`
  );
  return response.data;
}

/**
 * Get the user's usage limits (plan + PAYG).
 */
async function getUserLimits(): Promise<ApiResponse<IUserLimits>> {
  const response = await apiClient.get<ApiResponse<IUserLimits>>(
    '/users/limits'
  );
  return response.data;
}

/******************************************************************************
                               Export default
******************************************************************************/

export const messagePacksApi = {
  list,
  getBalance,
  purchase,
  verify,
  getUserLimits,
} as const;
