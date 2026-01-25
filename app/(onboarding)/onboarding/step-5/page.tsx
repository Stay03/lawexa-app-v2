'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingFooter } from '@/components/onboarding/OnboardingFooter';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import { useUniversitySearch } from '@/lib/hooks/useUniversities';
import {
  getTotalSteps,
  shouldShowEducationStep,
  shouldShowExpertiseStep,
} from '@/lib/utils/onboarding';
import { getLevelOptions } from '@/types/onboarding';

export default function OnboardingStep5Page() {
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
  const [university, setUniversity] = useState(profileData.university || '');
  const [universitySearch, setUniversitySearch] = useState('');
  const [level, setLevel] = useState(profileData.level || '');
  const [lawSchool, setLawSchool] = useState(profileData.lawSchool || '');
  const [yearOfCall, setYearOfCall] = useState<string>(
    profileData.yearOfCall?.toString() || ''
  );

  // University dropdown - filter by country code from location
  const { data: universities, isLoading: loadingUniversities } = useUniversitySearch(
    universitySearch,
    locationData.countryCode
  );

  // Redirect if previous steps not completed or education step not needed
  useEffect(() => {
    if (!userType || !communicationStyle) {
      router.replace('/onboarding/step-1');
    } else if (!shouldShowEducationStep(userType, profileData.profession)) {
      // Skip education step for non-students who aren't lawyers
      router.replace('/onboarding/step-4');
    }
  }, [userType, communicationStyle, profileData.profession, router]);

  const isLawyer = userType === 'lawyer';
  const isStudent = userType === 'law_student' || profileData.profession === 'student';

  // Get level options based on country
  const levelOptions = getLevelOptions(locationData.country || '');

  const handleUniversitySelect = (universityName: string | null) => {
    setUniversity(universityName || '');
    setUniversitySearch('');
  };

  const handleBack = () => {
    router.push('/onboarding/step-4');
  };

  const handleNext = () => {
    // Save education data to store
    setProfileData({
      university: isStudent ? university : undefined,
      level: isStudent ? level : undefined,
      lawSchool: isLawyer ? lawSchool : undefined,
      yearOfCall: isLawyer && yearOfCall ? parseInt(yearOfCall) : undefined,
      areaOfStudy: userType === 'law_student' ? 'law' : undefined,
    });

    // Determine next step
    if (shouldShowExpertiseStep(userType)) {
      // Lawyers and law students go to expertise step
      router.push('/onboarding/step-6');
    } else {
      // "Other" users with student profession complete here
      submitOnboarding({
        userType: userType!,
        communicationStyle: communicationStyle!,
        ...locationData,
        ...profileData,
        university: isStudent ? university : undefined,
        level: isStudent ? level : undefined,
        areaOfStudy: userType === 'law_student' ? 'law' : undefined,
      });
    }
  };

  // Validation
  const isValid = () => {
    if (isStudent && (!university || !level)) return false;
    return true;
  };

  if (!userType || !communicationStyle || !shouldShowEducationStep(userType, profileData.profession)) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start p-4 pt-8 pb-24 md:justify-center md:pb-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress
          currentStep={5}
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
              {isLawyer ? 'Your legal education' : 'Your education'}
            </h1>
            <p className="text-muted-foreground">
              {isLawyer
                ? 'Tell us about your legal background'
                : 'Tell us about your current studies'}
            </p>
          </div>

          <div className="space-y-4">
            {/* University - For students (law_student or other+student) */}
            {isStudent && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="university">University *</Label>
                  <Combobox
                    value={university}
                    onValueChange={handleUniversitySelect}
                  >
                    <ComboboxInput
                      id="university"
                      placeholder="Search for your university..."
                      value={universitySearch}
                      onChange={(e) => setUniversitySearch(e.target.value)}
                      showClear={!!university}
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>
                        {loadingUniversities
                          ? 'Searching...'
                          : universitySearch.length < 2
                            ? 'Type at least 2 characters to search'
                            : 'No universities found'}
                      </ComboboxEmpty>
                      <ComboboxList>
                        {universities?.map((u) => (
                          <ComboboxItem key={u.id} value={u.name}>
                            {u.name}
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  {university && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {university}
                    </p>
                  )}
                </div>

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
              </>
            )}

            {/* Law School and Year of Call - For lawyers */}
            {isLawyer && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lawSchool">Law School (Optional)</Label>
                  <Input
                    id="lawSchool"
                    value={lawSchool}
                    onChange={(e) => setLawSchool(e.target.value)}
                    placeholder="e.g., Nigerian Law School"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="yearOfCall">Year of Call (Optional)</Label>
                  <Input
                    id="yearOfCall"
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    value={yearOfCall}
                    onChange={(e) => setYearOfCall(e.target.value)}
                    placeholder="e.g., 2015"
                  />
                </div>
              </>
            )}
          </div>

          {/* Navigation buttons */}
          <OnboardingFooter
            onBack={handleBack}
            onNext={handleNext}
            nextLabel={shouldShowExpertiseStep(userType) ? 'Next' : 'Complete'}
            isLoading={isSubmitting}
            isNextDisabled={!isValid()}
          />
        </div>
      </div>
    </div>
  );
}
