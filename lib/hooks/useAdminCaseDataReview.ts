'use client';

import { useQuery } from '@tanstack/react-query';
import { adminCaseDataReviewApi } from '@/lib/api/admin-case-data-review';
import type {
  CaseDataReviewParams,
  DuplicatesParams,
} from '@/types/admin-case-data-review';

/******************************************************************************
                            Query Key Factory
******************************************************************************/

export const caseDataReviewKeys = {
  all: ['admin', 'case-data-review'] as const,
  lists: () => [...caseDataReviewKeys.all, 'list'] as const,
  list: (params: CaseDataReviewParams) =>
    [...caseDataReviewKeys.lists(), params] as const,
  summary: () => [...caseDataReviewKeys.all, 'summary'] as const,
  duplicates: (params: DuplicatesParams) =>
    [...caseDataReviewKeys.all, 'duplicates', params] as const,
};

/******************************************************************************
                                Query Hooks
******************************************************************************/

/**
 * The numbers behind the problem list. Longer-lived than the rows on purpose:
 * these counts only move when someone repairs data, which is not something
 * this screen can do, so refetching them per keystroke would buy nothing.
 */
export function useCaseDataReviewSummary() {
  return useQuery({
    queryKey: caseDataReviewKeys.summary(),
    queryFn: () => adminCaseDataReviewApi.getSummary(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCaseDataReview(params: CaseDataReviewParams = {}) {
  return useQuery({
    queryKey: caseDataReviewKeys.list(params),
    queryFn: () => adminCaseDataReviewApi.getCases(params),
    staleTime: 60 * 1000,
    // Paging a 10,000 row queue with the table blanking on every page is worse
    // than a moment of stale rows, so the previous page stays put until the
    // next one lands.
    placeholderData: (previous) => previous,
  });
}

export function useCaseDuplicates(
  params: DuplicatesParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: caseDataReviewKeys.duplicates(params),
    queryFn: () => adminCaseDataReviewApi.getDuplicates(params),
    enabled: options?.enabled !== false,
    staleTime: 60 * 1000,
    placeholderData: (previous) => previous,
  });
}
