'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { OnboardingProgress } from './OnboardingProgress';
import { UserTypeStep } from './UserTypeStep';
import { CommunicationStyleStep } from './CommunicationStyleStep';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import type { UserType, CommunicationStyle } from '@/types/auth';

const TOTAL_STEPS = 2;

export function OnboardingContainer() {
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [communicationStyle, setCommunicationStyle] = useState<CommunicationStyle | null>(null);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const { submitOnboarding, isSubmitting } = useOnboarding();

  const handleUserTypeSelect = (type: UserType) => {
    setUserType(type);
    setDirection('forward');
    // Small delay to show selection before transitioning
    setTimeout(() => setStep(2), 150);
  };

  const handleStyleSelect = async (style: CommunicationStyle) => {
    if (!userType) return;
    setCommunicationStyle(style);
    await submitOnboarding({ userType, communicationStyle: style });
  };

  const handleBack = () => {
    setDirection('backward');
    setStep(1);
    setCommunicationStyle(null);
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress currentStep={step} totalSteps={TOTAL_STEPS} />

        <div className="relative overflow-hidden">
          {/* Step 1: User Type */}
          <div
            className={cn(
              'transition-all duration-300 ease-out',
              step === 1
                ? 'translate-x-0 opacity-100'
                : direction === 'forward'
                ? '-translate-x-full opacity-0 absolute inset-0'
                : 'translate-x-full opacity-0 absolute inset-0'
            )}
          >
            {step === 1 && (
              <UserTypeStep
                onSelect={handleUserTypeSelect}
                selectedType={userType}
              />
            )}
          </div>

          {/* Step 2: Communication Style */}
          <div
            className={cn(
              'transition-all duration-300 ease-out',
              step === 2
                ? 'translate-x-0 opacity-100'
                : direction === 'forward'
                ? 'translate-x-full opacity-0 absolute inset-0'
                : '-translate-x-full opacity-0 absolute inset-0'
            )}
          >
            {step === 2 && userType && (
              <CommunicationStyleStep
                userType={userType}
                onSelect={handleStyleSelect}
                isSubmitting={isSubmitting}
                selectedStyle={communicationStyle}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
