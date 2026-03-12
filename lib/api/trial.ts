import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type {
  ITrialEligibilityData,
  ITrialStartData,
  ITrialData,
} from '@/types/trial';

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Check trial eligibility for the current user, optionally for a specific plan.
 */
async function checkEligibility(planId?: number): Promise<ApiResponse<ITrialEligibilityData>> {
  const response = await apiClient.get<ApiResponse<ITrialEligibilityData>>(
    '/trial/eligibility',
    { params: planId ? { plan_id: planId } : undefined }
  );
  return response.data;
}

/**
 * Initialize a trial for a plan. Returns Paystack checkout URL.
 */
async function startTrial(
  planId: number,
  callbackUrl?: string
): Promise<ApiResponse<ITrialStartData>> {
  const response = await apiClient.post<ApiResponse<ITrialStartData>>(
    '/trial/start',
    {
      plan_id: planId,
      callback_url: callbackUrl || `${window.location.origin}/trial/verify`,
    }
  );
  return response.data;
}

/**
 * Verify a trial tokenization payment and activate the trial.
 */
async function verifyTrial(reference: string): Promise<ApiResponse<ITrialData>> {
  const response = await apiClient.get<ApiResponse<ITrialData>>(
    `/trial/verify/${encodeURIComponent(reference)}`
  );
  return response.data;
}

/**
 * Get the current user's most recent trial status.
 */
async function getStatus(): Promise<ApiResponse<ITrialData>> {
  const response = await apiClient.get<ApiResponse<ITrialData>>('/trial/status');
  return response.data;
}

/**
 * Cancel the current user's active trial.
 */
async function cancelTrial(): Promise<ApiResponse<ITrialData>> {
  const response = await apiClient.post<ApiResponse<ITrialData>>('/trial/cancel');
  return response.data;
}

/******************************************************************************
                               Export default
******************************************************************************/

export const trialApi = {
  checkEligibility,
  startTrial,
  verifyTrial,
  getStatus,
  cancelTrial,
} as const;
