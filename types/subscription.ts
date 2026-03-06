// Limit types
export type TLimitType = 'ai_messages' | 'bookmarks' | 'note_creations';
export type TLimitPeriod = 'month' | 'billing_interval' | 'lifetime';

// Subscription statuses
export type TSubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired' | 'trialing';

// Invoice statuses
export type TInvoiceStatus = 'pending' | 'success' | 'failed';

// Plan limit
export interface IPlanLimit {
  type: TLimitType;
  value: number;
  is_unlimited: boolean;
  period: TLimitPeriod;
}

// Plan
export interface IPlan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  amount: string;
  formatted_amount: string;
  currency: string;
  interval: string;
  interval_label: string;
  interval_count: number;
  is_free: boolean;
  is_featured: boolean;
  features: string[];
  limits: IPlanLimit[];
}

// Subscription
export interface ISubscription {
  id: number;
  plan: IPlan;
  status: TSubscriptionStatus;
  status_label: string;
  amount: string;
  currency: string;
  start_date: string;
  next_payment_date: string | null;
  cancelled_at: string | null;
  ends_at: string | null;
  days_until_renewal: number | null;
  is_in_grace_period: boolean;
  has_access: boolean;
  created_at: string;
}

// GET /subscriptions/current response data
export interface ICurrentSubscriptionData {
  subscription: ISubscription | null;
  plan: IPlan;
  is_free_tier: boolean;
}

// Proration details for upgrades
export interface IProration {
  remaining_days: number;
  credit: number;
  new_amount: number;
  effective_immediately: boolean;
}

// POST /subscriptions/initialize response data
export interface IPaymentInitData {
  authorization_url: string;
  access_code: string;
  reference: string;
  plan?: IPlan;
  proration?: IProration;
}

// POST /subscriptions/upgrade response data (when payment required)
export interface IUpgradeInitData {
  authorization_url: string;
  access_code: string;
  reference: string;
  proration?: IProration;
}

// POST /subscriptions/upgrade response data (when proration covers cost)
export interface IUpgradeCompleteData {
  subscription: ISubscription;
  proration?: IProration;
}

// Invoice
export interface IInvoice {
  id: number;
  invoice_code: string;
  amount: string;
  formatted_amount: string;
  currency: string;
  status: TInvoiceStatus;
  status_label: string;
  paid: boolean;
  paid_at: string | null;
  period_start: string;
  period_end: string;
  description: string | null;
  created_at: string;
}

// GET /subscriptions/plans response
export interface IPlansResponse {
  success: boolean;
  message: string;
  data: IPlan[];
}

// GET /subscriptions/invoices response
export interface IInvoicesResponse {
  success: boolean;
  message: string;
  data: IInvoice[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number | null;
    to: number | null;
  };
}

// Invoice list params
export interface IInvoiceListParams {
  page?: number;
  per_page?: number;
}
