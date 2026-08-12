// System health — the one call behind the operations dashboard's health panel.
import { apiClient } from './client';
import type { SystemHealthResponse } from '@/types/system-health';

/** `GET /api/health`. Answers without a token (measured 2026-08-12); it is sent
 *  through the usual client anyway so it shares the base URL and interceptors
 *  rather than becoming a second way of talking to the API. */
async function getHealth(): Promise<SystemHealthResponse> {
  const response = await apiClient.get<SystemHealthResponse>('/health');
  return response.data;
}

export const systemHealthApi = {
  getHealth,
};
