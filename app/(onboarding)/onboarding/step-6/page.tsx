'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Search, Check, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingFooter } from '@/components/onboarding/OnboardingFooter';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import {
  useUniversitiesByCountry,
  useGlobalUniversitySearch,
} from '@/lib/hooks/useUniversities';
import { useAllExpertise } from '@/lib/hooks/useExpertise';
import {
  getTotalSteps,
  shouldShowEducationStep,
  shouldShowExpertiseStep,
  shouldSkipProfileStep,
} from '@/lib/utils/onboarding';
import { getLevelOptions, getLawSchoolOptions } from '@/types/onboarding';
import { cn } from '@/lib/utils';

export default function OnboardingStep6Page() {
  const router = useRouter();
  const {
    userType,
    communicationStyle,
    locationData,
    profileData,
    studentEducationLevel,
    setProfileData,
  } = useOnboardingStore();
  const { submitOnboarding, isSubmitting } = useOnboarding();

  // Prefetch expertise data so step-7 loads instantly
  useAllExpertise();

  // Form state
  const [university, setUniversity] = useState(profileData.university || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [level, setLevel] = useState(profileData.level || '');
  const [lawSchool, setLawSchool] = useState(profileData.lawSchool || '');

  // Fetch universities from user's country
  const { data: countryUniversities, isLoading: loadingCountryUniversities } =
    useUniversitiesByCountry(locationData.countryCode);

  // Search all universities globally when user types in search
  const { data: searchResults, isLoading: loadingSearch } =
    useGlobalUniversitySearch(searchQuery);

  // Determine which universities to show
  const displayUniversities = useMemo(() => {
    if (searchQuery.length >= 2) {
      // Show global search results
      return searchResults || [];
    }
    // Show universities from user's country
    return countryUniversities || [];
  }, [searchQuery, searchResults, countryUniversities]);

  // Check if profile step was skipped
  const skipProfile = shouldSkipProfileStep(
    userType,
    locationData.selectedCountryMatchesDetected || false
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

  const isLawStudent = userType === 'law_student';

  // Determine which form to show based on user type and education level selection
  const showUniversityForm = isLawStudent
    ? studentEducationLevel === 'university'
    : isLawStudent || profileData.profession === 'student'; // other+student always see university form

  const showLawSchoolForm = isLawStudent
    ? studentEducationLevel === 'law_school'
    : false;

  // Get level options based on country
  const levelOptions = getLevelOptions(locationData.country || '');

  // Get law school options based on country (null if no predefined options)
  const lawSchoolOptions = getLawSchoolOptions(locationData.country || '');

  const handleUniversitySelect = (universityName: string) => {
    setUniversity(universityName);
    setSearchQuery('');
  };

  const handleBack = () => {
    if (isLawStudent) {
      // Law students go back to education level selection (step-5)
      router.push('/onboarding/step-5');
    } else if (skipProfile) {
      router.push('/onboarding/step-3');
    } else {
      router.push('/onboarding/step-4');
    }
  };

  const handleNext = () => {
    // Save education data to store
    setProfileData({
      university: showUniversityForm ? university : undefined,
      level: showUniversityForm ? level : undefined,
      lawSchool: showLawSchoolForm ? lawSchool : undefined,
      areaOfStudy: isLawStudent ? 'law' : undefined,
    });

    // Determine next step
    if (shouldShowExpertiseStep(userType)) {
      // Lawyers and law students go to expertise step
      router.push('/onboarding/step-7');
    } else {
      // "Other" users with student profession complete here
      submitOnboarding({
        userType: userType!,
        communicationStyle: communicationStyle!,
        ...locationData,
        ...profileData,
        university: showUniversityForm ? university : undefined,
        level: showUniversityForm ? level : undefined,
        areaOfStudy: isLawStudent ? 'law' : undefined,
      });
    }
  };

  // Validation
  const isValid = () => {
    if (showUniversityForm && (!university || !level)) return false;
    if (showLawSchoolForm && !lawSchool) return false;
    return true;
  };

  if (
    !userType ||
    !communicationStyle ||
    !shouldShowEducationStep(userType, profileData.profession)
  ) {
    return null;
  }

  const isLoading = loadingCountryUniversities || loadingSearch;

  // Calculate current step number: law students have an extra step (education level selection)
  const currentStep = (skipProfile ? 4 : 5) + (isLawStudent ? 1 : 0);

  return (
    <div className="flex min-h-screen flex-col items-center justify-start p-4 pt-8 pb-24 md:justify-center md:pb-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress
          currentStep={currentStep}
          totalSteps={getTotalSteps(userType, profileData.profession, skipProfile)}
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

          <div className="space-y-4">
            {/* University - For students selecting university path */}
            {showUniversityForm && (
              <>
                <div className="space-y-2">
                  <Label>University *</Label>

                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search for your university..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* University list */}
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : displayUniversities.length > 0 ? (
                      displayUniversities.map((uni) => (
                        <button
                          key={uni.id}
                          type="button"
                          onClick={() => handleUniversitySelect(uni.name)}
                          className={cn(
                            'w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all',
                            'hover:border-primary/50 hover:bg-primary/5',
                            university === uni.name
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-card'
                          )}
                        >
                          <div>
                            <span className="font-medium text-sm">{uni.name}</span>
                            {uni.country && searchQuery && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({uni.country})
                              </span>
                            )}
                          </div>
                          {university === uni.name && (
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                        </button>
                      ))
                    ) : searchQuery.length >= 2 ? (
                      <div className="space-y-3">
                        <p className="text-center text-muted-foreground py-2 text-sm">
                          No universities found for &quot;{searchQuery}&quot;
                        </p>
                        <button
                          type="button"
                          onClick={() => handleUniversitySelect(searchQuery)}
                          className={cn(
                            'w-full flex items-center gap-3 rounded-xl border border-dashed p-3 text-left transition-all',
                            'hover:border-primary/50 hover:bg-primary/5',
                            'border-primary/30'
                          )}
                        >
                          <div className="rounded-full bg-primary/10 p-1.5">
                            <Plus className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <span className="font-medium text-sm">Add &quot;{searchQuery}&quot;</span>
                            <p className="text-xs text-muted-foreground">Use this as your university</p>
                          </div>
                        </button>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4 text-sm">
                        {locationData.country
                          ? `No universities found in ${locationData.country}`
                          : 'Search for your university'}
                      </p>
                    )}
                  </div>

                  {university && (
                    <p className="text-xs text-muted-foreground">
                      Selected: <span className="font-medium">{university}</span>
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

            {/* Law School - For law students who selected law school path */}
            {showLawSchoolForm && (
              <div className="space-y-2">
                <Label htmlFor="lawSchool">Law School *</Label>
                {lawSchoolOptions ? (
                  <Select value={lawSchool} onValueChange={setLawSchool}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select your law school" />
                    </SelectTrigger>
                    <SelectContent>
                      {lawSchoolOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="lawSchool"
                    value={lawSchool}
                    onChange={(e) => setLawSchool(e.target.value)}
                    placeholder="Enter your law school"
                  />
                )}
              </div>
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
