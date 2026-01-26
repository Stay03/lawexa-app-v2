import type { UserType } from '@/types/auth';

/**
 * Calculate total onboarding steps based on user type, profession, and whether profile is skipped
 *
 * When lawyer/law_student selects detected country, profile step is skipped:
 * - Lawyer (skip profile): 6 steps (type, communication, location, education, expertise, verification)
 * - Law Student (skip profile): 6 steps (type, communication, location, education-level, education, expertise)
 *
 * When profile is shown:
 * - Lawyer: 7 steps (type, communication, location, profile, education, expertise, verification)
 * - Law Student: 7 steps (type, communication, location, profile, education-level, education, expertise)
 * - Other + Student profession: 5 steps (type, communication, location, profile, education)
 * - Other + Non-student profession: 4 steps (type, communication, location, profile)
 */
export function getTotalSteps(
  userType: UserType | null,
  profession?: string,
  skipProfile?: boolean
): number {
  if (userType === 'lawyer') return skipProfile ? 6 : 7;
  if (userType === 'law_student') return skipProfile ? 6 : 7;
  if (userType === 'other') {
    // "Other" users with "student" profession get education step
    if (profession === 'student') return 5;
    return 4;
  }
  return 4; // Default
}

/**
 * Check if profile step should be skipped
 * Lawyers and law students skip profile when they select the detected country
 */
export function shouldSkipProfileStep(
  userType: UserType | null,
  selectedCountryMatchesDetected: boolean
): boolean {
  if (userType === 'lawyer' || userType === 'law_student') {
    return selectedCountryMatchesDetected;
  }
  return false;
}

/**
 * Check if education step should be shown based on user type and profession
 */
export function shouldShowEducationStep(userType: UserType | null, profession?: string): boolean {
  if (userType === 'lawyer') return true;
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
