// Admin case maintenance runs — API service
//
// Every call the maintenance screen makes, in the shape @backendclaude sent on
// 22 August 2026. Written to the same conventions as the sibling job services
// next door (`admin-case-ingestions.ts`), so a reader who knows one knows this.

import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from '@/types/admin-cases';
import type {
  CaseMaintenanceItem,
  CaseMaintenanceItemsParams,
  CaseMaintenancePreviewParams,
  CaseMaintenancePreviewRow,
  CaseMaintenancePreviewSummary,
  CaseMaintenanceRun,
  CaseMaintenanceRunsParams,
  CaseMaintenanceStartPayload,
  CaseMaintenanceDecideResult,
} from '@/types/admin-case-maintenance-runs';

/**
 * What `preview` answers with: the ordinary list envelope, plus the counts.
 *
 * ── IT ANSWERS LIKE EVERY OTHER LIST, AND THAT WAS WORTH ONE MORE PASS ────
 * It briefly did not. The first build nested everything a level deeper, so the
 * rows were reached at `data.data` while every other list in admin puts them at
 * `data`. Measured, reported, and changed on the backend the same afternoon
 * rather than left.
 *
 * The reason it was worth changing for the sake of ten minutes here: the next
 * person building an admin list copies one that exists. If this were the odd
 * one, the mistake it teaches is reading `data.data` on a list that has no such
 * thing — which yields `undefined`, draws an empty table, and raises no error
 * at all.
 *
 * The summary sits BESIDE the rows, which is the pattern the trending endpoint
 * already used for exactly this case: a list that needs extra numbers with it.
 */
export interface CaseMaintenancePreviewResponse
  extends PaginatedResponse<CaseMaintenancePreviewRow> {
  summary: CaseMaintenancePreviewSummary;
}

/**
 * What would run, and what it would cost — WITHOUT touching anything.
 *
 * A POST because the selection can be a long list of case ids, which does not
 * belong in a query string. It writes nothing and calls no provider: it is the
 * safe question you ask before the unsafe one.
 */
async function preview(
  params: CaseMaintenancePreviewParams,
): Promise<CaseMaintenancePreviewResponse> {
  const response = await apiClient.post<CaseMaintenancePreviewResponse>(
    '/admin/case-maintenance-runs/preview',
    params,
  );
  return response.data;
}

/** Start a run over a selection. 201 with the run. */
async function startRun(
  payload: CaseMaintenanceStartPayload,
): Promise<ApiResponse<CaseMaintenanceRun>> {
  const response = await apiClient.post<ApiResponse<CaseMaintenanceRun>>(
    '/admin/case-maintenance-runs',
    payload,
  );
  return response.data;
}

async function getRuns(
  params: CaseMaintenanceRunsParams = {},
): Promise<PaginatedResponse<CaseMaintenanceRun>> {
  const response = await apiClient.get<PaginatedResponse<CaseMaintenanceRun>>(
    '/admin/case-maintenance-runs',
    { params },
  );
  return response.data;
}

async function getRun(uuid: string): Promise<ApiResponse<CaseMaintenanceRun>> {
  const response = await apiClient.get<ApiResponse<CaseMaintenanceRun>>(
    `/admin/case-maintenance-runs/${uuid}`,
  );
  return response.data;
}

async function getItems(
  uuid: string,
  params: CaseMaintenanceItemsParams = {},
): Promise<PaginatedResponse<CaseMaintenanceItem>> {
  const response = await apiClient.get<PaginatedResponse<CaseMaintenanceItem>>(
    `/admin/case-maintenance-runs/${uuid}/items`,
    { params },
  );
  return response.data;
}

/* ── The four controls ─────────────────────────────────────────────────────── */

/** Hold it. Reversible, and the system does this itself when the provider dies. */
async function pauseRun(uuid: string): Promise<ApiResponse<CaseMaintenanceRun>> {
  const response = await apiClient.post<ApiResponse<CaseMaintenanceRun>>(
    `/admin/case-maintenance-runs/${uuid}/pause`,
  );
  return response.data;
}

/** Carry on — whether a person paused it or the provider did. */
async function resumeRun(uuid: string): Promise<ApiResponse<CaseMaintenanceRun>> {
  const response = await apiClient.post<ApiResponse<CaseMaintenanceRun>>(
    `/admin/case-maintenance-runs/${uuid}/resume`,
  );
  return response.data;
}

