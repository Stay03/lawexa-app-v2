'use client';

import { useMemo, useState } from 'react';
import { Check, Layers, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { JurisdictionFlag, jurisdictionFlagCode } from '@/components/chat/jurisdiction-flag';
import type { Jurisdiction, JurisdictionChoice } from '@/types/jurisdiction';

interface JurisdictionPickerProps {
  jurisdictions: Jurisdiction[];
  value: JurisdictionChoice;
  onChange: (next: JurisdictionChoice) => void;
  isLoading?: boolean;
  className?: string;
}

export function JurisdictionPicker({
  jurisdictions,
  value,
  onChange,
  isLoading,
  className,
}: JurisdictionPickerProps) {
  const [search, setSearch] = useState('');

  const sortedList = useMemo(
    () => [...jurisdictions].sort((a, b) => a.name.localeCompare(b.name)),
    [jurisdictions],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sortedList;
    return sortedList.filter((j) => {
      if (j.name.toLowerCase().includes(needle)) return true;
      if (j.code.toLowerCase().includes(needle)) return true;
      if (j.parent && j.parent.name.toLowerCase().includes(needle)) return true;
      return false;
    });
  }, [sortedList, search]);

  const selectedSlug = value.mode === 'override' ? value.slug : null;
  const isNoneSelected = value.mode === 'none';

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={isLoading}
          placeholder={isLoading ? 'Loading…' : 'Search jurisdictions…'}
          className={cn(
            'w-full rounded-lg border bg-background pl-8 pr-2 py-1.5 text-sm',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring/30',
            'disabled:opacity-50',
          )}
          autoFocus
        />
      </div>

      <div
        role="listbox"
        aria-label="Jurisdictions"
        className="max-h-72 overflow-y-auto overscroll-contain pt-1"
      >
        {filtered.map((j) => {
          const code = jurisdictionFlagCode(j);
          const isSelected = selectedSlug === j.slug;
          return (
            <button
              key={j.slug}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onChange({ mode: 'override', slug: j.slug })}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm',
                'hover:bg-accent hover:text-accent-foreground transition-colors',
                isSelected && 'bg-accent/60 text-accent-foreground',
              )}
            >
              <JurisdictionFlag code={code} className="shrink-0" />
              <span className="font-medium truncate">{j.name}</span>
              {j.parent && (
                <span className="text-xs text-muted-foreground truncate">
                  ({j.parent.name})
                </span>
              )}
              {isSelected && (
                <Check className="ml-auto size-4 shrink-0 text-primary" />
              )}
            </button>
          );
        })}

        {filtered.length === 0 && !isLoading && (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            No jurisdictions match.
          </div>
        )}
      </div>

      <div className="border-t pt-1">
        <button
          type="button"
          role="option"
          aria-selected={isNoneSelected}
          onClick={() => onChange({ mode: 'none' })}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm',
            'hover:bg-accent hover:text-accent-foreground transition-colors',
            isNoneSelected && 'bg-accent/60 text-accent-foreground',
          )}
        >
          <Layers className="size-4 shrink-0 text-muted-foreground" />
          <span>No specific jurisdiction (comparative)</span>
          {isNoneSelected && (
            <Check className="ml-auto size-4 shrink-0 text-primary" />
          )}
        </button>
      </div>
    </div>
  );
}
