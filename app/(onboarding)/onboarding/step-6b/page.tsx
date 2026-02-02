'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingFooter } from '@/components/onboarding/OnboardingFooter';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import { getTotalSteps } from '@/lib/utils/onboarding';
import { getLevelOptions, AREA_OF_STUDY_OPTIONS } from '@/types/onboarding';
import { cn } from '@/lib/utils';

export default function OnboardingStep6bPage() {
  const router = useRouter();
  const {
    userType,
    communicationStyle,
    locationData,
    profileData,
    setProfileData,
  } = useOnboardingStore();
  const { submitOnboarding, isSubmitting } = useOnboarding();

  // Form state
  const [level, setLevel] = useState(profileData.level || '');
  const [areaOfStudy, setAreaOfStudy] = useState(profileData.areaOfStudy || '');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [customAreaOfStudy, setCustomAreaOfStudy] = useState('');

  // Redirect if previous steps not completed or not a non-law student
  useEffect(() => {
    if (!userType || !communicationStyle) {
      router.replace('/onboarding/step-1');
    } else if (userType !== 'other' || profileData.profession !== 'student') {
      // Only non-law students should be on this page
      router.replace('/onboarding/step-4');
    } else if (!profileData.university) {
      // University should be selected in step-6
      router.replace('/onboarding/step-6');
    }
  }, [userType, communicationStyle, profileData.profession, profileData.university, router]);

  // Get level options based on country
  const levelOptions = getLevelOptions(locationData.country || '');

  // Check if selected area of study is a custom one (not in predefined options)
  const hasCustomAreaOfStudy = areaOfStudy && !AREA_OF_STUDY_OPTIONS.includes(areaOfStudy as typeof AREA_OF_STUDY_OPTIONS[number]);

  const handleAreaOfStudySelect = (value: string) => {
    if (value === 'others') {
      setShowOtherInput(true);
      setAreaOfStudy('');
      setCustomAreaOfStudy('');
    } else {
      setAreaOfStudy(value);
      setCustomAreaOfStudy('');
      setShowOtherInput(false);
    }
  };

  const handleCustomAreaOfStudySubmit = () => {
    if (customAreaOfStudy.trim()) {
      setAreaOfStudy(customAreaOfStudy.trim());
      setShowOtherInput(false);
    }
  };

  const handleClearCustomAreaOfStudy = () => {
    setAreaOfStudy('');
    setCustomAreaOfStudy('');
    setShowOtherInput(false);
  };

  const handleBack = () => {
    router.push('/onboarding/step-6');
  };

  const handleNext = () => {
    // Save education data to store and submit
    setProfileData({
      level,
      areaOfStudy,
    });

    // Complete onboarding for non-law students
    submitOnboarding({
      userType: userType!,
      communicationStyle: communicationStyle!,
      ...locationData,
      ...profileData,
      level,
      areaOfStudy,
    });
  };

  // Validation
  const isValid = () => {
    return !!level && !!areaOfStudy;
  };

  if (
    !userType ||
    !communicationStyle ||
    userType !== 'other' ||
    profileData.profession !== 'student'
  ) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start p-4 pt-8 pb-24 md:justify-center md:pb-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress
          currentStep={6}
          totalSteps={getTotalSteps(userType, profileData.profession)}
        />

        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Your education
            </h1>
            <p className="text-muted-foreground">
              Tell us about your current studies
            </p>
          </div>

          <div className="space-y-6">
            {/* Level Selection */}
            <div className="space-y-2">
              <Label htmlFor="level">Level *</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select your level" />
                </SelectTrigger>
                <SelectContent>
                  {levelOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Area of Study Selection */}
            <div className="space-y-3">
              <Label>Area of Study *</Label>

              {/* Show custom area of study if set */}
              {hasCustomAreaOfStudy ? (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-foreground flex items-center gap-1">
                    {areaOfStudy}
                    <button
                      type="button"
                      onClick={handleClearCustomAreaOfStudy}
                      className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              ) : showOtherInput ? (
                /* Show input for custom area of study when "Others" is selected */
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your area of study..."
                    value={customAreaOfStudy}
                    onChange={(e) => setCustomAreaOfStudy(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCustomAreaOfStudySubmit();
                      }
                    }}
                    autoFocus
                  />
                  {customAreaOfStudy && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCustomAreaOfStudySubmit}
                    >
                      Add
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowOtherInput(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                /* Show area of study options as bubble grid */
                <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                  {AREA_OF_STUDY_OPTIONS.map((option, index) => {
                    const isSelected = areaOfStudy === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleAreaOfStudySelect(option)}
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
                        <span className="truncate">{option}</span>
                        {isSelected && (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </button>
                    );
                  })}
                  {/* Others option */}
                  <button
                    type="button"
                    onClick={() => handleAreaOfStudySelect('others')}
                    className={cn(
                      'relative flex items-center justify-between gap-2 rounded-xl border border-dashed p-3 text-left text-sm transition-all duration-200',
                      'hover:border-primary/50 hover:bg-primary/5',
                      'animate-in fade-in slide-in-from-bottom-2',
                      'border-muted-foreground/30'
                    )}
                    style={{ animationDelay: `${AREA_OF_STUDY_OPTIONS.length * 30}ms` }}
                  >
                    <span className="text-muted-foreground">Others</span>
                  </button>
                </div>
              )}

              {areaOfStudy && !showOtherInput && !hasCustomAreaOfStudy && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-medium">{areaOfStudy}</span>
                </p>
              )}
            </div>
          </div>

          {/* Navigation buttons */}
          <OnboardingFooter
            onBack={handleBack}
            onNext={handleNext}
            nextLabel="Complete"
            isLoading={isSubmitting}
            isNextDisabled={!isValid()}
          />
        </div>
      </div>
    </div>
  );
}
