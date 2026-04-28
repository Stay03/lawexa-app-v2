'use client';

import { useQuery } from '@tanstack/react-query';
import { jurisdictionsApi } from '@/lib/api/jurisdictions';
import type { Jurisdiction } from '@/types/jurisdiction';

export function useJurisdictions() {
  return useQuery({
    queryKey: ['jurisdictions'],
    queryFn: () => jurisdictionsApi.list(),
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7d
  });
}

export function findDefaultJurisdiction(
  list: Jurisdiction[] | undefined,
  profileCountry: string | undefined,
): Jurisdiction | undefined {
  if (!list || !profileCountry) return undefined;
  const needle = profileCountry.trim().toLowerCase();
  if (!needle) return undefined;
  return list.find(
    (j) =>
      j.name.toLowerCase() === needle || j.code.toLowerCase() === needle
  );
}
