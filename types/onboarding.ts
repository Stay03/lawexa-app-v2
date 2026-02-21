import type { UserType, CommunicationStyle, UserProfile, User, AreaOfExpertise } from './auth';

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

// Area of study options for non-law students (alphabetically sorted)
export const AREA_OF_STUDY_OPTIONS = [
  'Accounting',
  'Agriculture',
  'Architecture',
  'Biochemistry',
  'Business Administration',
  'Computer Science',
  'Criminology',
  'Cybersecurity',
  'Economics',
  'Education',
  'Engineering',
  'Entrepreneurship',
  'International Relations',
  'Mass Communication',
  'Medicine',
  'Nursing',
  'Pharmacy',
  'Political Science',
  'Psychology',
  'Public Health',
  'Software Engineering',
  'Theatre Arts',
] as const;

export type AreaOfStudyOption = (typeof AREA_OF_STUDY_OPTIONS)[number];

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

// --- Onboarding API Types ---

/** GET /api/onboarding/progress response data */
export interface OnboardingProgressResponse {
  user_type: UserType | null;
  onboarding_step: number | null;
  is_completed: boolean;
  communication_style: CommunicationStyle | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  profession: string | null;
  university: string | null;
  level: string | null;
  law_school: string | null;
  area_of_study: string | null;
  call_to_bar_year: number | null;
  bio: string | null;
  call_number: string | null;
  areas_of_expertise: AreaOfExpertise[];
}

/** PUT /api/onboarding/step request payload */
export interface OnboardingStepPayload {
  step: number;
  user_type?: UserType;
  communication_style?: CommunicationStyle;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  profession?: string;
  area_of_study?: string;
  university?: string;
  level?: string;
  law_school?: string;
  call_to_bar_year?: number;
  call_number?: string;
  bio?: string;
  areas_of_expertise?: number[];
}

/** PUT /api/onboarding/step response data */
export interface OnboardingStepResponse {
  profile: UserProfile & {
    id: number;
    onboarding_step: number | null;
    onboarding_completed_at: string | null;
  };
  areas_of_expertise: AreaOfExpertise[];
}

/** POST /api/onboarding/complete request payload */
export interface OnboardingCompletePayload {
  user_type?: UserType;
  communication_style?: CommunicationStyle;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  profession?: string;
  area_of_study?: string;
  university?: string;
  level?: string;
  law_school?: string;
  call_to_bar_year?: number;
  call_number?: string;
  bio?: string;
  areas_of_expertise?: number[];
}

/** POST /api/onboarding/complete response data */
export interface OnboardingCompleteResponse {
  user: User;
  location: {
    country: string;
    country_code: string;
    continent: string;
    region: string;
    city: string;
  };
}
