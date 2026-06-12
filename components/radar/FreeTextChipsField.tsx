'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface FreeTextChipsFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  maxItems: number;
  maxItemLength: number;
  id?: string;
  'aria-invalid'?: boolean;
}

/**
 * Free-text tag input: Enter or comma commits a chip, Backspace on an empty
 * input removes the last one, and comma-separated pastes split into chips.
 */
function FreeTextChipsField({
  value,
  onChange,
  placeholder,
  maxItems,
  maxItemLength,
  id,
  'aria-invalid': ariaInvalid,
}: FreeTextChipsFieldProps) {
  const [draft, setDraft] = useState('');
  const atCapacity = value.length >= maxItems;

  const commitItems = (rawItems: string[]) => {
    const additions = rawItems
      .map((item) => item.trim().slice(0, maxItemLength))
      .filter((item) => item.length > 0 && !value.includes(item));
    if (additions.length === 0) return;
    onChange([...value, ...additions].slice(0, maxItems));
    setDraft('');
  };

  const removeItem = (item: string) => {
    onChange(value.filter((existing) => existing !== item));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'Enter' || event.key === ',') && draft.trim()) {
      event.preventDefault();
      commitItems([draft]);
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
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1">
              {item}
              <button
                type="button"
                onClick={() => removeItem(item)}
                className="ml-0.5 rounded-full hover:text-destructive"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => draft.trim() && commitItems([draft])}
        onPaste={handlePaste}
        placeholder={atCapacity ? `Limit of ${maxItems} reached` : placeholder}
        disabled={atCapacity}
        aria-invalid={ariaInvalid}
      />

      <p className="text-xs text-muted-foreground">
        Press Enter or comma to add · {value.length}/{maxItems}
      </p>
    </div>
  );
}

export { FreeTextChipsField };
