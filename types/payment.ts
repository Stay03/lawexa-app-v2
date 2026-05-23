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
