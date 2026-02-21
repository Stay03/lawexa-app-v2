'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { onboardingApi } from '@/lib/api/onboarding';
import type { OnboardingProgressResponse } from '@/types/onboarding';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, setOnboardingComplete } = useAuthStore();
  const {
    userType,
    setUserType,
    setCommunicationStyle,
    setLocationData,
    setProfileData,
    setStudentEducationLevel,
    setAreasOfExpertise,
  } = useOnboardingStore();
  const [hydrated, setHydrated] = useState(false);

  // Redirect unverified email users to check-email page
  useEffect(() => {
    if (isAuthenticated && user?.auth_provider === 'email' && !user?.is_verified) {
      router.replace(`/check-email?email=${encodeURIComponent(user.email || '')}`);
    }
  }, [isAuthenticated, user, router]);

  // Hydrate onboarding store from server on mount
  useEffect(() => {
    if (!isAuthenticated || hydrated) return;

    const hydrateFromServer = async () => {
      try {
        const response = await onboardingApi.getProgress();
        if (!response.success || !response.data) {
          setHydrated(true);
          return;
        }

        const data: OnboardingProgressResponse = response.data;

        // If already completed, redirect to home
        if (data.is_completed) {
          setOnboardingComplete(true);
          window.location.href = '/';
          return;
        }

        // If server has saved progress, merge into store (server fills gaps)
        if (data.onboarding_step !== null) {
          if (data.user_type && !userType) {
            setUserType(data.user_type);
          }
          if (data.communication_style) {
            setCommunicationStyle(data.communication_style);
          }
          // Fill location gaps
          const locationUpdates: Record<string, string | undefined> = {};
          if (data.country) locationUpdates.country = data.country;
          if (data.country_code) locationUpdates.countryCode = data.country_code;
          if (data.region) locationUpdates.region = data.region;
          if (data.city) locationUpdates.city = data.city;
          if (Object.keys(locationUpdates).length > 0) {
            setLocationData(locationUpdates);
          }
          // Fill profile gaps
          const profileUpdates: Record<string, string | number | undefined> = {};
          if (data.profession) profileUpdates.profession = data.profession;
          if (data.university) profileUpdates.university = data.university;
          if (data.level) profileUpdates.level = data.level;
          if (data.law_school) profileUpdates.lawSchool = data.law_school;
          if (data.call_to_bar_year) profileUpdates.yearOfCall = data.call_to_bar_year;
          if (data.bio) profileUpdates.bio = data.bio;
          if (data.area_of_study) profileUpdates.areaOfStudy = data.area_of_study;
          if (Object.keys(profileUpdates).length > 0) {
            setProfileData(profileUpdates);
          }
          // Reverse-derive studentEducationLevel for law students
          if (data.user_type === 'law_student') {
            if (data.law_school && !data.university) {
              setStudentEducationLevel('law_school');
            } else if (data.university) {
              setStudentEducationLevel('university');
            }
          }
          // Fill areas of expertise
          if (data.areas_of_expertise && data.areas_of_expertise.length > 0) {
            setAreasOfExpertise(data.areas_of_expertise.map((e) => e.id));
          }
        }
      } catch (error) {
        console.error('[onboarding layout] Failed to fetch progress:', error);
      } finally {
        setHydrated(true);
      }
    };

    hydrateFromServer();
  }, [isAuthenticated, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to top on route change to ensure consistent positioning
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Show nothing while redirecting unverified users
  if (isAuthenticated && user?.auth_provider === 'email' && !user?.is_verified) {
    return null;
  }

  // Show loading spinner during initial hydration
  if (isAuthenticated && !hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main content - no header, content starts from top */}
      <main>{children}</main>
    </div>
  );
}
