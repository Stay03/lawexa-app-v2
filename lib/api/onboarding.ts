import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type {
  OnboardingProgressResponse,
  OnboardingStepPayload,
  OnboardingStepResponse,
  OnboardingCompletePayload,
  OnboardingCompleteResponse,
} from '@/types/onboarding';

export const onboardingApi = {
  /** Retrieve saved onboarding progress for store hydration. */
  getProgress: async () => {
    const response = await apiClient.get<ApiResponse<OnboardingProgressResponse>>(
      '/onboarding/progress'
    );
    return response.data;
  },

  /** Save fields for a specific onboarding step (step is a bookmark, not a gate). */
  saveStep: async (payload: OnboardingStepPayload) => {
    const response = await apiClient.put<ApiResponse<OnboardingStepResponse>>(
      '/onboarding/step',
      payload
    );
    return response.data;
  },

  /** Validate and mark onboarding as complete. Accepts empty body or full payload. */
  complete: async (payload: OnboardingCompletePayload = {}) => {
    const response = await apiClient.post<ApiResponse<OnboardingCompleteResponse>>(
      '/onboarding/complete',
      payload
    );
    return response.data;
  },
};
