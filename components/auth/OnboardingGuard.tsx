'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/authStore';
import { authApi } from '@/lib/api/auth';
import { Loader2 } from 'lucide-react';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isGuest } = useAuthStore();

  // Fetch fresh user data from API (not stale store data)
  // This ensures we check the actual server state after login
  const { data: userData, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    staleTime: 0, // Always fetch fresh on mount
    enabled: isAuthenticated && !isGuest,
  });

  useEffect(() => {
    // Skip check for guest users or unauthenticated users
    if (!isAuthenticated || isGuest) {
      return;
    }

    // Wait for data to load
    if (isLoading) {
      return;
    }

    // Check fresh API data for profile
    // The /me endpoint returns { data: { user: {...}, location: {...} } }
    const apiData = userData?.data as { user?: { profile?: { onboarding_completed?: boolean; profession?: string } } } | null;
    const profile = apiData?.user?.profile;

    const hasCompletedOnboarding = profile && (
      profile.onboarding_completed === true ||
      // Fallback: if user has profession set, they completed onboarding
      (profile.profession && profile.profession.length > 0)
    );

    if (!hasCompletedOnboarding) {
      // Redirect to onboarding
      router.replace('/onboarding');
    }
  }, [isAuthenticated, isGuest, userData, isLoading, router]);

  // Show loading while fetching user data
  if (isAuthenticated && !isGuest && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Also show loading if redirect is pending (user needs onboarding)
  if (isAuthenticated && !isGuest && userData) {
    const apiData = userData?.data as { user?: { profile?: { onboarding_completed?: boolean; profession?: string } } } | null;
    const profile = apiData?.user?.profile;
    const hasCompletedOnboarding = profile && (
      profile.onboarding_completed === true ||
      (profile.profession && profile.profession.length > 0)
    );

    if (!hasCompletedOnboarding) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
  }

  return <>{children}</>;
}
