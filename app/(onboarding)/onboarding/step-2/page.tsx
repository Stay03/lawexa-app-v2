'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CommunicationStyleStep } from '@/components/onboarding/CommunicationStyleStep';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { getTotalSteps } from '@/lib/utils/onboarding';
import type { CommunicationStyle } from '@/types/auth';

export default function OnboardingStep2Page() {
  const router = useRouter();
  const { userType, communicationStyle, setCommunicationStyle } = useOnboardingStore();

  // Redirect to step 1 if no user type is selected
  useEffect(() => {
    if (!userType) {
      router.replace('/onboarding/step-1');
    }
  }, [userType, router]);

  const handleSelect = (style: CommunicationStyle) => {
    if (!userType) return;

    setCommunicationStyle(style);

    // Navigate to step 3 after a small delay for selection feedback
    setTimeout(() => {
      router.push('/onboarding/step-3');
    }, 150);
  };

  const handleBack = () => {
    router.push('/onboarding/step-1');
  };

  // Don't render until we have a user type
  if (!userType) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start p-4 pt-8 md:justify-center">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress currentStep={2} totalSteps={getTotalSteps(userType)} />

        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          <CommunicationStyleStep
            userType={userType}
            onSelect={handleSelect}
            onBack={handleBack}
            isSubmitting={false}
            selectedStyle={communicationStyle}
          />
        </div>
      </div>
    </div>
  );
}
