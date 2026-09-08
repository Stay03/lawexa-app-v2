'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { adminCaseArgumentsApi } from '@/lib/api/admin-case-arguments';
import type {
  CaseArgumentReviewItem,
  RejectArgumentData,
  UpdateArgumentData,
} from '@/types/admin-case-arguments';

/******************************************************************************
                            Query Key Factory
******************************************************************************/

export const caseArgumentKeys = {
  all: ['admin', 'case-arguments'] as const,
  queue: () => [...caseArgumentKeys.all, 'queue'] as const,
  caseSets: () => [...caseArgumentKeys.all, 'case-set'] as const,
  caseSet: (caseId: number) => [...caseArgumentKeys.caseSets(), caseId] as const,
  summary: () => [...caseArgumentKeys.all, 'summary'] as const,
};

/**
 * Page size for both the discovery queue and a case's full set. 100 covers the
 * largest case in the corpus on 8 September 2026 — A.-G., Federation v A.-G.,
 * Abia State (No.2) at 91 arguments — and the follow-up loop below keeps that
 * promise if a bigger one ever arrives.
 */
export const REVIEW_PAGE_SIZE = 100;

/******************************************************************************
                                Query Hooks
******************************************************************************/

/**
 * The unreviewed queue, used only to discover which cases hold pending work.
 * It never refetches on its own: the case rail is derived from this data in
 * first-appearance order, and a background refetch would remove finished cases
 * and reshuffle the rail while someone is working down it.
 */
export function useReviewQueue() {
  return useInfiniteQuery({
    queryKey: caseArgumentKeys.queue(),
    queryFn: ({ pageParam }) =>
      adminCaseArgumentsApi.getArguments({
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
  items: CaseArgumentReviewItem[];
  /** The server's own unreviewed count for the case at fetch time. */
  total: number;
}

/**
 * Every unreviewed argument in one case, in one query.
 *
 * staleTime is Infinity because review actions patch this cache in place: the
 * query filters on unreviewed rows, so a refetch would silently drop the rows
 * the reviewer just decided, and rows must never vanish or re-sort while the
 * case is open.
 */
export function useCaseReviewSet(caseId: number | undefined) {
  return useQuery({
    queryKey: caseArgumentKeys.caseSet(caseId ?? 0),
    queryFn: async (): Promise<CaseReviewSet> => {
      const first = await adminCaseArgumentsApi.getArguments({
        reviewed: false,
        case_id: caseId,
        per_page: REVIEW_PAGE_SIZE,
        page: 1,
      });
      const items = [...first.data];
      for (let page = 2; page <= first.pagination.last_page; page += 1) {
        const next = await adminCaseArgumentsApi.getArguments({
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

export function useCaseArgumentsSummary() {
  return useQuery({
    queryKey: caseArgumentKeys.summary(),
    queryFn: () => adminCaseArgumentsApi.getArgumentsSummary(),
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
function patchCaseSetRow(queryClient: QueryClient, item: CaseArgumentReviewItem) {
  const caseId = item.case?.id;
  if (caseId === undefined) return;
  queryClient.setQueryData<CaseReviewSet>(caseArgumentKeys.caseSet(caseId), (prev) =>
    prev
      ? { ...prev, items: prev.items.map((row) => (row.id === item.id ? item : row)) }
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
  queryClient.setQueryData<CaseReviewSet>(caseArgumentKeys.caseSet(caseId), (prev) =>
    prev
      ? {
          ...prev,
          items: prev.items.map((row) =>
            approved.has(row.id)
              ? { ...row, reviewed: true, rejected_at: null }
              : row
          ),
        }
      : prev
  );
}

export function useApproveCaseArgument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminCaseArgumentsApi.approveArgument(id),
    onSuccess: (response) => {
      patchCaseSetRow(queryClient, response.data);
      queryClient.invalidateQueries({ queryKey: caseArgumentKeys.summary() });
    },
  });
}

export function useUpdateCaseArgument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateArgumentData }) =>
      adminCaseArgumentsApi.updateArgument(id, data),
    onSuccess: (response) => {
      patchCaseSetRow(queryClient, response.data);
      queryClient.invalidateQueries({ queryKey: caseArgumentKeys.summary() });
    },
  });
}

/**
 * Reject FLAGS the row rather than deleting it, so unlike the principle screen
 * the server hands back the updated row and the cache takes it. The rejection
 * stamp is the only record that the extraction ever produced that sentence:
 * nothing under case_arguments is audited or soft-deleted.
 */
export function useRejectCaseArgument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data?: RejectArgumentData }) =>
      adminCaseArgumentsApi.rejectArgument(id, data ?? {}),
    onSuccess: (response) => {
      if (response.data) patchCaseSetRow(queryClient, response.data);
      queryClient.invalidateQueries({ queryKey: caseArgumentKeys.summary() });
    },
  });
}

export function useBulkApproveCaseArguments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids }: { caseId: number; ids: number[] }) =>
      adminCaseArgumentsApi.bulkApprove(ids),
    onSuccess: (_response, variables) => {
      patchCaseSetBulk(queryClient, variables.caseId, variables.ids);
      queryClient.invalidateQueries({ queryKey: caseArgumentKeys.summary() });
    },
  });
}
