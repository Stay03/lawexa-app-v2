import type { IPlan, ISubscription } from '@/types/subscription';

// Trial statuses
export type TTrialStatus = 'pending' | 'active' | 'converted' | 'cancelled' | 'expired' | 'aborted';

// Refund statuses
export type TRefundStatus = 'pending' | 'processed' | 'failed';

// GET /trial/eligibility response data
export interface ITrialEligibilityData {
  trial_enabled: boolean;
  user_eligible: boolean;
  plan_eligible?: boolean;
}

// POST /trial/start response data
export interface ITrialStartData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

// Full trial object (verify, status, cancel responses)
export interface ITrialData {
  id: number;
  plan: IPlan;
  status: TTrialStatus;
  status_label: string;
  card_last4: string | null;
  card_type: string | null;
  refund_status: TRefundStatus | null;
  subscription: ISubscription | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}
