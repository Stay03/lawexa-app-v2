'use client';

import { useCallback } from 'react';
import { onboardingApi } from '@/lib/api/onboarding';
import type { OnboardingStepPayload } from '@/types/onboarding';

/**
 * Fire-and-forget hook for saving onboarding step data to the server.
 * Never blocks navigation — errors are silently logged.
 * 409 (already completed) triggers a redirect to home.
 */
export function useOnboardingStepSave() {
  const saveStep = useCallback((payload: OnboardingStepPayload) => {
    onboardingApi.saveStep(payload).catch((error) => {
      if (error?.response?.status === 409) {
        console.warn('[onboarding] Step save returned 409 — already completed');
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
        return;
      }
      console.error('[onboarding] Step save failed (non-blocking):', error);
    });
  }, []);

  return { saveStep };
}
