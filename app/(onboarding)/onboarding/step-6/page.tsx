'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingFooter } from '@/components/onboarding/OnboardingFooter';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { useAllExpertise } from '@/lib/hooks/useExpertise';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import { getTotalSteps, shouldShowVerificationStep } from '@/lib/utils/onboarding';
import { cn } from '@/lib/utils';

export default function OnboardingStep6Page() {
  const router = useRouter();
  const {
    userType,
    communicationStyle,
    locationData,
    profileData,
    areasOfExpertise,
    setAreasOfExpertise,
  } = useOnboardingStore();
  const { submitOnboarding, isSubmitting } = useOnboarding();

  // Fetch all areas of expertise
  const { data: expertiseList, isLoading: isLoadingExpertise } = useAllExpertise();

  // Local state for selected expertise
  const [selectedIds, setSelectedIds] = useState<number[]>(areasOfExpertise || []);

  // Redirect if previous steps not completed
  useEffect(() => {
    if (!userType || !communicationStyle) {
      router.replace('/onboarding/step-1');
    } else if (userType === 'other') {
      // "Other" users should not be on this page
      router.replace('/onboarding/step-4');
    }
  }, [userType, communicationStyle, router]);

  const toggleExpertise = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    );
  };

  const handleBack = () => {
    router.push('/onboarding/step-5');
  };

  const handleNext = () => {
    // Save expertise to store
    setAreasOfExpertise(selectedIds);

    if (shouldShowVerificationStep(userType)) {
      // Lawyers go to verification step
      router.push('/onboarding/step-7');
    } else {
      // Law students complete onboarding
      submitOnboarding({
        userType: userType!,
        communicationStyle: communicationStyle!,
        ...locationData,
        ...profileData,
        areasOfExpertise: selectedIds,
      });
    }
  };

  if (!userType || !communicationStyle || userType === 'other') {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start p-4 pt-8 pb-24 md:justify-center md:pb-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress currentStep={6} totalSteps={getTotalSteps(userType)} />

        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {userType === 'lawyer'
                ? 'Select your areas of expertise'
                : 'What areas interest you?'}
            </h1>
            <p className="text-muted-foreground">
              {userType === 'lawyer'
                ? 'Help clients find you based on your specializations'
                : 'This helps us recommend relevant content'}
            </p>
          </div>

          {/* Expertise grid */}
          <div className="space-y-4">
            {isLoadingExpertise ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                {expertiseList?.map((expertise, index) => {
                  const isSelected = selectedIds.includes(expertise.id);
                  return (
                    <button
                      key={expertise.id}
                      onClick={() => toggleExpertise(expertise.id)}
                      className={cn(
                        'relative flex items-center justify-between gap-2 rounded-xl border p-3 text-left text-sm transition-all duration-200',
                        'hover:border-primary/50 hover:bg-primary/5',
                        'animate-in fade-in slide-in-from-bottom-2',
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-card'
                      )}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <span className="truncate">{expertise.name}</span>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedIds.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                {selectedIds.length} area{selectedIds.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Navigation buttons */}
          <OnboardingFooter
            onBack={handleBack}
            onNext={handleNext}
            nextLabel={userType === 'lawyer' ? 'Next' : 'Complete'}
            isLoading={isSubmitting}
            skipOption={
              selectedIds.length === 0
                ? { label: 'Skip for now', onClick: handleNext }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
