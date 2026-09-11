// Admin Ambassador Applications — TanStack Query hooks.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAmbassadorsApi } from '@/lib/api/ambassadors';
import type { ApproveAmbassadorData, RejectAmbassadorData } from '@/types/ambassador';

export const adminAmbassadorsKeys = {
  all: ['admin', 'ambassador-applications'] as const,
  /** Every application, walked page by page. It sits under `all`, so a
   *  review's invalidation reaches it. */
  everything: () => [...adminAmbassadorsKeys.all, 'everything'] as const,
};

/**
 * Every application, in one array.
 *
 * The applications screen filters, sorts and pages this itself, because the
 * list endpoint filters on `status` alone (its docblock has the measurements),
 * and the financials screen joins university, level and country from it. One
 * query for both, so a review refreshes what either screen reads.
 */
export function useAllAmbassadorApplications() {
  return useQuery({
    queryKey: adminAmbassadorsKeys.everything(),
    queryFn: () => adminAmbassadorsApi.getAllApplications(),
  });
}

/**
 * `onSuccess` RETURNS the invalidation, and react-query awaits a promise
 * returned from `onSuccess` before `mutateAsync` resolves (query-core
 * `mutation.js`). The review dialog closes after `mutateAsync`, so it closes
 * onto a list that already shows the decision. `refetchQueries` swallows a
 * failed refetch unless `throwOnError` is set, so a refetch that fails cannot
 * turn a successful review into an error.
 */
export function useApproveAmbassador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: ApproveAmbassadorData }) =>
      adminAmbassadorsApi.approve(uuid, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminAmbassadorsKeys.all }),
  });
}

/** Returns its invalidation for the reason given on `useApproveAmbassador`. */
export function useRejectAmbassador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: RejectAmbassadorData }) =>
      adminAmbassadorsApi.reject(uuid, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminAmbassadorsKeys.all }),
  });
}
