import type { UserType } from '@/types/auth';

/**
 * Calculate total onboarding steps based on user type
 * - Lawyer: 5 steps (type, communication, profile, expertise, verification)
 * - Law Student: 4 steps (type, communication, profile, expertise)
 * - Other: 3 steps (type, communication, profile)
 */
export function getTotalSteps(userType: UserType | null): number {
  if (userType === 'lawyer') return 5;
  if (userType === 'law_student') return 4;
  return 3;
}

/**
 * Get the next step URL based on current step and user type
 */
export function getNextStepUrl(currentStep: number, userType: UserType | null): string {
  const totalSteps = getTotalSteps(userType);

  if (currentStep >= totalSteps) {
    return '/'; // Onboarding complete
  }

  return `/onboarding/step-${currentStep + 1}`;
}

/**
 * Check if user should skip to completion (for "other" user type after profile)
 */
export function shouldSkipToCompletion(currentStep: number, userType: UserType | null): boolean {
  // "Other" users complete after step 3 (profile)
  if (userType === 'other' && currentStep === 3) {
    return true;
  }
  return false;
}
