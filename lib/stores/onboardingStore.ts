import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserType, CommunicationStyle } from '@/types/auth';

export interface OnboardingProfileData {
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
  // Step 3
  profileData: OnboardingProfileData;
  // Step 4
  areasOfExpertise: number[];
  // Step 5 (Lawyer only)
  verificationData: OnboardingVerificationData;
  wantsClientReferrals: boolean | null;

  // Actions
  setUserType: (type: UserType) => void;
  setCommunicationStyle: (style: CommunicationStyle) => void;
  setProfileData: (data: Partial<OnboardingProfileData>) => void;
  setAreasOfExpertise: (ids: number[]) => void;
  setVerificationData: (data: Partial<OnboardingVerificationData>) => void;
  setWantsClientReferrals: (wants: boolean) => void;
  reset: () => void;
}

const initialState = {
  userType: null,
  communicationStyle: null,
  profileData: {},
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
      setProfileData: (data) =>
        set((state) => ({
          profileData: { ...state.profileData, ...data },
        })),
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
