import type { UserType, CommunicationStyle } from './auth';

export interface OnboardingFormData {
  userType: UserType;
  communicationStyle: CommunicationStyle;
  // Profile fields
  profession?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  university?: string;
  level?: string;
  lawSchool?: string;
  yearOfCall?: number;
  bio?: string;
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
