import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { TCurrency } from '@/types/payment';
import type {
  IMessagePacksResponse,
  IMessagePackListParams,
  IPaygBalance,
  IMessagePackPurchaseData,
  IMessagePack,
  IMessagePackPricingData,
  IUserLimits,
} from '@/types/message-pack';

/******************************************************************************
                               Types
******************************************************************************/

interface IPurchaseInput {
  quantity: number;
  currency?: TCurrency;
  callbackUrl?: string;
}

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
 * Get per-currency pack pricing. Backend is the source of truth — the frontend
 * does NOT hardcode pack prices. Optionally filter to a single currency.
 */
async function getPricing(currency?: TCurrency): Promise<ApiResponse<IMessagePackPricingData>> {
  const response = await apiClient.get<ApiResponse<IMessagePackPricingData>>(
    '/message-packs/pricing',
    { params: currency ? { currency } : undefined }
  );
  return response.data;
}

/**
 * Initialize a payment session for a message pack purchase. Backend routes to
 * Paystack (NGN) or Flutterwave (USD) based on `currency`.
 */
async function purchase(input: IPurchaseInput): Promise<ApiResponse<IMessagePackPurchaseData>> {
  const response = await apiClient.post<ApiResponse<IMessagePackPurchaseData>>(
    '/message-packs/purchase',
    {
      quantity: input.quantity,
      callback_url: input.callbackUrl || `${window.location.origin}/payg/callback`,
      ...(input.currency ? { currency: input.currency } : {}),
    }
  );
  return response.data;
}

/**
 * Verify a payment reference and complete the message pack purchase. Accepts
 * either Paystack or Flutterwave references — backend dispatches by provider.
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
  getPricing,
  purchase,
  verify,
  getUserLimits,
} as const;
