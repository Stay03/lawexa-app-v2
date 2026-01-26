import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserType, CommunicationStyle } from '@/types/auth';

export interface OnboardingLocationData {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  selectedCountryMatchesDetected?: boolean;
}

export interface OnboardingProfileData {
  profession?: string;
  university?: string;
  level?: string;
  lawSchool?: string;
  yearOfCall?: number;
  bio?: string;
  areaOfStudy?: string;
}

export interface OnboardingVerificationData {
  callNumber?: string;
  meansOfId?: File | null;
  callToBarCert?: File | null;
  practicingLicense?: File | null;
  cv?: File | null;
}

interface OnboardingStore {
  // Step 1
  userType: UserType | null;
  // Step 2
  communicationStyle: CommunicationStyle | null;
  // Step 3 - Location
  locationData: OnboardingLocationData;
  // Step 4 - Profile
  profileData: OnboardingProfileData;
  // Step 5 (law_student only) - Education Level
  studentEducationLevel: 'university' | 'law_school' | null;
  // Step 7 - Expertise
  areasOfExpertise: number[];
  // Step 8 (Lawyer only) - Verification
  verificationData: OnboardingVerificationData;
  wantsClientReferrals: boolean | null;

  // Actions
  setUserType: (type: UserType) => void;
  setCommunicationStyle: (style: CommunicationStyle) => void;
  setLocationData: (data: Partial<OnboardingLocationData>) => void;
  setProfileData: (data: Partial<OnboardingProfileData>) => void;
  setStudentEducationLevel: (level: 'university' | 'law_school') => void;
  setAreasOfExpertise: (ids: number[]) => void;
  setVerificationData: (data: Partial<OnboardingVerificationData>) => void;
  setWantsClientReferrals: (wants: boolean) => void;
  reset: () => void;
}

const initialState = {
  userType: null,
  communicationStyle: null,
  locationData: {},
  profileData: {},
  studentEducationLevel: null,
  areasOfExpertise: [],
  verificationData: {},
  wantsClientReferrals: null,
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      ...initialState,

      setUserType: (type) => set({ userType: type }),
      setCommunicationStyle: (style) => set({ communicationStyle: style }),
      setLocationData: (data) =>
        set((state) => ({
          locationData: { ...state.locationData, ...data },
        })),
      setProfileData: (data) =>
        set((state) => ({
          profileData: { ...state.profileData, ...data },
        })),
      setStudentEducationLevel: (level) => set({ studentEducationLevel: level }),
      setAreasOfExpertise: (ids) => set({ areasOfExpertise: ids }),
      setVerificationData: (data) =>
        set((state) => ({
          verificationData: { ...state.verificationData, ...data },
        })),
      setWantsClientReferrals: (wants) => set({ wantsClientReferrals: wants }),
      reset: () => set(initialState),
    }),
    {
      name: 'lawexa-onboarding',
      // Don't persist File objects
      partialize: (state) => ({
        ...state,
        verificationData: {
          callNumber: state.verificationData.callNumber,
        },
      }),
    }
  )
);
