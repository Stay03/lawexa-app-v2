'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Loader2 } from 'lucide-react';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isGuest } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log('[OnboardingGuard] useEffect triggered', {
      isAuthenticated,
      isGuest,
      user,
      userProfile: user?.profile,
    });

    // Skip check for guest users or unauthenticated users
    if (!isAuthenticated || isGuest) {
      console.log('[OnboardingGuard] Skipping check - not authenticated or is guest');
      setIsReady(true);
      return;
    }

    // Check if user needs onboarding
    // User needs onboarding if:
    // 1. profile is null/undefined, OR
    // 2. No indicators of completed onboarding (profession, user_type, or onboarding_completed flag)
    // We check multiple fields because the API may not return onboarding_completed in all responses
    const profile = user?.profile;
    const hasCompletedOnboarding = profile && (
      profile.onboarding_completed === true ||
      // Fallback: if user has profession set, they completed onboarding
      (profile.profession && profile.profession.length > 0)
    );

    const needsOnboarding = !hasCompletedOnboarding;

    console.log('[OnboardingGuard] Onboarding check:', {
      profile,
      onboarding_completed: profile?.onboarding_completed,
      profession: profile?.profession,
      hasCompletedOnboarding,
      needsOnboarding,
    });

    if (needsOnboarding) {
      // Redirect to onboarding - don't set isReady, keep showing loader
      console.log('[OnboardingGuard] Redirecting to /onboarding');
      router.replace('/onboarding');
    } else {
      console.log('[OnboardingGuard] User has completed onboarding, setting ready');
      setIsReady(true);
    }
  }, [isAuthenticated, isGuest, user, router]);

  // Show loading while checking onboarding status or redirecting
  if (!isReady && isAuthenticated && !isGuest) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
