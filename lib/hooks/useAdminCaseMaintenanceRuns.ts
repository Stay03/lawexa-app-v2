'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminCaseMaintenanceRunsApi } from '@/lib/api/admin-case-maintenance-runs';
import type {
  CaseMaintenanceItemsParams,
  CaseMaintenancePreviewParams,
  CaseMaintenanceRunsParams,
  CaseMaintenanceRunStatus,
  CaseMaintenanceStartPayload,
} from '@/types/admin-case-maintenance-runs';

export const caseMaintenanceKeys = {
  all: ['admin', 'case-maintenance-runs'] as const,
  lists: () => [...caseMaintenanceKeys.all, 'list'] as const,
  list: (params: CaseMaintenanceRunsParams) =>
    [...caseMaintenanceKeys.lists(), params] as const,
  detail: (uuid: string) => [...caseMaintenanceKeys.all, 'detail', uuid] as const,
  items: (uuid: string, params: CaseMaintenanceItemsParams) =>
    [...caseMaintenanceKeys.all, 'items', uuid, params] as const,
  preview: (params: CaseMaintenancePreviewParams) =>
    [...caseMaintenanceKeys.all, 'preview', params] as const,
};

/**
 * A run that is still going. Matches the sibling job screens: poll while there
 * is something to watch, and stop the moment there is not.
 *
 * `paused` is deliberately NOT in here. A paused run is not progressing, so
 * polling it every half minute asks a question whose answer cannot change until
 * somebody presses Resume — and that press refreshes it anyway.
 */
const IN_FLIGHT = new Set(['pending', 'running']);
const POLL_MS = 30 * 1000;
const STALE_MS = 15 * 1000;

export function useCaseMaintenanceRuns(params: CaseMaintenanceRunsParams = {}) {
  return useQuery({
    queryKey: caseMaintenanceKeys.list(params),
    queryFn: () => adminCaseMaintenanceRunsApi.getRuns(params),
    staleTime: STALE_MS,
    refetchInterval: (query) =>
      query.state.data?.data?.some((run) => IN_FLIGHT.has(run.status)) ? POLL_MS : false,
  });
}

export function useCaseMaintenanceRun(uuid: string | null) {
  return useQuery({
    queryKey: caseMaintenanceKeys.detail(uuid ?? ''),
    queryFn: () => adminCaseMaintenanceRunsApi.getRun(uuid as string),
    enabled: !!uuid,
    staleTime: STALE_MS,
    refetchInterval: (query) =>
      query.state.data?.data && IN_FLIGHT.has(query.state.data.data.status)
        ? POLL_MS
        : false,
  });
}

export function useCaseMaintenanceItems(
  uuid: string | null,
  params: CaseMaintenanceItemsParams = {},
  /**
   * The status of the run these items belong to.
   *
   * ── THE ROWS CANNOT SEE THEIR OWN RUN ─────────────────────────────────
   * The two queries above decide whether to poll by reading their own answer.
   * A page of items cannot: an item is finished long before the run is, so
   * asking the rows would stop the polling while the run was still working.
   * The run's status is the only thing that knows, so the caller passes it and
   * the rule stays here beside the other two.
   *
   * Without this the header moved every half minute while the table under it
   * stood still, and a case that had finished still read "Waiting" until
   * somebody touched the page. A run that is working looks hung.
   */
  runStatus?: CaseMaintenanceRunStatus,
) {
  return useQuery({
    queryKey: caseMaintenanceKeys.items(uuid ?? '', params),
    queryFn: () => adminCaseMaintenanceRunsApi.getItems(uuid as string, params),
    enabled: !!uuid,
    staleTime: STALE_MS,
    refetchInterval: runStatus && IN_FLIGHT.has(runStatus) ? POLL_MS : false,
  });
}

/**
 * What would run, before anything runs.
 *
 * `enabled` is the caller's to set: this is a POST that costs the server real
 * work over a whole selection, so it fires when the reader has chosen a
 * selection rather than on every keystroke that changes one.
 */
