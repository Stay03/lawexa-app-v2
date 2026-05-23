import type { TCurrency, TPaymentProvider } from '@/types/payment';

// Message pack statuses
export type TMessagePackStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// Message pack resource
export interface IMessagePack {
  id: number;
  quantity: number;
  messages_total: number;
  messages_remaining: number;
  amount: number;
  formatted_amount: string;
  currency: TCurrency;
  provider: TPaymentProvider;
  status: TMessagePackStatus;
  status_label: string;
  paid_at: string | null;
  created_at: string;
}

// POST /message-packs/purchase response data
export interface IMessagePackPurchaseData {
  authorization_url: string;
  access_code: string;
  reference: string;
  provider: TPaymentProvider;
  quantity: number;
  messages: number;
  amount: number;
  currency: TCurrency;
}

// GET /message-packs/pricing — one row per currency the backend offers
export interface IMessagePackPriceRow {
  currency: TCurrency;
  provider: TPaymentProvider;
  // Minor units (kobo for NGN, cents for USD). Source of truth for arithmetic.
  price_minor: number;
  // Major units (naira / dollars). Convenience for display.
  price_major: number;
}

// GET /message-packs/pricing response data
export interface IMessagePackPricingData {
  messages_per_pack: number;
  prices: IMessagePackPriceRow[];
}

// GET /message-packs/balance response data
export interface IPaygBalance {
  payg_remaining: number;
}

// GET /message-packs response
export interface IMessagePacksResponse {
  success: boolean;
  message: string;
  data: IMessagePack[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number | null;
    to: number | null;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}

// Message pack list query params
export interface IMessagePackListParams {
  status?: TMessagePackStatus;
  page?: number;
  per_page?: number;
}

// Block reasons surfaced when AI message sending is gated server-side.
export type TBlockedReasonCode =
  | 'free_no_subscription'
  | 'plan_exhausted'
  | 'account_flagged'
  | 'hard_limit'
  | 'cancelled_grace_exhausted';

export interface IBlockedReason {
  code: string;
  reason: TBlockedReasonCode;
  message: string;
  plan_remaining: number;
  payg_remaining: number;
  resets_at: string | null;
  subscription_ends_at: string | null;
}

// AI messages limit from GET /users/limits
export interface IAiMessagesLimit {
  limit_type: 'ai_messages';
  plan_limit: number | null;
  hard_limit: number | null;
  used: number;
  remaining: number | null;
  // Null for lifetime/cumulative limits — render no countdown when null.
  resets_at: string | null;
  payg_remaining: number;
  total_remaining: number | null;
  reset_message: string;
  blocked_reason: IBlockedReason | null;
}

// Generic limit shape for other limit types
export interface IGenericLimit {
  limit_type: string;
  plan_limit: number | null;
  hard_limit: number | null;
  used: number;
  remaining: number | null;
  resets_at: string | null;
}

// Plan + subscription summary bundled into the limits payload.
export type TPlanInterval = 'daily' | 'weekly' | 'monthly' | 'annually' | string;
export type TPlanSubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'trialing'
  | 'expired';

export interface IUserLimitsPlanSubscription {
  status: TPlanSubscriptionStatus;
  start_date: string;
  next_payment_date: string | null;
  ends_at: string | null;
}

export interface IUserLimitsPlan {
  name: string;
  slug: string;
  interval: TPlanInterval;
  is_free: boolean;
  subscription: IUserLimitsPlanSubscription | null;
}

export interface IUserLimitsPayg {
  balance: number;
}

// GET /users/limits response data
export interface IUserLimits {
  plan: IUserLimitsPlan;
  payg: IUserLimitsPayg;
  note_creations: IGenericLimit;
  bookmarks: IGenericLimit;
  ai_messages: IAiMessagesLimit;
}
