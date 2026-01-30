'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingFooter } from '@/components/onboarding/OnboardingFooter';
import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { useAllExpertise } from '@/lib/hooks/useExpertise';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import { getTotalSteps, shouldShowVerificationStep, shouldSkipProfileStep } from '@/lib/utils/onboarding';
import { cn } from '@/lib/utils';

export default function OnboardingStep7Page() {
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
  const {
    data: expertiseList,
    isLoading: isLoadingExpertise,
    isError,
    error,
    refetch
  } = useAllExpertise();

  // Local state for selected expertise
  const [selectedIds, setSelectedIds] = useState<number[]>(areasOfExpertise || []);

  // Check if profile step was skipped
  const skipProfile = shouldSkipProfileStep(
    userType,
    locationData.selectedCountryMatchesDetected || false
  );

  // Debug logging for expertise data loading
  useEffect(() => {
    console.log('[Onboarding Step 7] State:', {
      isLoading: isLoadingExpertise,
      isError,
      hasData: !!expertiseList,
      dataLength: expertiseList?.length,
      error: error?.message
    });

    if (isError) {
      console.error('[Onboarding Step 7] Failed to load expertise:', error);
    }
    if (expertiseList) {
      console.log('[Onboarding Step 7] Loaded expertise:', expertiseList.length, 'items');
    }
    if (!isLoadingExpertise && !isError && !expertiseList) {
      console.warn('[Onboarding Step 7] No error but expertiseList is undefined - possible data structure issue');
    }
  }, [isLoadingExpertise, isError, error, expertiseList]);

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

  const isLawStudent = userType === 'law_student';

  const handleBack = () => {
    router.push('/onboarding/step-6');
  };

  const handleNext = () => {
    // Save expertise to store
    setAreasOfExpertise(selectedIds);

    if (shouldShowVerificationStep(userType)) {
      // Lawyers go to verification step
      router.push('/onboarding/step-8');
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
        <OnboardingProgress
          currentStep={(skipProfile ? 5 : 6) + (isLawStudent ? 1 : 0)}
          totalSteps={getTotalSteps(userType, profileData.profession, skipProfile)}
        />

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
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="rounded-full bg-destructive/10 p-3">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Failed to load areas of expertise
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md">
                    {error?.message || 'An unexpected error occurred'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    className="mt-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </div>
            ) : !expertiseList || expertiseList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="rounded-full bg-muted p-3">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    No areas of expertise available
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The expertise list is currently unavailable
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                {expertiseList.map((expertise, index) => {
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
            isNextDisabled={selectedIds.length === 0}
          />
        </div>
      </div>
    </div>
  );
}
