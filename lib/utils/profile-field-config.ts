import type { UserType } from '@/types/auth';
import type { StudentEducationLevel } from '@/types/onboarding';

export interface ProfileFieldVisibility {
  // ProfessionalInfoForm
  showProfession: boolean;
  showAreasOfExpertise: boolean;

  // EducationInfoForm
  showEducationSection: boolean;
  showEducationLevelToggle: boolean;
  showUniversity: boolean;
  showLevel: boolean;
  showLawSchool: boolean;
  showCallToBarYear: boolean;
  showCallNumber: boolean;
  showOtherCertifications: boolean;
  showWorkExperience: boolean;
}

export function getProfileFieldVisibility(
  userType: UserType | null | undefined,
  studentEducationLevel: StudentEducationLevel | null | undefined,
  profession?: string
): ProfileFieldVisibility {
  const isLawyer = userType === 'lawyer';
  const isLawStudent = userType === 'law_student';
  const isOther = userType === 'other';
  const isOtherStudent = isOther && profession === 'student';

  const showUniversity = isLawStudent
    ? studentEducationLevel === 'university'
    : isOtherStudent;

  const showLawSchool =
    isLawyer || (isLawStudent && studentEducationLevel === 'law_school');

  const showEducationSection =
    isLawyer || isLawStudent || isOtherStudent;

  return {
    showProfession: isOther,
    showAreasOfExpertise: isLawyer || isLawStudent,

    showEducationSection,
    showEducationLevelToggle: isLawStudent,
    showUniversity,
    showLevel: showUniversity,
    showLawSchool,
    showCallToBarYear: isLawyer,
    showCallNumber: isLawyer,
    showOtherCertifications: isLawyer,
    showWorkExperience: isLawyer,
  };
}

/**
 * Infer student education level from existing profile data.
 * The backend doesn't store studentEducationLevel explicitly,
 * so we derive it from which fields have data.
 */
export function inferStudentEducationLevel(
  userType: UserType | null | undefined,
  university?: string,
  lawSchool?: string
): StudentEducationLevel | null {
  if (userType !== 'law_student') return null;
  if (lawSchool && !university) return 'law_school';
  if (university) return 'university';
  return null;
}
