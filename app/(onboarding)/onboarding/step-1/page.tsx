'use client';

import { useRouter } from 'next/navigation';
import { Scale, GraduationCap, Briefcase } from 'lucide-react';
import { OnboardingCard } from '@/components/onboarding/OnboardingCard';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingFooter } from '@/components/onboarding/OnboardingFooter';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { getTotalSteps } from '@/lib/utils/onboarding';
import type { UserType } from '@/types/auth';

const USER_TYPE_OPTIONS = [
  {
    id: 'lawyer' as const,
    label: 'Lawyer',
    description: 'I am a practicing lawyer or legal professional',
    icon: Scale,
  },
  {
    id: 'law_student' as const,
    label: 'Law Student',
    description: 'I am currently studying law or preparing for bar exams',
    icon: GraduationCap,
  },
  {
    id: 'other' as const,
    label: 'Professional / Other',
    description: 'Business owner, researcher, journalist, or anyone seeking legal insights',
    icon: Briefcase,
  },
];

export default function OnboardingStep1Page() {
  const router = useRouter();
  const { userType, setUserType } = useOnboardingStore();

  const handleSelect = (type: UserType) => {
    setUserType(type);
  };

  const handleNext = () => {
    if (userType) {
      router.push('/onboarding/step-2');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-start p-4 pt-8 pb-24 md:justify-center md:pb-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress currentStep={1} totalSteps={getTotalSteps(userType)} />

        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              What best describes you?
            </h1>
            <p className="text-muted-foreground">
              This helps us personalize your Lawexa experience
            </p>
          </div>

          <div className="grid gap-4">
            {USER_TYPE_OPTIONS.map((option, index) => (
              <OnboardingCard
                key={option.id}
                icon={<option.icon className="h-6 w-6" />}
                title={option.label}
                description={option.description}
                selected={userType === option.id}
                onClick={() => handleSelect(option.id)}
                animationDelay={index * 100}
              />
            ))}
          </div>

          <OnboardingFooter
            onNext={handleNext}
            showBack={false}
            isNextDisabled={!userType}
          />
        </div>
      </div>
    </div>
  );
}
