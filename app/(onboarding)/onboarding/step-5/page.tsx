'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Building2 } from 'lucide-react';
import { OnboardingCard } from '@/components/onboarding/OnboardingCard';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingFooter } from '@/components/onboarding/OnboardingFooter';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import {
  getTotalSteps,
  shouldSkipProfileStep,
  shouldShowEducationLevelStep,
} from '@/lib/utils/onboarding';

const EDUCATION_LEVEL_OPTIONS = [
  {
    id: 'university' as const,
    label: 'University',
    description: "I'm currently enrolled in university studying law",
    icon: GraduationCap,
  },
  {
    id: 'law_school' as const,
    label: 'Law School',
    description: "I'm currently attending law school",
    icon: Building2,
  },
];

export default function OnboardingStep5Page() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    userType,
    communicationStyle,
    locationData,
    profileData,
    studentEducationLevel,
    setStudentEducationLevel,
  } = useOnboardingStore();

  const skipProfile = shouldSkipProfileStep(
    userType,
    locationData.selectedCountryMatchesDetected || false
  );

  // Redirect if previous steps not completed or not a law student
  useEffect(() => {
    if (!userType || !communicationStyle) {
      router.replace('/onboarding/step-1');
    } else if (!shouldShowEducationLevelStep(userType)) {
      router.replace('/onboarding/step-6');
    }
  }, [userType, communicationStyle, router, userType]);

  const handleSelect = (level: 'university' | 'law_school') => {
    setStudentEducationLevel(level);
  };

  const handleBack = () => {
    startTransition(() => {
      if (skipProfile) {
        router.push('/onboarding/step-3');
      } else {
        router.push('/onboarding/step-4');
      }
    });
  };

  const handleNext = () => {
    if (studentEducationLevel) {
      startTransition(() => {
        router.push('/onboarding/step-6');
      });
    }
  };

  if (!userType || !communicationStyle || !shouldShowEducationLevelStep(userType)) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start p-4 pt-8 pb-24 md:justify-center md:pb-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress
          currentStep={skipProfile ? 4 : 5}
          totalSteps={getTotalSteps(userType, profileData.profession, skipProfile)}
        />

        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Where are you studying?
            </h1>
            <p className="text-muted-foreground">
              Tell us about your current education level
            </p>
          </div>

          <div className="grid gap-4">
            {EDUCATION_LEVEL_OPTIONS.map((option, index) => (
              <OnboardingCard
                key={option.id}
                icon={<option.icon className="h-6 w-6" />}
                title={option.label}
                description={option.description}
                selected={studentEducationLevel === option.id}
                onClick={() => handleSelect(option.id)}
                animationDelay={index * 100}
              />
            ))}
          </div>

          <OnboardingFooter
            onBack={handleBack}
            onNext={handleNext}
            isNextDisabled={!studentEducationLevel}
            isLoading={isPending}
          />
        </div>
      </div>
    </div>
  );
}
