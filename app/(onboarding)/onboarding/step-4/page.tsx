'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingFooter } from '@/components/onboarding/OnboardingFooter';
import { useOnboardingStore, type OnboardingLocationData } from '@/lib/stores/onboardingStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import {
  getTotalSteps,
  shouldShowEducationStep,
} from '@/lib/utils/onboarding';
import { PROFESSION_OPTIONS } from '@/types/onboarding';

export default function OnboardingStep4Page() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    userType,
    communicationStyle,
    locationData,
    profileData,
    setLocationData,
    setProfileData,
  } = useOnboardingStore();
  const { submitOnboarding, isSubmitting } = useOnboarding();

  // Form state
  const [profession, setProfession] = useState(profileData.profession || '');
  const [customProfession, setCustomProfession] = useState('');
  const [region, setRegion] = useState(locationData.region || '');
  const [city, setCity] = useState(locationData.city || '');
  const [bio, setBio] = useState(profileData.bio || '');

  // Redirect if previous steps not completed
  useEffect(() => {
    if (!userType || !communicationStyle) {
      router.replace('/onboarding/step-1');
    }
  }, [userType, communicationStyle, router]);

  // Determine which fields to show based on user type and profession
  const isLawyer = userType === 'lawyer';
  const isLawStudent = userType === 'law_student';
  const isOther = userType === 'other';
  const isStudent = isLawStudent || profession === 'student';

  // Auto-set profession for lawyer and law_student
  useEffect(() => {
    if (isLawyer && !profession) {
      setProfession('lawyer');
    } else if (isLawStudent && !profession) {
      setProfession('student');
    }
  }, [isLawyer, isLawStudent, profession]);

  const handleBack = () => {
    router.push('/onboarding/step-3');
  };

  const handleProfessionSelect = (value: string) => {
    if (value === 'other') {
      setProfession('');
    } else {
      setProfession(value);
      setCustomProfession('');
    }
  };

  const handleCustomProfessionSubmit = () => {
    if (customProfession.trim()) {
      setProfession(customProfession.trim());
    }
  };

  const handleNext = () => {
    // Determine the actual profession value
    const finalProfession = isLawyer ? 'lawyer' : isLawStudent ? 'student' : profession;

    // Save location data with region and city
    setLocationData({
      ...locationData,
      region,
      city,
    });

    // Save profile data to store
    setProfileData({
      profession: finalProfession,
      bio: !isStudent ? bio : undefined, // Hide bio for students
    });

    // Determine next step based on user type and profession
    if (shouldShowEducationStep(userType, finalProfession)) {
      // Go to education step
      router.push('/onboarding/step-5');
    } else {
      // "Other" users without student profession complete here
      submitOnboarding({
        userType: userType!,
        communicationStyle: communicationStyle!,
        ...locationData,
        region,
        city,
        profession: finalProfession,
        bio: bio || undefined,
      });
    }
  };

  // Validation
  const isValid = () => {
    if (isOther && !profession) return false;
    return true;
  };

  if (!userType || !communicationStyle) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start p-4 pt-8 pb-24 md:justify-center md:pb-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress
          currentStep={4}
          totalSteps={getTotalSteps(userType, profession)}
        />

        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Tell us about yourself
            </h1>
            <p className="text-muted-foreground">
              This helps us personalize your experience
            </p>
          </div>

          <div className="space-y-4">
            {/* Name - Pre-filled, read-only */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={user?.name || ''}
                disabled
                className="bg-muted"
              />
            </div>

            {/* State/Region */}
            <div className="space-y-2">
              <Label htmlFor="region">State / Region</Label>
              <Input
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Your state or region"
              />
            </div>

            {/* City */}
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Your city"
              />
            </div>

            {/* Profession - Bubble selection for "other", hidden for law_student */}
            {isOther && (
              <div className="space-y-2">
                <Label>Profession *</Label>
                <div className="flex flex-wrap gap-2">
                  {PROFESSION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleProfessionSelect(option.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        profession === option.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80 text-foreground'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {/* Custom profession input */}
                {(profession === '' || !PROFESSION_OPTIONS.find(o => o.value === profession)) && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Type your profession..."
                      value={customProfession || (PROFESSION_OPTIONS.find(o => o.value === profession) ? '' : profession)}
                      onChange={(e) => setCustomProfession(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCustomProfessionSubmit();
                        }
                      }}
                    />
                    {customProfession && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCustomProfessionSubmit}
                      >
                        Add
                      </Button>
                    )}
                  </div>
                )}
                {profession && !PROFESSION_OPTIONS.find(o => o.value === profession) && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-foreground flex items-center gap-1">
                      {profession}
                      <button
                        type="button"
                        onClick={() => setProfession('')}
                        className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Bio - Optional, hidden for students */}
            {!isStudent && (
              <div className="space-y-2">
                <Label htmlFor="bio">Bio (Optional)</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us a bit about yourself..."
                  className="min-h-[100px] resize-none"
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {bio.length}/2000
                </p>
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <OnboardingFooter
            onBack={handleBack}
            onNext={handleNext}
            nextLabel={
              shouldShowEducationStep(userType, profession) ? 'Next' : 'Complete'
            }
            isLoading={isSubmitting}
            isNextDisabled={!isValid()}
          />
        </div>
      </div>
    </div>
  );
}
