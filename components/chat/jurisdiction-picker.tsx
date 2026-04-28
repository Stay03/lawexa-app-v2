'use client';

import { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
} from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { JurisdictionFlag, jurisdictionFlagCode } from '@/components/chat/jurisdiction-flag';
import type { Jurisdiction, JurisdictionChoice } from '@/types/jurisdiction';

const NONE_VALUE = '__none__';

interface JurisdictionPickerProps {
  jurisdictions: Jurisdiction[];
  value: JurisdictionChoice;
  onChange: (next: JurisdictionChoice) => void;
  isLoading?: boolean;
  className?: string;
}

function choiceToValue(choice: JurisdictionChoice): string {
  if (choice.mode === 'none') return NONE_VALUE;
  if (choice.mode === 'override') return choice.slug;
  return ''; // 'auto' — no item selected
}

function valueToChoice(value: string): JurisdictionChoice {
  if (value === NONE_VALUE) return { mode: 'none' };
  if (!value) return { mode: 'auto' };
  return { mode: 'override', slug: value };
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

  const currentValue = choiceToValue(value);

  return (
    <Combobox
      value={currentValue}
      onValueChange={(next) => {
        if (typeof next !== 'string') return;
        onChange(valueToChoice(next));
        setSearch('');
      }}
    >
      <ComboboxInput
        placeholder={isLoading ? 'Loading…' : 'Search jurisdictions…'}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={isLoading}
        className={cn('w-full', className)}
      />

      <ComboboxContent>
        <ComboboxList>
          {filtered.map((j) => {
            const code = jurisdictionFlagCode(j);
            return (
              <ComboboxItem
                key={j.slug}
                value={j.slug}
                className="flex items-center gap-2.5"
              >
                <JurisdictionFlag code={code} className="shrink-0" />
                <span className="font-medium truncate">{j.name}</span>
                {j.parent && (
                  <span className="text-xs text-muted-foreground truncate">
                    ({j.parent.name})
                  </span>
                )}
              </ComboboxItem>
            );
          })}

          {filtered.length === 0 && !isLoading && (
            <ComboboxEmpty>No jurisdictions match.</ComboboxEmpty>
          )}

          <ComboboxSeparator />

          <ComboboxItem
            value={NONE_VALUE}
            className="flex items-center gap-2.5"
          >
            <Layers className="size-4 text-muted-foreground shrink-0" />
            <span>No specific jurisdiction (comparative)</span>
          </ComboboxItem>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
