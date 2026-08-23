'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { adminCasePrinciplesApi } from '@/lib/api/admin-case-principles';
import type {
  CasePrincipleReviewItem,
  UpdatePrincipleData,
} from '@/types/admin-case-principles';

/******************************************************************************
                            Query Key Factory
******************************************************************************/

export const casePrincipleKeys = {
  all: ['admin', 'case-principles'] as const,
  queue: () => [...casePrincipleKeys.all, 'queue'] as const,
  caseSets: () => [...casePrincipleKeys.all, 'case-set'] as const,
  caseSet: (caseId: number) => [...casePrincipleKeys.caseSets(), caseId] as const,
  summary: () => [...casePrincipleKeys.all, 'summary'] as const,
};

/** Page size for both the discovery queue and a case's full set. */
export const REVIEW_PAGE_SIZE = 100;

/******************************************************************************
                                Query Hooks
******************************************************************************/

/**
 * The unreviewed queue at 100 rows a page, used only to discover which cases
 * hold pending work. It never refetches on its own: the case rail is derived
 * from this data in first-appearance order, and a background refetch would
 * remove finished cases and reshuffle the rail while someone works down it.
 */
export function useReviewQueue() {
  return useInfiniteQuery({
    queryKey: casePrincipleKeys.queue(),
    queryFn: ({ pageParam }) =>
      adminCasePrinciplesApi.getPrinciples({
        reviewed: false,
        per_page: REVIEW_PAGE_SIZE,
        page: pageParam,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.current_page < last.pagination.last_page
        ? last.pagination.current_page + 1
        : undefined,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export interface CaseReviewSet {
  items: CasePrincipleReviewItem[];
  /** The server's own unreviewed count for the case at fetch time. */
  total: number;
}

/**
 * Every unreviewed principle in one case, in one query. per_page=100 covers
 * the largest known case (71 principles) and the follow-up loop keeps that
 * promise if a bigger one ever appears. staleTime is Infinity because review
 * actions patch this cache in place: the query filters on `reviewed=0`, so a
 * refetch would silently drop the rows the reviewer just approved, and rows
 * must never vanish or re-sort while the case is open.
 */
export function useCaseReviewSet(caseId: number | undefined) {
  return useQuery({
    queryKey: casePrincipleKeys.caseSet(caseId ?? 0),
    queryFn: async (): Promise<CaseReviewSet> => {
      const first = await adminCasePrinciplesApi.getPrinciples({
        reviewed: false,
        case_id: caseId,
        per_page: REVIEW_PAGE_SIZE,
        page: 1,
      });
      const items = [...first.data];
      for (let page = 2; page <= first.pagination.last_page; page += 1) {
        const next = await adminCasePrinciplesApi.getPrinciples({
          reviewed: false,
          case_id: caseId,
          per_page: REVIEW_PAGE_SIZE,
          page,
        });
        items.push(...next.data);
      }
      return { items, total: first.pagination.total };
    },
    enabled: caseId !== undefined,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useCasePrinciplesSummary() {
  return useQuery({
    queryKey: casePrincipleKeys.summary(),
    queryFn: () => adminCasePrinciplesApi.getPrinciplesSummary(),
    staleTime: 30 * 1000,
  });
}

/******************************************************************************
                                Mutation Hooks
******************************************************************************/

/**
 * Replace one row inside its case set without touching order or membership.
 * This — not invalidation — is how review actions reach the cache, for the
 * same reason the case-set query never refetches mid-case.
 */
function patchCaseSetRow(queryClient: QueryClient, item: CasePrincipleReviewItem) {
  const caseId = item.case?.id;
  if (caseId === undefined) return;
  queryClient.setQueryData<CaseReviewSet>(
    casePrincipleKeys.caseSet(caseId),
    (prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((row) => (row.id === item.id ? item : row)),
          }
        : prev
  );
}

/**
 * Mark rows reviewed after a bulk approval. The endpoint returns counts, not
 * items, so only `reviewed` flips; the reviewer stamp stays absent rather than
 * being fabricated client-side.
 */
function patchCaseSetBulk(queryClient: QueryClient, caseId: number, ids: number[]) {
  const approved = new Set(ids);
  queryClient.setQueryData<CaseReviewSet>(
    casePrincipleKeys.caseSet(caseId),
    (prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((row) =>
              approved.has(row.id) ? { ...row, reviewed: true } : row
            ),
          }
        : prev
  );
}

export function useApproveCasePrinciple() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminCasePrinciplesApi.approvePrinciple(id),
    onSuccess: (response) => {
      patchCaseSetRow(queryClient, response.data);
      queryClient.invalidateQueries({ queryKey: casePrincipleKeys.summary() });
    },
  });
}

export function useUpdateCasePrinciple() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePrincipleData }) =>
      adminCasePrinciplesApi.updatePrinciple(id, data),
    onSuccess: (response) => {
      patchCaseSetRow(queryClient, response.data);
      queryClient.invalidateQueries({ queryKey: casePrincipleKeys.summary() });
    },
  });
}

/**
 * Reject leaves the case-set cache alone on purpose: the server hard-deleted
 * the row, but the session overlay keeps it visible in place, marked rejected,
 * until the reviewer leaves the case.
 */
export function useRejectCasePrinciple() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminCasePrinciplesApi.rejectPrinciple(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: casePrincipleKeys.summary() });
    },
  });
}

export function useBulkApproveCasePrinciples() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids }: { caseId: number; ids: number[] }) =>
      adminCasePrinciplesApi.bulkApprove(ids),
    onSuccess: (_response, variables) => {
      patchCaseSetBulk(queryClient, variables.caseId, variables.ids);
      queryClient.invalidateQueries({ queryKey: casePrincipleKeys.summary() });
    },
  });
}
