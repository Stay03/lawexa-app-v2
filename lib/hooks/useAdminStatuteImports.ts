'use client';

import { useQuery } from '@tanstack/react-query';
import { adminStatuteImportsApi } from '@/lib/api/admin-statute-imports';
import type { StatuteImportsParams } from '@/types/admin-statute-imports';

export const statuteImportKeys = {
  all: ['admin', 'statute-imports'] as const,
  lists: () => [...statuteImportKeys.all, 'list'] as const,
  list: (params: StatuteImportsParams) => [...statuteImportKeys.lists(), params] as const,
  summary: () => [...statuteImportKeys.all, 'summary'] as const,
};

const IN_FLIGHT = new Set(['pending', 'processing']);

export function useStatuteImports(params: StatuteImportsParams = {}) {
  return useQuery({
    queryKey: statuteImportKeys.list(params),
    queryFn: () => adminStatuteImportsApi.getImports(params),
    staleTime: 10 * 1000,
    // Poll while any import is progressing so the node progress bars advance.
    refetchInterval: (query) =>
      query.state.data?.data?.some((i) => IN_FLIGHT.has(i.status)) ? 10 * 1000 : false,
  });
}

export function useStatuteImportSummary() {
  return useQuery({
    queryKey: statuteImportKeys.summary(),
    queryFn: () => adminStatuteImportsApi.getImportSummary(),
    staleTime: 15 * 1000,
    refetchInterval: (query) => {
      const imports = query.state.data?.data?.imports;
      return imports && imports.processing > 0 ? 15 * 1000 : false;
    },
  });
}
