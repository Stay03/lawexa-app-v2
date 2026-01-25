'use client';

import { useQuery } from '@tanstack/react-query';
import { universityApi, type UniversityQueryParams } from '@/lib/api/universities';
import { useDebounce } from './useDebounce';

export function useUniversities(params?: UniversityQueryParams) {
  return useQuery({
    queryKey: ['universities', params],
    queryFn: () => universityApi.getAll(params),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useUniversitySearch(search: string, countryCode?: string) {
  const debouncedSearch = useDebounce(search, 300);

  return useQuery({
    queryKey: ['universities', 'search', debouncedSearch, countryCode],
    queryFn: () => universityApi.search(debouncedSearch, countryCode),
    enabled: debouncedSearch.length >= 2, // Only search after 2 chars
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (data) => data.data,
  });
}

/**
 * Fetch universities by country code - for the country-based list view
 */
export function useUniversitiesByCountry(countryCode?: string) {
  return useQuery({
    queryKey: ['universities', 'byCountry', countryCode],
    queryFn: () => universityApi.getAll({
      country_code: countryCode,
      per_page: 100,
      sort: 'name',
      order: 'asc',
    }),
    enabled: !!countryCode,
    staleTime: 1000 * 60 * 10, // 10 minutes
    select: (data) => data.data,
  });
}

/**
 * Search all universities globally (for when user searches)
 */
export function useGlobalUniversitySearch(search: string) {
  const debouncedSearch = useDebounce(search, 300);

  return useQuery({
    queryKey: ['universities', 'globalSearch', debouncedSearch],
    queryFn: () => universityApi.getAll({
      search: debouncedSearch,
      per_page: 50,
      sort: 'name',
      order: 'asc',
    }),
    enabled: debouncedSearch.length >= 2,
    staleTime: 1000 * 60 * 5,
    select: (data) => data.data,
  });
}
