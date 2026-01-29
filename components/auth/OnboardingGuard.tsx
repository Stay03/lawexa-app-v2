'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Loader2 } from 'lucide-react';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isGuest, onboardingComplete } = useAuthStore();

  // Check if user needs email verification
  const needsEmailVerification =
    isAuthenticated &&
    !isGuest &&
    user?.auth_provider === 'email' &&
    !user?.is_verified;

  console.log('[OnboardingGuard] render:', {
    isAuthenticated,
    isGuest,
    onboardingComplete,
    needsEmailVerification,
  });

  useEffect(() => {
    console.log('[OnboardingGuard] useEffect:', {
      isAuthenticated,
      isGuest,
      onboardingComplete,
      needsEmailVerification,
    });

    if (!isAuthenticated || isGuest) return;

    // Redirect unverified email users to check-email page
    if (needsEmailVerification) {
      console.log('[OnboardingGuard] REDIRECTING to /check-email');
      router.replace(`/check-email?email=${encodeURIComponent(user?.email || '')}`);
      return;
    }

    if (!onboardingComplete) {
      console.log('[OnboardingGuard] REDIRECTING to /onboarding');
      router.replace('/onboarding');
    }
  }, [isAuthenticated, isGuest, onboardingComplete, needsEmailVerification, user?.email, router]);

  // Guest or unauthenticated — render children
  if (!isAuthenticated || isGuest) {
    return <>{children}</>;
  }

  // Email verification needed — show loading while redirect happens
  if (needsEmailVerification) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Onboarding not done — show loading while redirect happens
  if (!onboardingComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
