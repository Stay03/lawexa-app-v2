// Admin Paystack Webhook Inspection - API Service Layer
// Backs GET /api/admin/paystack-webhooks, GET /admin/paystack-webhooks/{id},
// and POST /admin/paystack-webhooks/{id}/replay

import { apiClient } from './client';
import type {
  PaystackWebhookDetailResponse,
  PaystackWebhookListParams,
  PaystackWebhookListResponse,
  PaystackWebhookReplayResponse,
} from '@/types/admin-paystack-webhooks';

// Axios serializes array values as `key[]=a&key[]=b`, matching Laravel's
// expected `event_type[]` / `processing_status[]` query format.
async function list(
  params: PaystackWebhookListParams = {}
): Promise<PaystackWebhookListResponse> {
  const response = await apiClient.get<PaystackWebhookListResponse>(
    '/admin/paystack-webhooks',
    { params }
  );
  return response.data;
}

async function get(id: number): Promise<PaystackWebhookDetailResponse> {
  const response = await apiClient.get<PaystackWebhookDetailResponse>(
    `/admin/paystack-webhooks/${id}`
  );
  return response.data;
}

async function replay(id: number): Promise<PaystackWebhookReplayResponse> {
  const response = await apiClient.post<PaystackWebhookReplayResponse>(
    `/admin/paystack-webhooks/${id}/replay`
  );
  return response.data;
}

export const adminPaystackWebhooksApi = { list, get, replay };
