// Shared payment domain types. Mirrors the backend contract at
// docs/flutterwave-integration/frontend-contract.md (lawexa-api-v3 repo).

export type TCurrency = 'NGN' | 'USD';
export type TPaymentProvider = 'paystack' | 'flutterwave';

// Geo lookup — see docs/backend-geo-endpoint-request.md
export interface IGeoCountryData {
  country_code: string | null;
  country_name: string | null;
  suggested_currency: TCurrency;
}

/**
 * Payment verification reference. Backend dispatches by the param NAME, not
 * the value — Paystack must arrive as `reference`, Flutterwave as `tx_ref`.
 * The discriminated union encodes which provider routed the redirect so the
 * API client sends the right query param.
 */
export type PaymentVerifyRef =
  | { tx_ref: string }
  | { reference: string };
