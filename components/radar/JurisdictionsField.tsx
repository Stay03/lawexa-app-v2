'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Combobox,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import { ChipZone, ChipZoneAddButton } from './ChipZone';
import { useJurisdictions } from '@/lib/hooks/useJurisdictions';
import { RADAR_LIMITS } from '@/lib/utils/radar-validation';

interface JurisdictionsFieldProps {
  // Jurisdiction slugs — the backend resolves slugs unambiguously.
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * Jurisdiction chips inside a bounded zone — the user's own jurisdiction is
 * pre-filled by the form; clicking the zone (or the dashed pill) reveals an
 * inline country search.
 */
function JurisdictionsField({ value, onChange }: JurisdictionsFieldProps) {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const { data: jurisdictions, isLoading } = useJurisdictions();
  const anchorRef = useComboboxAnchor();

  const atCapacity = value.length >= RADAR_LIMITS.jurisdictions;
  const nameForSlug = (slug: string) =>
    jurisdictions?.find((jurisdiction) => jurisdiction.slug === slug)?.name ?? slug;

  const available = (jurisdictions ?? []).filter(
    (jurisdiction) =>
      !value.includes(jurisdiction.slug) &&
      (search.trim() === '' ||
        jurisdiction.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        jurisdiction.code.toLowerCase() === search.trim().toLowerCase())
  );

  const addJurisdiction = (slug: string) => {
    if (!value.includes(slug) && !atCapacity) {
      onChange([...value, slug]);
    }
    setSearch('');
    setAdding(false);
  };

  const removeJurisdiction = (slug: string) => {
    onChange(value.filter((existing) => existing !== slug));
  };

  return (
    <Combobox
      value=""
      onValueChange={(slug) => {
        if (typeof slug === 'string' && slug) addJurisdiction(slug);
      }}
    >
      <ChipZone
        ref={anchorRef}
        aria-label="Jurisdictions"
        onClick={() => {
          if (!atCapacity) setAdding(true);
        }}
      >
        {value.map((slug) => (
          <Badge key={slug} variant="secondary" className="gap-1">
            {nameForSlug(slug)}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeJurisdiction(slug);
              }}
              className="ml-0.5 rounded-full hover:text-destructive"
              aria-label={`Remove ${nameForSlug(slug)}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {adding && !atCapacity ? (
          <ComboboxChipsInput
            autoFocus
            placeholder="Search countries…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSearch('');
                setAdding(false);
              }
            }}
            className="h-6 min-w-36 text-sm"
          />
        ) : atCapacity ? (
          <span className="text-xs text-muted-foreground">
            Limit of {RADAR_LIMITS.jurisdictions} reached
          </span>
        ) : (
          <ChipZoneAddButton label="Add country" onClick={() => setAdding(true)} />
        )}
      </ChipZone>

      <ComboboxContent anchor={anchorRef}>
        <ComboboxList>
          {available.map((jurisdiction) => (
            <ComboboxItem key={jurisdiction.slug} value={jurisdiction.slug}>
              {jurisdiction.name}
              <span className="text-xs text-muted-foreground">
                {jurisdiction.code}
              </span>
            </ComboboxItem>
          ))}
          {available.length === 0 && (
            <ComboboxEmpty>
              {isLoading ? 'Loading countries…' : 'No countries found'}
            </ComboboxEmpty>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export { JurisdictionsField };
