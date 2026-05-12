// Admin Paystack Webhook Inspection Types
// Backed by GET /api/admin/paystack-webhooks(/{id})(/replay)

import type { CursorPaginatedResponse } from './admin-activity';

export const PAYSTACK_WEBHOOK_PROCESSING_STATUSES = [
  'received',
  'processed',
  'skipped_duplicate',
  'skipped_unhandled',
  'failed_signature',
  'failed_processing',
] as const;

export type PaystackWebhookProcessingStatus =
  (typeof PAYSTACK_WEBHOOK_PROCESSING_STATUSES)[number];

export const PAYSTACK_HANDLED_EVENT_TYPES = [
  'charge.success',
  'subscription.create',
  'subscription.disable',
  'subscription.not_renew',
  'invoice.create',
  'invoice.payment_failed',
  'refund.pending',
  'refund.processing',
  'refund.processed',
  'refund.failed',
  'refund.needs-attention',
] as const;

export const PAYSTACK_UNHANDLED_EVENT_TYPES = [
  'charge.dispute.create',
  'charge.dispute.remind',
  'charge.dispute.resolve',
  'invoice.update',
  'subscription.enable',
  'paymentrequest.pending',
  'paymentrequest.success',
  'customeridentification.failed',
  'customeridentification.success',
] as const;

export type KnownPaystackEventType =
  | (typeof PAYSTACK_HANDLED_EVENT_TYPES)[number]
  | (typeof PAYSTACK_UNHANDLED_EVENT_TYPES)[number];

// Stays open — backend may surface new Paystack event types over time.
export type PaystackEventType = KnownPaystackEventType | (string & {});

export interface PaystackWebhookSubject {
  type: string;
  id: number;
}

export interface PaystackWebhookUser {
  id: number;
  uuid: string;
  name: string | null;
  email: string | null;
}

export interface PaystackWebhookRow {
  id: number;
  event_id: string;
  event_type: PaystackEventType;
  signature_valid: boolean;
  processing_status: PaystackWebhookProcessingStatus;
  subject: PaystackWebhookSubject | null;
  user: PaystackWebhookUser | null;
  last_replayed_by: PaystackWebhookUser | null;
  payload_size: number;
  payload_truncated: boolean;
  processing_attempts: number;
  error_message: string | null;
  processed_at: string | null;
  replayed_at: string | null;
  created_at: string;
}

export interface PaystackWebhookDetail extends PaystackWebhookRow {
  payload: Record<string, unknown>;
  payload_raw: string;
  headers: Record<string, string>;
  summary: string;
}

export interface PaystackWebhookListParams {
  event_type?: PaystackEventType[];
  processing_status?: PaystackWebhookProcessingStatus[];
  signature_valid?: boolean;
  user_id?: number;
  event_id?: string;
  reference?: string;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  cursor?: string;
}

export type PaystackWebhookListResponse =
  CursorPaginatedResponse<PaystackWebhookRow>;

export interface PaystackWebhookDetailResponse {
  success: boolean;
  message: string;
  data: PaystackWebhookDetail;
}

export type PaystackWebhookReplayResponse = PaystackWebhookDetailResponse;
