'use client';

import { useQuery } from '@tanstack/react-query';
import { casesApi } from '@/lib/api/cases';
import type { CaseListParams } from '@/types/case';

// Query keys factory
export const caseKeys = {
  all: ['cases'] as const,
  lists: () => [...caseKeys.all, 'list'] as const,
  list: (params: CaseListParams) => [...caseKeys.lists(), params] as const,
  details: () => [...caseKeys.all, 'detail'] as const,
  detail: (slug: string) => [...caseKeys.details(), slug] as const,
};

/**
 * Hook for fetching paginated case list
 */
export function useCases(params: CaseListParams = {}) {
  return useQuery({
    queryKey: caseKeys.list(params),
    queryFn: () => casesApi.getList(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook for fetching single case by slug
 */
export function useCase(slug: string) {
  return useQuery({
    queryKey: caseKeys.detail(slug),
    queryFn: () => casesApi.getBySlug(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
