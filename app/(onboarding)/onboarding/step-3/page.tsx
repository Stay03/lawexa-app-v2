'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingFooter } from '@/components/onboarding/OnboardingFooter';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';
import { authApi } from '@/lib/api/auth';
import { useCountries } from '@/lib/hooks/useCountries';
import { getTotalSteps } from '@/lib/utils/onboarding';
import { cn } from '@/lib/utils';

export default function OnboardingStep3Page() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    userType,
    communicationStyle,
    locationData,
    setLocationData,
  } = useOnboardingStore();

  // Fetch user data to get detected location
  const { data: userData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    staleTime: 5 * 60 * 1000,
  });

  const location = (userData?.data as { location?: { country?: string; country_code?: string; region?: string; city?: string } } | undefined)?.location;
  const detectedCountry = location?.country || '';
  const detectedCountryCode = location?.country_code || '';
  const detectedRegion = location?.region || '';
  const detectedCity = location?.city || '';

  // Form state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(locationData.country || '');
  const [selectedCountryCode, setSelectedCountryCode] = useState(locationData.countryCode || '');

  // Initialize with detected country if not already set
  useEffect(() => {
    if (detectedCountry && !selectedCountry) {
      setSelectedCountry(detectedCountry);
      setSelectedCountryCode(detectedCountryCode);
    }
  }, [detectedCountry, detectedCountryCode, selectedCountry]);

  // Fetch all countries
  const { data: allCountries, isLoading: loadingCountries } = useCountries('');

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!allCountries) return [];

    const query = searchQuery.toLowerCase().trim();
    if (!query) return allCountries;

    return allCountries.filter(
      (country) => country.name.toLowerCase().includes(query)
    );
  }, [allCountries, searchQuery]);

  // Separate detected country from the rest
  const { suggestedCountry, otherCountries } = useMemo(() => {
    if (!filteredCountries.length) {
      return { suggestedCountry: null, otherCountries: [] };
    }

    const suggested = detectedCountry
      ? filteredCountries.find((c) => c.name === detectedCountry)
      : null;

    const others = filteredCountries.filter((c) => c.name !== detectedCountry);

    return { suggestedCountry: suggested, otherCountries: others };
  }, [filteredCountries, detectedCountry]);

  // Redirect if previous steps not completed
  useEffect(() => {
    if (!userType || !communicationStyle) {
      router.replace('/onboarding/step-1');
    }
  }, [userType, communicationStyle, router]);

  const handleCountrySelect = (countryName: string, countryCode: string) => {
    setSelectedCountry(countryName);
    setSelectedCountryCode(countryCode);
  };

  const handleBack = () => {
    startTransition(() => {
      router.push('/onboarding/step-2');
    });
  };

  const handleNext = () => {
    const matchesDetected = selectedCountry === detectedCountry;

    // Save location data to store
    setLocationData({
      country: selectedCountry,
      countryCode: selectedCountryCode,
      // Pre-fill region and city only if user selected the detected country
      region: matchesDetected ? detectedRegion : undefined,
      city: matchesDetected ? detectedCity : undefined,
      selectedCountryMatchesDetected: matchesDetected,
    });

    // For lawyer/law_student who selected detected country, skip profile step
    const isLawyerOrLawStudent = userType === 'lawyer' || userType === 'law_student';
    startTransition(() => {
      if (isLawyerOrLawStudent && matchesDetected) {
        // Skip step 4 (profile)
        if (userType === 'law_student') {
          // Law students go to education level selection (step-5)
          router.push('/onboarding/step-5');
        } else {
          // Lawyers skip education and go to expertise (step-7)
          router.push('/onboarding/step-7');
        }
      } else {
        router.push('/onboarding/step-4');
      }
    });
  };

  if (!userType || !communicationStyle) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start p-4 pt-8 pb-24 md:justify-center md:pb-4">
      <div className="w-full max-w-lg space-y-8">
        <OnboardingProgress currentStep={3} totalSteps={getTotalSteps(userType)} />

        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3">
                <MapPin className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Where are you located?
            </h1>
            <p className="text-muted-foreground">
              This helps us provide relevant legal information
            </p>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for your country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Country list */}
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {loadingCountries ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <>
                {/* Suggested country (detected) */}
                {suggestedCountry && !searchQuery && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Suggested for you
                    </p>
                    <button
                      onClick={() => handleCountrySelect(suggestedCountry.name, suggestedCountry.code)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all',
                        'hover:border-primary/50 hover:bg-primary/5',
                        selectedCountry === suggestedCountry.name
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card'
                      )}
                    >
                      <span className="font-medium">{suggestedCountry.name}</span>
                      {selectedCountry === suggestedCountry.name && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  </div>
                )}

                {/* Divider */}
                {suggestedCountry && !searchQuery && otherCountries.length > 0 && (
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-background px-2 text-xs text-muted-foreground">
                        All countries
                      </span>
                    </div>
                  </div>
                )}

                {/* All other countries */}
                <div className="space-y-2">
                  {otherCountries.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => handleCountrySelect(country.name, country.code)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all',
                        'hover:border-primary/50 hover:bg-primary/5',
                        selectedCountry === country.name
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card'
                      )}
                    >
                      <span className="font-medium">{country.name}</span>
                      {selectedCountry === country.name && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>

                {/* No results */}
                {filteredCountries.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No countries found for "{searchQuery}"
                  </p>
                )}
              </>
            )}
          </div>

          {/* Navigation buttons */}
          <OnboardingFooter
            onBack={handleBack}
            onNext={handleNext}
            isNextDisabled={!selectedCountry}
            isLoading={isPending}
          />
        </div>
      </div>
    </div>
  );
}
