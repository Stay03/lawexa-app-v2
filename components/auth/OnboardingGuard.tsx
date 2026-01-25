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
    // Skip check for guest users or unauthenticated users
    if (!isAuthenticated || isGuest) {
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

    if (needsOnboarding) {
      // Redirect to onboarding - don't set isReady, keep showing loader
      router.replace('/onboarding');
    } else {
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
