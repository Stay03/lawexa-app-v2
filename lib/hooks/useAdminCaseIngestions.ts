'use client';

import { useQuery } from '@tanstack/react-query';
import { adminCaseIngestionsApi } from '@/lib/api/admin-case-ingestions';
import type { CaseIngestionsParams } from '@/types/admin-case-ingestions';

export const caseIngestionKeys = {
  all: ['admin', 'case-ingestions'] as const,
  lists: () => [...caseIngestionKeys.all, 'list'] as const,
  list: (params: CaseIngestionsParams) => [...caseIngestionKeys.lists(), params] as const,
  detail: (id: string) => [...caseIngestionKeys.all, 'detail', id] as const,
  summary: () => [...caseIngestionKeys.all, 'summary'] as const,
};

const IN_FLIGHT = new Set(['pending', 'running']);

export function useCaseIngestions(params: CaseIngestionsParams = {}) {
  return useQuery({
    queryKey: caseIngestionKeys.list(params),
    queryFn: () => adminCaseIngestionsApi.getIngestions(params),
    staleTime: 15 * 1000,
    refetchInterval: (query) =>
      query.state.data?.data?.some((j) => IN_FLIGHT.has(j.status)) ? 30 * 1000 : false,
  });
}

export function useCaseIngestionSummary() {
  return useQuery({
    queryKey: caseIngestionKeys.summary(),
    queryFn: () => adminCaseIngestionsApi.getIngestionSummary(),
    staleTime: 15 * 1000,
    refetchInterval: (query) => {
      const jobs = query.state.data?.data?.jobs;
      return jobs && (jobs.running > 0 || jobs.pending > 0) ? 30 * 1000 : false;
    },
  });
}
