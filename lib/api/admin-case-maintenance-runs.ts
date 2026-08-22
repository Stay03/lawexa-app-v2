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
} from '@/types/admin-case-maintenance-runs';

/** What `preview` answers with: counts over the whole selection, plus a page. */
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
): Promise<ApiResponse<CaseMaintenanceItem>> {
  const response = await apiClient.post<ApiResponse<CaseMaintenanceItem>>(
    `/admin/case-maintenance-runs/${uuid}/items/${itemId}/confirm`,
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
};
