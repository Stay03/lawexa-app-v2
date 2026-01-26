'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import type { OnboardingFormData } from '@/types/onboarding';

export function useOnboarding() {
  const router = useRouter();
  const { updateUser, setOnboardingComplete } = useAuthStore();
  const { reset } = useOnboardingStore();

  const mutation = useMutation({
    mutationFn: async (data: OnboardingFormData) => {
      // Derive profession from userType if not explicitly provided
      // This handles the case when lawyer/law_student skips the profile step
      let profession = data.profession;
      if (!profession) {
        if (data.userType === 'lawyer') {
          profession = 'lawyer';
        } else if (data.userType === 'law_student') {
          profession = 'student';
        }
      }

      // Build the profile update payload
      const payload: Record<string, unknown> = {
        user_type: data.userType,
        communication_style: data.communicationStyle,
      };

      // Add profession (derived or explicit)
      if (profession) {
        payload.profession = profession;
      }
      if (data.country) {
        payload.country = data.country;
      }
      if (data.countryCode) {
        payload.country_code = data.countryCode;
      }
      if (data.region) {
        payload.region = data.region;
      }
      if (data.city) {
        payload.city = data.city;
      }
      if (data.university) {
        payload.university = data.university;
      }
      if (data.level) {
        payload.level = data.level;
      }
      if (data.lawSchool) {
        payload.law_school = data.lawSchool;
      }
      if (data.yearOfCall) {
        payload.call_to_bar_year = data.yearOfCall;
      }
      if (data.bio) {
        payload.bio = data.bio;
      }
      if (data.areaOfStudy) {
        payload.area_of_study = data.areaOfStudy;
      }
      if (data.areasOfExpertise && data.areasOfExpertise.length > 0) {
        payload.areas_of_expertise = data.areasOfExpertise;
      }
      if (data.callNumber) {
        payload.call_number = data.callNumber;
      }

      return authApi.updateProfile(payload);
    },
    onSuccess: (response) => {
      console.log('[onboarding] onSuccess fired, response:', { success: response.success, hasData: !!response.data });

      if (response.success && response.data) {
        console.log('[onboarding] Inside if block — updating user');
        updateUser({
          profile: response.data.profile,
          areas_of_expertise: response.data.areas_of_expertise,
        });

        console.log('[onboarding] Setting onboardingComplete = true');
        setOnboardingComplete(true);

        console.log('[onboarding] Calling router.push("/")');
        router.push('/');

        // Clear onboarding form data AFTER navigation starts
        // Must be after router.push so the current step's useEffect
        // doesn't see empty data and redirect back to step-1
        setTimeout(() => {
          console.log('[onboarding] Clearing onboarding store');
          reset();
        }, 100);
      } else {
        console.log('[onboarding] Condition failed — response.success:', response.success, 'response.data:', response.data);
      }
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const message = error.response?.data?.message || 'Failed to save profile. Please try again.';
      toast.error(message);
    },
  });

  return {
    submitOnboarding: mutation.mutate,
    submitOnboardingAsync: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
  };
}
