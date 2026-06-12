'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ChipZone, ChipZoneAddButton } from './ChipZone';

interface FreeTextChipsFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  /** Singular noun for the add affordance, e.g. "topic" → "+ Add topic" */
  itemNoun: string;
  placeholder: string;
  maxItems: number;
  maxItemLength: number;
  'aria-label'?: string;
}

/**
 * Compact free-text tags inside a bounded chip zone. Clicking the zone (or
 * the dashed add pill) reveals an inline input: Enter or comma commits and
 * stays open for rapid entry, blur commits and closes, Escape discards.
 * Comma-separated pastes split into chips.
 */
function FreeTextChipsField({
  value,
  onChange,
  itemNoun,
  placeholder,
  maxItems,
  maxItemLength,
  'aria-label': ariaLabel,
}: FreeTextChipsFieldProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const atCapacity = value.length >= maxItems;

  const commitItems = (rawItems: string[]) => {
    const additions = rawItems
      .map((item) => item.trim().slice(0, maxItemLength))
      .filter((item) => item.length > 0 && !value.includes(item));
    if (additions.length > 0) {
      onChange([...value, ...additions].slice(0, maxItems));
    }
    setDraft('');
  };

  const removeItem = (item: string) => {
    onChange(value.filter((existing) => existing !== item));
  };

  const closeInput = () => {
    setAdding(false);
    setDraft('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'Enter' || event.key === ',') && draft.trim()) {
      event.preventDefault();
      commitItems([draft]);
    } else if (event.key === 'Escape') {
      closeInput();
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      removeItem(value[value.length - 1]);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    if (pasted.includes(',') || pasted.includes(';')) {
      event.preventDefault();
      commitItems(pasted.split(/[,;]/));
    }
  };

  return (
    <ChipZone
      aria-label={ariaLabel}
      onClick={() => {
        if (!atCapacity) setAdding(true);
      }}
    >
      {value.map((item) => (
        <Badge key={item} variant="secondary" className="gap-1">
          {item}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              removeItem(item);
            }}
            className="ml-0.5 rounded-full hover:text-destructive"
            aria-label={`Remove ${item}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {adding && !atCapacity ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            if (draft.trim()) commitItems([draft]);
            closeInput();
          }}
          placeholder={placeholder}
          className="h-6 min-w-36 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      ) : atCapacity ? (
        <span className="text-xs text-muted-foreground">
          Limit of {maxItems} reached
        </span>
      ) : (
        <ChipZoneAddButton
          label={`Add ${itemNoun}`}
          onClick={() => setAdding(true)}
        />
      )}
    </ChipZone>
  );
}

export { FreeTextChipsField };
