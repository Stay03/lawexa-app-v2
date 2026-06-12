'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { useJurisdictions } from '@/lib/hooks/useJurisdictions';
import { RADAR_LIMITS } from '@/lib/utils/radar-validation';

interface JurisdictionsFieldProps {
  // Jurisdiction slugs — the backend resolves slugs unambiguously.
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * Compact jurisdiction multi-select: selected countries render as chips
 * (the user's own jurisdiction is pre-filled by the form) and a dashed
 * "+ Add country" button reveals the search on demand.
 */
function JurisdictionsField({ value, onChange }: JurisdictionsFieldProps) {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const { data: jurisdictions, isLoading } = useJurisdictions();

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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {value.map((slug) => (
          <Badge key={slug} variant="secondary" className="gap-1">
            {nameForSlug(slug)}
            <button
              type="button"
              onClick={() => removeJurisdiction(slug)}
              className="ml-0.5 rounded-full hover:text-destructive"
              aria-label={`Remove ${nameForSlug(slug)}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {!adding && !atCapacity && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="size-3" />
            Add country
          </button>
        )}

        {atCapacity && (
          <span className="text-xs text-muted-foreground">
            Limit of {RADAR_LIMITS.jurisdictions} reached
          </span>
        )}
      </div>

      {adding && !atCapacity && (
        <Combobox
          value=""
          onValueChange={(slug) => {
            if (typeof slug === 'string' && slug) addJurisdiction(slug);
          }}
        >
          <ComboboxInput
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
            className="w-64"
          />
          <ComboboxContent>
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
      )}
    </div>
  );
}

export { JurisdictionsField };
