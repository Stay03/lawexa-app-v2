import type { UserType } from '@/types/auth';

/**
 * How many onboarding steps a person sees. Every user type sees step 4 ("Tell
 * us about yourself", with the required phone number and "How did you hear
 * about us?"): Stay chose option b on 20 November 2026 (thread bbdef040), so
 * Lawyers and Law Students who keep the detected country no longer skip it.
 * - Lawyer: 6 (type, communication, location, profile, expertise, verification)
 * - Law Student: 7 (type, communication, location, profile, education level, education, expertise)
 * - Other, profession Student: 6 (type, communication, location, profile, university, level and area)
 * - Other: 4 (type, communication, location, profile)
 */
export function getTotalSteps(userType: UserType | null, profession?: string): number {
  // A lawyer has no education step (Stay, 19 October 2026: the step had no
  // fields for a lawyer; "for 20 skip the step for lawyer").
  if (userType === 'lawyer') return 6;
  if (userType === 'law_student') return 7;
  if (userType === 'other') {
    // "Other" users with "student" profession get 2 education steps (university, then level+area)
    if (profession === 'student') return 6;
    return 4;
  }
  return 4; // Default
}

/**
 * Check if education step should be shown based on user type and profession
 */
export function shouldShowEducationStep(userType: UserType | null, profession?: string): boolean {
  // Never for a lawyer: the step had no fields for one (19 October 2026).
  if (userType === 'lawyer') return false;
  if (userType === 'law_student') return true;
  if (userType === 'other' && profession === 'student') return true;
  return false;
}

/**
 * Check if expertise step should be shown based on user type
 */
export function shouldShowExpertiseStep(userType: UserType | null): boolean {
  return userType === 'lawyer' || userType === 'law_student';
}

/**
 * Check if verification step should be shown based on user type
 */
export function shouldShowVerificationStep(userType: UserType | null): boolean {
  return userType === 'lawyer';
}

/**
 * Check if education level selection step should be shown
 * Only law_student users see this step to choose between university and law school
 */
export function shouldShowEducationLevelStep(userType: UserType | null): boolean {
  return userType === 'law_student';
}
