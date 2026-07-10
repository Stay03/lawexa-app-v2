'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminCasePrinciplesApi } from '@/lib/api/admin-case-principles';
import type {
  CasePrinciplesParams,
  UpdatePrincipleData,
} from '@/types/admin-case-principles';

/******************************************************************************
                            Query Key Factory
******************************************************************************/

export const casePrincipleKeys = {
  all: ['admin', 'case-principles'] as const,
  lists: () => [...casePrincipleKeys.all, 'list'] as const,
  list: (params: CasePrinciplesParams) =>
    [...casePrincipleKeys.lists(), params] as const,
  detail: (id: number) => [...casePrincipleKeys.all, 'detail', id] as const,
  summary: () => [...casePrincipleKeys.all, 'summary'] as const,
};

/******************************************************************************
                                Query Hooks
******************************************************************************/

export function useCasePrinciples(params: CasePrinciplesParams = {}) {
  return useQuery({
    queryKey: casePrincipleKeys.list(params),
    queryFn: () => adminCasePrinciplesApi.getPrinciples(params),
    staleTime: 30 * 1000,
  });
}

export function useCasePrinciplesSummary() {
  return useQuery({
    queryKey: casePrincipleKeys.summary(),
    queryFn: () => adminCasePrinciplesApi.getPrinciplesSummary(),
    staleTime: 30 * 1000,
  });
}

export function useCasePrinciple(
  id: number | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: casePrincipleKeys.detail(id ?? 0),
    queryFn: () => adminCasePrinciplesApi.getPrinciple(id!),
    enabled: !!id && options?.enabled !== false,
    staleTime: 30 * 1000,
  });
}

/******************************************************************************
                                Mutation Hooks
******************************************************************************/

/** Invalidate the queue lists + summary after any review action. */
function useReviewInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: casePrincipleKeys.lists() });
    queryClient.invalidateQueries({ queryKey: casePrincipleKeys.summary() });
  };
}

export function useUpdateCasePrinciple() {
  const invalidate = useReviewInvalidation();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePrincipleData }) =>
      adminCasePrinciplesApi.updatePrinciple(id, data),
    onSuccess: invalidate,
  });
}

export function useApproveCasePrinciple() {
  const invalidate = useReviewInvalidation();
  return useMutation({
    mutationFn: (id: number) => adminCasePrinciplesApi.approvePrinciple(id),
    onSuccess: invalidate,
  });
}

export function useRejectCasePrinciple() {
  const invalidate = useReviewInvalidation();
  return useMutation({
    mutationFn: (id: number) => adminCasePrinciplesApi.rejectPrinciple(id),
    onSuccess: invalidate,
  });
}

export function useBulkApproveCasePrinciples() {
  const invalidate = useReviewInvalidation();
  return useMutation({
    mutationFn: (ids: number[]) => adminCasePrinciplesApi.bulkApprove(ids),
    onSuccess: invalidate,
  });
}
