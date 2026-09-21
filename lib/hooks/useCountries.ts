'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { countriesApi } from '@/lib/api/countries';
import type { Country } from '@/lib/api/countries';

export type { Country };

/**
 * THE FETCHER USED TO LIVE HERE, AND SO DID A COPY OF IT IN v2.
 *
 * Both called `restcountries.com/v3.1`, which retired that version and now
 * answers HTTP 200 with a deprecation body — so `if (!response.ok) throw`
 * never fired, `.map` ran over an object, and every country list in the app
 * went empty in silence. Both copies now call `lib/api/countries.ts`, which
 * reads our own `/countries/iso`. One module, because two copies is how one of
 * them gets fixed and the other does not.
 */

export function useCountries(search?: string) {
  const { data: countries, isLoading, error } = useQuery({
    queryKey: ['countries'],
    queryFn: countriesApi.getAll,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - countries rarely change
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
  });

  const filteredCountries = useMemo(() => {
    if (!countries) return [];
    if (!search || search.trim() === '') return countries;

    const searchLower = search.toLowerCase().trim();
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(searchLower) ||
        country.code.toLowerCase().includes(searchLower)
    );
  }, [countries, search]);

  return {
    data: filteredCountries,
    allCountries: countries || [],
    isLoading,
    error,
  };
}

export function useCountryByCode(code: string | undefined) {
  const { allCountries } = useCountries();

  return useMemo(() => {
    if (!code || !allCountries.length) return null;
    return allCountries.find((c) => c.code === code) || null;
  }, [code, allCountries]);
}
