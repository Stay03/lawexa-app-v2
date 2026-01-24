'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export interface Country {
  name: string;
  code: string; // ISO 3166-1 alpha-2 (e.g., "NG", "US")
}

interface RestCountryResponse {
  name: {
    common: string;
    official: string;
  };
  cca2: string;
}

async function fetchCountries(): Promise<Country[]> {
  const response = await fetch(
    'https://restcountries.com/v3.1/all?fields=name,cca2'
  );

  if (!response.ok) {
    throw new Error('Failed to fetch countries');
  }

  const data: RestCountryResponse[] = await response.json();

  return data
    .map((country) => ({
      name: country.name.common,
      code: country.cca2,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function useCountries(search?: string) {
  const { data: countries, isLoading, error } = useQuery({
    queryKey: ['countries'],
    queryFn: fetchCountries,
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
