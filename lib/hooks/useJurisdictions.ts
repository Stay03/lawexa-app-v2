'use client';

import { useQuery } from '@tanstack/react-query';
import { jurisdictionsApi } from '@/lib/api/jurisdictions';
import { useAuthStore } from '@/lib/stores/authStore';
import type { Jurisdiction } from '@/types/jurisdiction';

/**
 * Disabled until a Bearer token (real-user or guest) is available — a 401
 * from this endpoint on a non-guest-allowlisted page (e.g. `/`) would trip
 * the axios interceptor's redirect-to-/login fallback before useGuestAuth
 * finishes acquiring the guest token on a fresh device.
 */
export function useJurisdictions() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['jurisdictions'],
    queryFn: () => jurisdictionsApi.list(),
    enabled: isAuthenticated,
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
