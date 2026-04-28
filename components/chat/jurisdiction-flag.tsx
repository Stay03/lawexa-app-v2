'use client';

import ReactCountryFlag from 'react-country-flag';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Jurisdiction } from '@/types/jurisdiction';

// Map a Jurisdiction to a flag-renderable ISO 3166-1 alpha-2 code.
// Most jurisdictions have a 2-letter ISO code (AU, NG, US, etc).
// UK sub-jurisdictions (England & Wales, Scotland, Northern Ireland) carry
// non-ISO codes like ENG/SCT/NIR — fall back to the parent UK flag (GB)
// since react-country-flag does not support subdivision codes.
export function jurisdictionFlagCode(j: Jurisdiction | undefined): string | undefined {
  if (!j) return undefined;
  if (j.code.length === 2) return j.code.toUpperCase();
  if (j.parent?.slug === 'united-kingdom') return 'GB';
  return undefined;
}

interface JurisdictionFlagProps {
  code: string | undefined;
  className?: string;
}

// Renders a small flag image. Falls back to a neutral globe when no code.
export function JurisdictionFlag({ code, className }: JurisdictionFlagProps) {
  if (!code) {
    return <Globe className={cn('size-4 text-muted-foreground', className)} />;
  }
  return (
    <ReactCountryFlag
      countryCode={code}
      svg
      style={{ width: '1.1em', height: '1.1em', borderRadius: '2px' }}
      className={className}
      aria-hidden="true"
    />
  );
}
