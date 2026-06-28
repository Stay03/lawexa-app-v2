'use client';

import { Globe } from 'lucide-react';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { JurisdictionFlag } from '@/components/chat/jurisdiction-flag';
import { getCountryCode } from '@/lib/constants/country-codes';
import { useStatuteCountries } from '@/lib/hooks/useStatutes';
import { cn } from '@/lib/utils';
import type { Country } from '@/types/case';

// Sentinel tab value for the default "all countries" view (no country filter).
export const ALL_COUNTRIES = 'all';

// Resolve a flag-renderable ISO 3166-1 alpha-2 code for a country: prefer the
// API's own 2-letter `code`, falling back to a lookup by name.
function countryFlagCode(c: Country): string | undefined {
  if (c.code && c.code.length === 2) return c.code.toUpperCase();
  return getCountryCode(c.name) ?? undefined;
}

interface StatuteCountryTabsProps {
  // Active tab — ALL_COUNTRIES or a String(country.id).
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function StatuteCountryTabs({
  value,
  onValueChange,
  className,
}: StatuteCountryTabsProps) {
  const { data } = useStatuteCountries();
  const countries = data?.countries ?? [];

  const tabs = [
    {
      value: ALL_COUNTRIES,
      icon: <Globe className="h-4 w-4" />,
      label: 'All',
    },
    ...countries.map((facet) => ({
      value: String(facet.country.id),
      icon: <JurisdictionFlag code={countryFlagCode(facet.country)} />,
      label: facet.country.name,
    })),
  ];

  return (
    <div className={cn('overflow-x-auto pb-1', className)}>
      <AnimatedTabs tabs={tabs} value={value} onValueChange={onValueChange} />
    </div>
  );
}
