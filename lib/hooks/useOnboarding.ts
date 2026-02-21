'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { onboardingApi } from '@/lib/api/onboarding';
import { useAuthStore } from '@/lib/stores/authStore';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import type { OnboardingFormData, OnboardingCompletePayload } from '@/types/onboarding';

export function useOnboarding() {
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

      // Build the complete payload as a fallback — POST /complete accepts
      // the same fields and will save them before validating, so even if
      // some PUT /step calls failed, this ensures all data reaches the server.
      const payload: OnboardingCompletePayload = {
        user_type: data.userType,
        communication_style: data.communicationStyle,
      };

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

      return onboardingApi.complete(payload);
    },
    onSuccess: (response) => {
      console.log('[onboarding] onSuccess fired, response:', { success: response.success, hasData: !!response.data });

      if (response.success && response.data) {
        console.log('[onboarding] Inside if block — updating user');
        // POST /complete returns { user, location } — use the full user object
        updateUser(response.data.user);

        // Mark onboarding as complete
        setOnboardingComplete(true);

        // Clear onboarding form data
        reset();

        // Hard navigate to home — router.push loses the race to step
        // page useEffect guards that see cleared store data and redirect
        // back to step-1. window.location forces a full page load which
        // reads onboardingComplete: true from persisted localStorage.
        window.location.href = '/';
      } else {
        console.log('[onboarding] Condition failed — response.success:', response.success, 'response.data:', response.data);
      }
    },
    onError: (error: Error & { response?: { status?: number; data?: { message?: string } } }) => {
      // Handle 409 — onboarding already completed
      if (error.response?.status === 409) {
        toast.info('Your onboarding is already complete!');
        setOnboardingComplete(true);
        reset();
        window.location.href = '/';
        return;
      }

      const message = error.response?.data?.message || 'Failed to complete onboarding. Please try again.';
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
