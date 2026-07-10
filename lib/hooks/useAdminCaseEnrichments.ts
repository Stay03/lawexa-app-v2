'use client';

import { useQuery } from '@tanstack/react-query';
import { adminCaseEnrichmentsApi } from '@/lib/api/admin-case-enrichments';
import type { CaseEnrichmentsParams } from '@/types/admin-case-enrichments';

/******************************************************************************
                            Query Key Factory
******************************************************************************/

export const caseEnrichmentKeys = {
  all: ['admin', 'case-enrichments'] as const,
  lists: () => [...caseEnrichmentKeys.all, 'list'] as const,
  list: (params: CaseEnrichmentsParams) =>
    [...caseEnrichmentKeys.lists(), params] as const,
  detail: (id: number) => [...caseEnrichmentKeys.all, 'detail', id] as const,
  summary: () => [...caseEnrichmentKeys.all, 'summary'] as const,
};

/******************************************************************************
                                Hooks
******************************************************************************/

/**
 * List enrichment runs. While any run is in-flight the list is polled every
 * 30s so status transitions (running → completed/failed) surface on their own.
 */
export function useCaseEnrichments(params: CaseEnrichmentsParams = {}) {
  return useQuery({
    queryKey: caseEnrichmentKeys.list(params),
    queryFn: () => adminCaseEnrichmentsApi.getEnrichments(params),
    staleTime: 15 * 1000,
    refetchInterval: (query) =>
      query.state.data?.data?.some((run) => run.status === 'running')
        ? 30 * 1000
        : false,
  });
}

/** Fetch a single enrichment run. */
export function useCaseEnrichment(
  id: number | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: caseEnrichmentKeys.detail(id ?? 0),
    queryFn: () => adminCaseEnrichmentsApi.getEnrichment(id!),
    enabled: !!id && options?.enabled !== false,
    staleTime: 15 * 1000,
  });
}

/**
 * Dashboard summary. Polls every 30s while runs are active so the progress bar
 * advances live during a backfill.
 */
export function useCaseEnrichmentSummary() {
  return useQuery({
    queryKey: caseEnrichmentKeys.summary(),
    queryFn: () => adminCaseEnrichmentsApi.getEnrichmentSummary(),
    staleTime: 15 * 1000,
    refetchInterval: (query) =>
      (query.state.data?.data?.runs?.running ?? 0) > 0 ? 30 * 1000 : false,
  });
}