export function useCaseMaintenancePreview(
  params: CaseMaintenancePreviewParams | null,
) {
  return useQuery({
    queryKey: caseMaintenanceKeys.preview(params as CaseMaintenancePreviewParams),
    queryFn: () =>
      adminCaseMaintenanceRunsApi.preview(params as CaseMaintenancePreviewParams),
    enabled: !!params,
    staleTime: STALE_MS,
  });
}

/* ── Acting on a run ───────────────────────────────────────────────────────── */

/**
 * Everything that changes a run invalidates the SAME three things: the run, its
 * items, and the list it appears in.
 *
 * Written once rather than repeated per mutation, because the failure mode of
 * repeating it is one action quietly forgetting one of the three and leaving a
 * screen showing a state that has already changed.
 */
function useRunInvalidation(uuid: string | null) {
  const queryClient = useQueryClient();
  return () => {
    if (uuid) {
      void queryClient.invalidateQueries({ queryKey: caseMaintenanceKeys.detail(uuid) });
      void queryClient.invalidateQueries({
        queryKey: [...caseMaintenanceKeys.all, 'items', uuid],
      });
    }
    void queryClient.invalidateQueries({ queryKey: caseMaintenanceKeys.lists() });
  };
}

export function useStartCaseMaintenanceRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CaseMaintenanceStartPayload) =>
      adminCaseMaintenanceRunsApi.startRun(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: caseMaintenanceKeys.lists() });
    },
  });
}

export function usePauseCaseMaintenanceRun(uuid: string | null) {
  const invalidate = useRunInvalidation(uuid);
  return useMutation({
    mutationFn: () => adminCaseMaintenanceRunsApi.pauseRun(uuid as string),
    onSuccess: invalidate,
  });
}

export function useResumeCaseMaintenanceRun(uuid: string | null) {
  const invalidate = useRunInvalidation(uuid);
  return useMutation({
    mutationFn: () => adminCaseMaintenanceRunsApi.resumeRun(uuid as string),
    onSuccess: invalidate,
  });
}

export function useCancelCaseMaintenanceRun(uuid: string | null) {
  const invalidate = useRunInvalidation(uuid);
  return useMutation({
    mutationFn: () => adminCaseMaintenanceRunsApi.cancelRun(uuid as string),
    onSuccess: invalidate,
  });
}

export function useRetryFailedCaseMaintenanceItems(uuid: string | null) {
  const invalidate = useRunInvalidation(uuid);
  return useMutation({
    mutationFn: () => adminCaseMaintenanceRunsApi.retryFailed(uuid as string),
    onSuccess: invalidate,
  });
}

/**
 * Accept or refuse one match.
 *
 * ONE HOOK FOR BOTH, and the decision rides in the call rather than in which
 * hook you reached for. A separate `useConfirm` and `useReject` would be two
 * observers over one list, and this codebase has already been bitten by a
 * mutation observer dropping per-call callbacks when it was shared that way.
 */
/**
 * Decide MANY items in one call.
 *
 * Deliberately does not throw on a partial batch. The server returns 200 with
 * the refusals listed in `failed`, and the caller is expected to show them —
 * turning a half-completed write into a thrown error would lose exactly the
 * information the reviewer needs, which is WHICH ones did not go through.
 */
export function useDecideCaseMaintenanceItems(uuid: string | null) {
  const invalidate = useRunInvalidation(uuid);
  return useMutation({
    mutationFn: ({
      decision,
      itemIds,
    }: {
      decision: 'confirm' | 'reject';
      itemIds: number[];
    }) => adminCaseMaintenanceRunsApi.decideItems(uuid as string, decision, itemIds),
    onSuccess: invalidate,
  });
}

export function useDecideCaseMaintenanceItem(uuid: string | null) {
  const invalidate = useRunInvalidation(uuid);
  return useMutation({
    mutationFn: ({
      itemId,
      decision,
      providerCaseId,
    }: {
      itemId: number;
      decision: 'confirm' | 'reject';
      /** The candidate a person picked, when the item holds none itself. */
      providerCaseId?: string | null;
    }) =>
      decision === 'confirm'
        ? adminCaseMaintenanceRunsApi.confirmItem(uuid as string, itemId, providerCaseId)
        : adminCaseMaintenanceRunsApi.rejectItem(uuid as string, itemId),
    onSuccess: invalidate,
  });
}
