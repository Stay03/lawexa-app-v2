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
  const { isAuthenticated, isGuest, onboardingComplete } = useAuthStore();

  console.log('[OnboardingGuard] render:', { isAuthenticated, isGuest, onboardingComplete });

  useEffect(() => {
    console.log('[OnboardingGuard] useEffect:', { isAuthenticated, isGuest, onboardingComplete });

    if (!isAuthenticated || isGuest) return;

    if (!onboardingComplete) {
      console.log('[OnboardingGuard] REDIRECTING to /onboarding');
      router.replace('/onboarding');
    }
  }, [isAuthenticated, isGuest, onboardingComplete, router]);

  // Guest or unauthenticated — render children
  if (!isAuthenticated || isGuest) {
    return <>{children}</>;
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
