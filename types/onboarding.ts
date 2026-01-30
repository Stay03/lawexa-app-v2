import type { UserType, CommunicationStyle } from './auth';

export type StudentEducationLevel = 'university' | 'law_school';

export interface OnboardingFormData {
  userType: UserType;
  communicationStyle: CommunicationStyle;
  // Location fields
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  // Profile fields
  profession?: string;
  bio?: string;
  // Education level (law_student only)
  studentEducationLevel?: StudentEducationLevel;
  // Education fields
  university?: string;
  level?: string;
  lawSchool?: string;
  yearOfCall?: number;
  areaOfStudy?: string;
  // Expertise
  areasOfExpertise?: number[];
  // Verification (Lawyer only)
  callNumber?: string;
  wantsClientReferrals?: boolean;
}

export interface UserTypeOption {
  id: UserType;
  label: string;
  description: string;
}

export interface CommunicationStyleOption {
  id: CommunicationStyle;
  label: string;
  description: string;
}

// Profession options for "Other" user type
export const PROFESSION_OPTIONS = [
  { value: 'business_owner', label: 'Business Owner' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'journalist', label: 'Journalist' },
  { value: 'student', label: 'Student' },
  { value: 'legal_consultant', label: 'Legal Consultant' },
  { value: 'government_official', label: 'Government Official' },
  { value: 'academic', label: 'Academic' },
  { value: 'other', label: 'Other' },
] as const;

export type ProfessionOption = (typeof PROFESSION_OPTIONS)[number]['value'];

// Level formats by country
export const LEVEL_FORMATS: Record<string, string[]> = {
  Nigeria: ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level', '600 Level'],
  Ghana: ['Level 100', 'Level 200', 'Level 300', 'Level 400'],
  'United States': ['Freshman', 'Sophomore', 'Junior', 'Senior'],
  'United Kingdom': ['First Year', 'Second Year', 'Third Year', 'Fourth Year'],
  default: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
};

export function getLevelOptions(country: string): string[] {
  return LEVEL_FORMATS[country] || LEVEL_FORMATS.default;
}

// Law school options by country
export const LAW_SCHOOL_OPTIONS: Record<string, string[]> = {
  Nigeria: [
    'Nigerian Law School – Abuja Campus',
    'Nigerian Law School – Lagos Campus',
    'Nigerian Law School – Enugu Campus',
    'Nigerian Law School – Kano Campus',
    'Nigerian Law School – Yola Campus',
    'Nigerian Law School – Bayelsa Campus',
    'Nigerian Law School – Port Harcourt Campus',
  ],
  Ghana: ['Ghana School of Law'],
};

export function getLawSchoolOptions(country: string): string[] | null {
  return LAW_SCHOOL_OPTIONS[country] || null;
}
