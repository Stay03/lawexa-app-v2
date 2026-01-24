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
