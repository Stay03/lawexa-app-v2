import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { TCurrency, PaymentVerifyRef } from '@/types/payment';
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
                               Types
******************************************************************************/

interface IInitializePaymentInput {
  planId: number;
  currency?: TCurrency;
  callbackUrl?: string;
}

interface IInitializeUpgradeInput {
  planId: number;
  currency?: TCurrency;
  callbackUrl?: string;
}

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Get all active plans sorted by sort_order. Backend includes both currency
 * variants when the Flutterwave kill switch is on; FW plans are filtered when off.
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
 * Initialize a payment session for a paid plan. Backend routes to Paystack
 * (NGN) or Flutterwave (USD) based on the plan's currency; the explicit
 * `currency` field must match `plan.currency` if sent.
 */
async function initializePayment(
  input: IInitializePaymentInput
): Promise<ApiResponse<IPaymentInitData>> {
  const response = await apiClient.post<ApiResponse<IPaymentInitData>>(
    '/subscriptions/initialize',
    {
      plan_id: input.planId,
      callback_url: input.callbackUrl || `${window.location.origin}/subscription/callback`,
      ...(input.currency ? { currency: input.currency } : {}),
    }
  );
  return response.data;
}

/**
 * Verify a payment reference. Backend dispatches on the query-param NAME:
 * Paystack expects `reference`, Flutterwave expects `tx_ref`. The caller
 * passes a discriminated union built from the callback URL.
 */
async function verifyPayment(ref: PaymentVerifyRef): Promise<ApiResponse<ISubscription>> {
  const response = await apiClient.get<ApiResponse<ISubscription>>(
    '/subscriptions/verify',
    { params: ref }
  );
  return response.data;
}

/**
 * Initialize an upgrade to a higher-priced plan. Cross-currency upgrades are
 * rejected by backend with HTTP 422 — caller should hide the CTA when the
 * current subscription's currency differs from the target plan's.
 */
async function initializeUpgrade(
  input: IInitializeUpgradeInput
): Promise<ApiResponse<IUpgradeInitData | IUpgradeCompleteData>> {
  const response = await apiClient.post<ApiResponse<IUpgradeInitData | IUpgradeCompleteData>>(
    '/subscriptions/upgrade',
    {
      plan_id: input.planId,
      callback_url: input.callbackUrl || `${window.location.origin}/subscription/upgrade/callback`,
      ...(input.currency ? { currency: input.currency } : {}),
    }
  );
  return response.data;
}

/**
 * Verify an upgrade payment and complete the plan switch. Same param-name
 * dispatch rule as `verifyPayment`.
 */
async function verifyUpgrade(ref: PaymentVerifyRef): Promise<ApiResponse<IUpgradeCompleteData>> {
  const response = await apiClient.get<ApiResponse<IUpgradeCompleteData>>(
    '/subscriptions/upgrade/verify',
    { params: ref }
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
