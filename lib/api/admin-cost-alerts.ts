// Admin cost alerts: GET /api/admin/cost-alerts (admin and superadmin).
// Backend's contract, 18 November 2026 (thread dfa0d9b8).

import { apiClient } from './client';
import type { CostAlertsParams, CostAlertsResponse } from '@/types/admin-cost-alerts';

async function list(params: CostAlertsParams = {}): Promise<CostAlertsResponse> {
  const response = await apiClient.get<CostAlertsResponse>('/admin/cost-alerts', { params });
  return response.data;
}

export const adminCostAlertsApi = { list };
