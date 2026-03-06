import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type {
  IPlansResponse,
  ICurrentSubscriptionData,
  ISubscription,
  IPaymentInitData,
  IUpgradeInitData,
  IUpgradeCompleteData,
  IInvoicesResponse,
  IInvoiceListParams,
} from '@/types/subscription';

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Get all active plans sorted by sort_order.
 */
async function getPlans(): Promise<IPlansResponse> {
  const response = await apiClient.get<IPlansResponse>('/subscriptions/plans');
  return response.data;
}

/**
 * Get the current user's subscription status.
 */
async function getCurrent(): Promise<ApiResponse<ICurrentSubscriptionData>> {
  const response = await apiClient.get<ApiResponse<ICurrentSubscriptionData>>(
    '/subscriptions/current'
  );
  return response.data;
}

/**
 * Subscribe to the free plan.
 */
async function subscribeFree(planId: number): Promise<ApiResponse<ISubscription>> {
  const response = await apiClient.post<ApiResponse<ISubscription>>(
    '/subscriptions/subscribe',
    { plan_id: planId }
  );
  return response.data;
}

/**
 * Initialize a Paystack payment session for a paid plan.
 */
async function initializePayment(
  planId: number,
  callbackUrl?: string
): Promise<ApiResponse<IPaymentInitData>> {
  const response = await apiClient.post<ApiResponse<IPaymentInitData>>(
    '/subscriptions/initialize',
    {
      plan_id: planId,
      callback_url: callbackUrl || `${window.location.origin}/subscription/callback`,
    }
  );
  return response.data;
}

/**
 * Verify a Paystack payment and create the subscription.
 */
async function verifyPayment(reference: string): Promise<ApiResponse<ISubscription>> {
  const response = await apiClient.get<ApiResponse<ISubscription>>(
    '/subscriptions/verify',
    { params: { reference } }
  );
  return response.data;
}

/**
 * Initialize an upgrade to a higher-priced plan.
 */
async function initializeUpgrade(
  planId: number,
  callbackUrl?: string
): Promise<ApiResponse<IUpgradeInitData | IUpgradeCompleteData>> {
  const response = await apiClient.post<ApiResponse<IUpgradeInitData | IUpgradeCompleteData>>(
    '/subscriptions/upgrade',
    {
      plan_id: planId,
      callback_url: callbackUrl || `${window.location.origin}/subscription/upgrade/callback`,
    }
  );
  return response.data;
}

/**
 * Verify an upgrade payment and complete the plan switch.
 */
async function verifyUpgrade(reference: string): Promise<ApiResponse<IUpgradeCompleteData>> {
  const response = await apiClient.get<ApiResponse<IUpgradeCompleteData>>(
    '/subscriptions/upgrade/verify',
    { params: { reference } }
  );
  return response.data;
}

/**
 * Cancel the current paid subscription.
 */
async function cancel(): Promise<ApiResponse<ISubscription>> {
  const response = await apiClient.post<ApiResponse<ISubscription>>(
    '/subscriptions/cancel'
  );
  return response.data;
}

/**
 * Get paginated invoice history.
 */
async function getInvoices(params: IInvoiceListParams = {}): Promise<IInvoicesResponse> {
  const response = await apiClient.get<IInvoicesResponse>(
    '/subscriptions/invoices',
    {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
      },
    }
  );
  return response.data;
}

/******************************************************************************
                               Export default
******************************************************************************/

export const subscriptionsApi = {
  getPlans,
  getCurrent,
  subscribeFree,
  initializePayment,
  verifyPayment,
  initializeUpgrade,
  verifyUpgrade,
  cancel,
  getInvoices,
} as const;
