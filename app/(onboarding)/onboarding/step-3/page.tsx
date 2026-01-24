'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react';
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
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { authApi } from '@/lib/api/auth';
import { getTotalSteps } from '@/lib/utils/onboarding';
import { PROFESSION_OPTIONS, getLevelOptions } from '@/types/onboarding';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import { useCountries } from '@/lib/hooks/useCountries';
import { useUniversitySearch } from '@/lib/hooks/useUniversities';

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

  const location = (userData?.data as { location?: { country?: string; region?: string; city?: string } } | undefined)?.location;
  const detectedCountry = location?.country || '';
  const detectedRegion = location?.region || '';
  const detectedCity = location?.city || '';

  // Form state
  const [profession, setProfession] = useState(profileData.profession || '');
  const [customProfession, setCustomProfession] = useState('');
  const [country, setCountry] = useState(profileData.country || detectedCountry);
  const [countryCode, setCountryCode] = useState(profileData.countryCode || '');
  const [countrySearch, setCountrySearch] = useState('');
  const [region, setRegion] = useState(profileData.region || detectedRegion);
  const [city, setCity] = useState(profileData.city || detectedCity);
  const [university, setUniversity] = useState(profileData.university || '');
  const [universitySearch, setUniversitySearch] = useState('');
  const [level, setLevel] = useState(profileData.level || '');
  const [lawSchool, setLawSchool] = useState(profileData.lawSchool || '');
  const [yearOfCall, setYearOfCall] = useState<string>(
    profileData.yearOfCall?.toString() || ''
  );
  const [bio, setBio] = useState(profileData.bio || '');

  // Country dropdown
  const { data: filteredCountries, isLoading: loadingCountries } = useCountries(countrySearch);

  // University dropdown - filter by country code
  const { data: universities, isLoading: loadingUniversities } = useUniversitySearch(
    universitySearch,
    countryCode
  );

  // Update location when detected
  useEffect(() => {
    if (detectedCountry && !country) {
      setCountry(detectedCountry);
    }
    if (detectedRegion && !region) {
      setRegion(detectedRegion);
    }
    if (detectedCity && !city) {
      setCity(detectedCity);
    }
  }, [detectedCountry, detectedRegion, detectedCity, country, region, city]);

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
      setProfession('lawyer');
    } else if (userType === 'law_student' && !profession) {
      setProfession('student');
    }
  }, [userType, profession]);

  const handleBack = () => {
    router.push('/onboarding/step-2');
  };

  const handleCountrySelect = (selectedCountry: { name: string; code: string }) => {
    setCountry(selectedCountry.name);
    setCountryCode(selectedCountry.code);
    setCountrySearch('');
    // Reset university when country changes
    setUniversity('');
    setUniversitySearch('');
  };

  const handleUniversitySelect = (universityName: string | null) => {
    setUniversity(universityName || '');
    setUniversitySearch('');
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
    const finalProfession = isLawyer ? 'lawyer' : isStudent && userType === 'law_student' ? 'student' : profession;

    // Save profile data to store
    setProfileData({
      profession: finalProfession,
      country,
      countryCode,
      region,
      city,
      university: isStudent ? university : undefined,
      level: isStudent ? level : undefined,
      lawSchool: isLawyer ? lawSchool : undefined,
      yearOfCall: isLawyer && yearOfCall ? parseInt(yearOfCall) : undefined,
      bio,
      areaOfStudy: userType === 'law_student' ? 'law' : undefined,
    });

    // Determine next step
    if (userType === 'other') {
      // Submit for "other" users - they skip expertise
      submitOnboarding({
        userType,
        communicationStyle: communicationStyle!,
        profession: finalProfession,
        country,
        countryCode,
        region,
        city,
        university: isStudent ? university : undefined,
        level: isStudent ? level : undefined,
        bio,
        areaOfStudy: isStudent ? 'law' : undefined,
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

            {/* Profession - Bubble selection for "other", auto-set for lawyer/law_student */}
            {isOther ? (
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
            ) : (
              <div className="space-y-2">
                <Label htmlFor="profession">Profession</Label>
                <Input
                  id="profession"
                  value={isLawyer ? 'Lawyer' : 'Law Student'}
                  disabled
                  className="bg-muted"
                />
              </div>
            )}

            {/* Country - Searchable dropdown */}
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Combobox
                value={country}
                onValueChange={(value) => {
                  const found = filteredCountries?.find(c => c.name === value);
                  if (found) {
                    handleCountrySelect(found);
                  }
                }}
              >
                <ComboboxInput
                  id="country"
                  placeholder="Search for your country..."
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  showClear={!!country}
                />
                <ComboboxContent>
                  <ComboboxEmpty>
                    {loadingCountries ? 'Loading countries...' : 'No countries found'}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {filteredCountries?.slice(0, 50).map((c) => (
                      <ComboboxItem key={c.code} value={c.name}>
                        {c.name}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {country && (
                <p className="text-xs text-muted-foreground">
                  Selected: {country}
                </p>
              )}
            </div>

            {/* Region/State */}
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

            {/* University - Required for law_student, shown if profession is student */}
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
