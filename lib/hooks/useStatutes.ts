'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { statutesApi } from '@/lib/api/statutes';
import { STATUTE_COUNTRIES_FALLBACK } from '@/lib/constants/statute-countries';
import type { StatuteCountriesData, StatuteListParams } from '@/types/statute';

// Query keys factory
export const statuteKeys = {
  all: ['statutes'] as const,
  lists: () => [...statuteKeys.all, 'list'] as const,
  list: (params: StatuteListParams) => [...statuteKeys.lists(), params] as const,
  countries: () => [...statuteKeys.all, 'countries'] as const,
  details: () => [...statuteKeys.all, 'detail'] as const,
  detail: (slug: string) => [...statuteKeys.details(), slug] as const,
  akn: (slug: string) => [...statuteKeys.all, 'akn', slug] as const,
};

/**
 * Hook for fetching infinite scrolling statute list
 */
export function useInfiniteStatutes(params: Omit<StatuteListParams, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: [...statuteKeys.lists(), 'infinite', params] as const,
    queryFn: ({ pageParam }) => statutesApi.getList({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { current_page, last_page } = lastPage.pagination;
      return current_page < last_page ? current_page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook for the country facets that drive the statute country tabs.
 *
 * Tries the backend facets endpoint and falls back to a static seed
 * (STATUTE_COUNTRIES_FALLBACK) until that endpoint is live, so the tabs render
 * either way. `placeholderData` keeps the tabs populated on first paint with no
 * flash. Remove the fallback once GET /api/statutes/countries ships.
 */
export function useStatuteCountries() {
  return useQuery({
    queryKey: statuteKeys.countries(),
    queryFn: async (): Promise<StatuteCountriesData> => {
      try {
        const res = await statutesApi.getCountryFacets();
        return res.data;
      } catch {
        return STATUTE_COUNTRIES_FALLBACK;
      }
    },
    placeholderData: STATUTE_COUNTRIES_FALLBACK,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook for fetching single statute by slug
 */
export function useStatute(slug: string) {
  return useQuery({
    queryKey: statuteKeys.detail(slug),
    queryFn: () => statutesApi.getBySlug(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for fetching statute AKN XML export.
 * Returns the raw XML string for client-side parsing and rendering.
 */
export function useStatuteAkn(slug: string) {
  return useQuery({
    queryKey: statuteKeys.akn(slug),
    queryFn: () => statutesApi.exportAkn(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
