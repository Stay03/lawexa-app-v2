'use client';

import { useQuery } from '@tanstack/react-query';
import { trendingApi } from '@/lib/api/trending';
import type { TrendingParams } from '@/types/trending';

// Query key factory
export const trendingKeys = {
  all: ['trending'] as const,
  cases: () => [...trendingKeys.all, 'cases'] as const,
  casesList: (params: TrendingParams) => [...trendingKeys.cases(), params] as const,
  notes: () => [...trendingKeys.all, 'notes'] as const,
  notesList: (params: TrendingParams) => [...trendingKeys.notes(), params] as const,
};

/**
 * Hook for fetching trending cases
 */
export function useTrendingCases(params: TrendingParams = {}) {
  return useQuery({
    queryKey: trendingKeys.casesList(params),
    queryFn: () => trendingApi.getCases(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook for fetching trending notes
 */
export function useTrendingNotes(params: TrendingParams = {}) {
  return useQuery({
    queryKey: trendingKeys.notesList(params),
    queryFn: () => trendingApi.getNotes(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
