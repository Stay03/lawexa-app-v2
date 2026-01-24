'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { authApi } from '@/lib/api/auth';
import { getTotalSteps } from '@/lib/utils/onboarding';
import { PROFESSION_OPTIONS, getLevelOptions } from '@/types/onboarding';
import { useOnboarding } from '@/lib/hooks/useOnboarding';

export default function OnboardingStep3Page() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    userType,
    communicationStyle,
    profileData,
    setProfileData,
  } = useOnboardingStore();
  const { submitOnboarding, isSubmitting } = useOnboarding();

  // Fetch user data to get location
  const { data: userData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    staleTime: 5 * 60 * 1000,
  });

  const location = (userData?.data as { location?: { country?: string } } | undefined)?.location;
  const detectedCountry = location?.country || '';

  // Form state
  const [profession, setProfession] = useState(profileData.profession || '');
  const [country, setCountry] = useState(profileData.country || detectedCountry);
  const [university, setUniversity] = useState(profileData.university || '');
  const [level, setLevel] = useState(profileData.level || '');
  const [lawSchool, setLawSchool] = useState(profileData.lawSchool || '');
  const [yearOfCall, setYearOfCall] = useState<string>(
    profileData.yearOfCall?.toString() || ''
  );
  const [bio, setBio] = useState(profileData.bio || '');

  // Update country when location is detected
  useEffect(() => {
    if (detectedCountry && !country) {
      setCountry(detectedCountry);
    }
  }, [detectedCountry, country]);

  // Redirect if previous steps not completed
  useEffect(() => {
    if (!userType || !communicationStyle) {
      router.replace('/onboarding/step-1');
    }
  }, [userType, communicationStyle, router]);

  // Determine which fields to show based on user type and profession
  const isStudent = userType === 'law_student' || profession === 'student';
  const isLawyer = userType === 'lawyer';
  const isOther = userType === 'other';

  // Get level options based on country
  const levelOptions = getLevelOptions(country);

  // Auto-set profession for lawyer and law_student
  useEffect(() => {
    if (userType === 'lawyer' && !profession) {
      setProfession('Lawyer');
    } else if (userType === 'law_student' && !profession) {
      setProfession('Law Student');
    }
  }, [userType, profession]);

  const handleBack = () => {
    router.push('/onboarding/step-2');
  };

  const handleNext = () => {
    // Save profile data to store
    setProfileData({
      profession,
      country,
      university: isStudent ? university : undefined,
      level: isStudent ? level : undefined,
      lawSchool: isLawyer ? lawSchool : undefined,
      yearOfCall: isLawyer && yearOfCall ? parseInt(yearOfCall) : undefined,
      bio,
    });

    // Determine next step
    if (userType === 'other') {
      // Submit for "other" users - they skip expertise
      submitOnboarding({
        userType,
        communicationStyle: communicationStyle!,
        profession,
        country,
        university: isStudent ? university : undefined,
        level: isStudent ? level : undefined,
        bio,
      });
    } else {
      // Navigate to step 4 for lawyers and law students
      router.push('/onboarding/step-4');
    }
  };

  // Validation
  const isValid = () => {
    if (isOther && !profession) return false;
    if (isStudent && (!university || !level)) return false;
    return true;
  };

  if (!userType || !communicationStyle) {
    return null;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress currentStep={3} totalSteps={getTotalSteps(userType)} />

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

            {/* Profession - Dropdown for "other", auto-set for lawyer/law_student */}
            {isOther ? (
              <div className="space-y-2">
                <Label htmlFor="profession">Profession *</Label>
                <Select value={profession} onValueChange={setProfession}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your profession" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFESSION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="profession">Profession</Label>
                <Input
                  id="profession"
                  value={profession}
                  disabled
                  className="bg-muted"
                />
              </div>
            )}

            {/* Country - Pre-filled from location */}
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Your country"
              />
            </div>

            {/* University - Required for law_student, shown if profession is student */}
            {isStudent && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="university">University *</Label>
                  <Input
                    id="university"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    placeholder="Enter your university"
                  />
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

            {/* Law School - Optional for lawyers */}
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

            {/* Bio - Optional for all */}
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
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!isValid() || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {userType === 'other' ? 'Complete' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