/**
 * End it for good. TERMINAL and not reversible, which is why this is the one
 * control on the screen that asks before it acts.
 */
async function cancelRun(uuid: string): Promise<ApiResponse<CaseMaintenanceRun>> {
  const response = await apiClient.post<ApiResponse<CaseMaintenanceRun>>(
    `/admin/case-maintenance-runs/${uuid}/cancel`,
  );
  return response.data;
}

/**
 * Run the failures again, and only those.
 *
 * There is no "start over": a case that already succeeded is recognised on a
 * second run and skipped, so starting over would be a slower way to do this.
 */
async function retryFailed(uuid: string): Promise<ApiResponse<CaseMaintenanceRun>> {
  const response = await apiClient.post<ApiResponse<CaseMaintenanceRun>>(
    `/admin/case-maintenance-runs/${uuid}/retry-failed`,
  );
  return response.data;
}

/* ── The confirmation step ─────────────────────────────────────────────────── */

/**
 * Accept or refuse a match a person has to judge.
 *
 * Only ever reached by `nwlr_refresh` items sitting at `awaiting_confirmation`
 * — the cases we can tie to a document by title alone. Confirming WRITES a
 * judgment into a case and cannot be undone, which is why the screen makes
 * refusing the easy action and confirming the deliberate one.
 */
async function confirmItem(
  uuid: string,
  itemId: number,
  /**
   * Which candidate to use, when the item does not carry one of its own.
   *
   * A name search that finds two equally good matches deliberately picks
   * neither — a machine should not choose between two cases that match a
   * record equally well. But the item then has no stored candidate, so an
   * unqualified confirm is refused with "the item has no stored candidate",
   * and for a while the only thing a person could do with a match that had
   * PASSED the bar was throw it away. One was discarded that way before
   * anybody noticed.
   *
   * The server takes this in preference to any stored candidate, so a human
   * breaking a tie is exactly what it is for.
   */
  providerCaseId?: string | null,
): Promise<ApiResponse<CaseMaintenanceItem>> {
  const response = await apiClient.post<ApiResponse<CaseMaintenanceItem>>(
    `/admin/case-maintenance-runs/${uuid}/items/${itemId}/confirm`,
    providerCaseId ? { provider_case_id: providerCaseId } : undefined,
  );
  return response.data;
}

async function rejectItem(
  uuid: string,
  itemId: number,
): Promise<ApiResponse<CaseMaintenanceItem>> {
  const response = await apiClient.post<ApiResponse<CaseMaintenanceItem>>(
    `/admin/case-maintenance-runs/${uuid}/items/${itemId}/reject`,
  );
  return response.data;
}

/**
 * Decide many items at once.
 *
 * The whole point of batch review is that one press settles many cases, which
 * is also exactly what makes it dangerous — a wrong press writes wrong
 * citations into case law at scale. Two things guard that, and neither is
 * cosmetic:
 *
 * A PARTIAL BATCH IS A 200, NOT AN ERROR. Items are decided individually and
 * reported individually. Fifty sent with six refused comes back as forty-four
 * in `succeeded` and six in `failed`, each with the server's own reason. A
 * single overall status would leave the screen either falsely green or falsely
 * red over a write that half happened.
 *
 * THE SERVER CAPS IT AT 100 IDS. Not enforced here — a client-side cap that
 * disagrees with the server is worse than none, because it hides the real limit
 * until the day the two drift apart.
 */
async function decideItems(
  uuid: string,
  decision: 'confirm' | 'reject',
  itemIds: number[],
): Promise<ApiResponse<CaseMaintenanceDecideResult>> {
  const response = await apiClient.post<ApiResponse<CaseMaintenanceDecideResult>>(
    `/admin/case-maintenance-runs/${uuid}/items/decide`,
    { decision, item_ids: itemIds },
  );
  return response.data;
}

export const adminCaseMaintenanceRunsApi = {
  preview,
  startRun,
  getRuns,
  getRun,
  getItems,
  pauseRun,
  resumeRun,
  cancelRun,
  retryFailed,
  confirmItem,
  rejectItem,
  decideItems,
};
