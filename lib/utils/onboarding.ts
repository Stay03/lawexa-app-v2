import type { UserType } from '@/types/auth';

/**
 * Calculate total onboarding steps based on user type and profession
 * New flow:
 * - Lawyer: 7 steps (type, communication, location, profile, education, expertise, verification)
 * - Law Student: 6 steps (type, communication, location, profile, education, expertise)
 * - Other + Student profession: 5 steps (type, communication, location, profile, education)
 * - Other + Non-student profession: 4 steps (type, communication, location, profile)
 */
export function getTotalSteps(userType: UserType | null, profession?: string): number {
  if (userType === 'lawyer') return 7;
  if (userType === 'law_student') return 6;
  if (userType === 'other') {
    // "Other" users with "student" profession get education step
    if (profession === 'student') return 5;
    return 4;
  }
  return 4; // Default
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
