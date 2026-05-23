import type { PaymentVerifyRef } from '@/types/payment';

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Extract a payment verification reference from a callback URL's search params.
 *
 * Paystack redirects with `?reference=` or `?trxref=`; Flutterwave redirects
 * with `?tx_ref=` plus `?transaction_id=`. The two providers are mutually
 * exclusive on real redirects, so first match wins and the returned shape
 * tells the API client which query param the backend should see.
 */
export function extractPaymentRef(params: URLSearchParams): PaymentVerifyRef | null {
  const txRef = params.get('tx_ref');
  if (txRef) return { tx_ref: txRef };
  const reference = params.get('reference') ?? params.get('trxref');
  if (reference) return { reference };
  return null;
}

/**
 * The raw reference string carried by a `PaymentVerifyRef`, regardless of
 * which provider it came from. Used for path-based verify endpoints (PAYG)
 * where backend identifies the provider by other means.
 */
export function refValue(ref: PaymentVerifyRef): string {
  return 'tx_ref' in ref ? ref.tx_ref : ref.reference;
}
