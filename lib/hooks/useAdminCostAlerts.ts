'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { adminCostAlertsApi } from '@/lib/api/admin-cost-alerts';
import type { CostAlertsParams } from '@/types/admin-cost-alerts';

export const adminCostAlertKeys = {
  all: ['admin', 'cost-alerts'] as const,
  list: (params: CostAlertsParams) => [...adminCostAlertKeys.all, 'list', params] as const,
};

/** One page of cost alerts. The numbers change once a day (06:00 UTC), so a minute's freshness is plenty. */
export function useAdminCostAlerts(params: CostAlertsParams) {
  return useQuery({
    queryKey: adminCostAlertKeys.list(params),
    queryFn: () => adminCostAlertsApi.list(params),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
}
