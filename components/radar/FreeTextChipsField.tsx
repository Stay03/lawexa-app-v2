'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface FreeTextChipsFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  /** Singular noun for the add affordance, e.g. "topic" → "+ Add topic" */
  itemNoun: string;
  placeholder: string;
  maxItems: number;
  maxItemLength: number;
}

/**
 * Compact free-text tags: existing values render as chips and a dashed
 * "+ Add" button reveals a small input on demand. Enter or comma commits and
 * keeps the input open for rapid entry; blur commits and closes; Escape
 * discards. Comma-separated pastes split into chips.
 */
function FreeTextChipsField({
  value,
  onChange,
  itemNoun,
  placeholder,
  maxItems,
  maxItemLength,
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
    <div className="flex flex-wrap items-center gap-2">
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

      {adding && !atCapacity ? (
        <Input
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
          className="h-8 w-52 text-sm"
        />
      ) : (
        !atCapacity && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="size-3" />
            Add {itemNoun}
          </button>
        )
      )}

      {atCapacity && (
        <span className="text-xs text-muted-foreground">
          Limit of {maxItems} reached
        </span>
      )}
    </div>
  );
}

export { FreeTextChipsField };
