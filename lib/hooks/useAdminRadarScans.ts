'use client';

import { useQuery } from '@tanstack/react-query';
import { adminRadarScansApi } from '@/lib/api/admin-radar-scans';
import type { RadarScansParams } from '@/types/admin-radar-scans';

export const radarScanKeys = {
  all: ['admin', 'radar-scans'] as const,
  lists: () => [...radarScanKeys.all, 'list'] as const,
  list: (params: RadarScansParams) => [...radarScanKeys.lists(), params] as const,
  summary: () => [...radarScanKeys.all, 'summary'] as const,
};

const IN_FLIGHT = new Set(['queued', 'running']);

export function useRadarScans(params: RadarScansParams = {}) {
  return useQuery({
    queryKey: radarScanKeys.list(params),
    queryFn: () => adminRadarScansApi.getScans(params),
    staleTime: 15 * 1000,
    refetchInterval: (query) =>
      query.state.data?.data?.some((s) => IN_FLIGHT.has(s.status)) ? 30 * 1000 : false,
  });
}

export function useRadarScanSummary() {
  return useQuery({
    queryKey: radarScanKeys.summary(),
    queryFn: () => adminRadarScansApi.getScanSummary(),
    staleTime: 15 * 1000,
    refetchInterval: (query) => {
      const scans = query.state.data?.data?.scans;
      return scans && (scans.running > 0 || scans.queued > 0) ? 30 * 1000 : false;
    },
  });
}
