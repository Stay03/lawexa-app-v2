'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CommunicationStyleStep } from '@/components/onboarding/CommunicationStyleStep';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingFooter } from '@/components/onboarding/OnboardingFooter';
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
  };

  const handleBack = () => {
    router.push('/onboarding/step-1');
  };

  const handleNext = () => {
    if (communicationStyle) {
      router.push('/onboarding/step-3');
    }
  };

  // Don't render until we have a user type
  if (!userType) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start p-4 pt-8 pb-24 md:justify-center md:pb-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress currentStep={2} totalSteps={getTotalSteps(userType)} />

        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          <CommunicationStyleStep
            userType={userType}
            onSelect={handleSelect}
            isSubmitting={false}
            selectedStyle={communicationStyle}
          />

          <div className="mt-8">
            <OnboardingFooter
              onBack={handleBack}
              onNext={handleNext}
              isNextDisabled={!communicationStyle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
