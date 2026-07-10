'use client';

import { useQuery } from '@tanstack/react-query';
import { adminFileExtractionsApi } from '@/lib/api/admin-file-extractions';
import type { FileExtractionsParams } from '@/types/admin-file-extractions';

export const fileExtractionKeys = {
  all: ['admin', 'file-extractions'] as const,
  lists: () => [...fileExtractionKeys.all, 'list'] as const,
  list: (params: FileExtractionsParams) => [...fileExtractionKeys.lists(), params] as const,
  summary: () => [...fileExtractionKeys.all, 'summary'] as const,
};

export function useFileExtractions(params: FileExtractionsParams) {
  return useQuery({
    queryKey: fileExtractionKeys.list(params),
    queryFn: () => adminFileExtractionsApi.getExtractions(params),
    staleTime: 30 * 1000,
  });
}

export function useFileExtractionSummary() {
  return useQuery({
    queryKey: fileExtractionKeys.summary(),
    queryFn: () => adminFileExtractionsApi.getExtractionSummary(),
    staleTime: 30 * 1000,
  });
}
