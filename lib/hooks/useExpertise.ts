'use client';

import { useQuery } from '@tanstack/react-query';
import { expertiseApi, type ExpertiseQueryParams } from '@/lib/api/expertise';

export function useExpertise(params?: ExpertiseQueryParams) {
  return useQuery({
    queryKey: ['areas-of-expertise', params],
    queryFn: () => expertiseApi.getAll(params),
    staleTime: 1000 * 60 * 10, // 10 minutes - expertise list doesn't change often
  });
}

export function useAllExpertise() {
  return useQuery({
    queryKey: ['areas-of-expertise', 'all'],
    queryFn: () => expertiseApi.getAll({ per_page: 100 }),
    staleTime: 1000 * 60 * 10,
    select: (data) => data.data,
  });
}
