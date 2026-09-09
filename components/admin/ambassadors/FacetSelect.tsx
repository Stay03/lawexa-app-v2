'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { FacetOption } from './financials';

/** Above this many choices the list gets its own search box. Ninety
 *  universities came back on 2026-09-09 and scrolling ninety names to find one
 *  is not a filter. */
const SEARCHABLE_FROM = 8;

interface FacetSelectProps {
  /** What the control filters by, shown when nothing is picked. */
  allLabel: string;
  options: FacetOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * One dimension of the financials filter, picked from the values that are
 * actually in the loaded rows.
 *
 * The options are never a hard-coded list: universities, levels and countries
 * are whatever the ambassadors themselves wrote on their applications, so the
 * caller counts them off the rows and hands them over. The count beside each
 * one is how many ambassadors the OTHER filters leave in it, which is what
 * makes it possible to see a dead end before clicking it.
 */
export function FacetSelect({
  allLabel,
  options,
  value,
  onChange,
  searchPlaceholder = 'Search…',
  disabled,
  className,
}: FacetSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const term = query.trim().toLowerCase();
  const visible = term
    ? options.filter((option) => option.value.toLowerCase().includes(term))
    : options;

  const pick = (next: string | null) => {
    onChange(next);
    setQuery('');
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-9 justify-between gap-2 font-normal',
            value === null && 'text-muted-foreground',
            className
          )}
          disabled={disabled || options.length === 0}
        >
          <span className="truncate">{value ?? allLabel}</span>
          <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-0 p-0">
        {options.length >= SEARCHABLE_FROM && (
          <div className="relative border-b">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 rounded-none border-0 pl-9 focus-visible:ring-0"
            />
          </div>
        )}

        <div className="max-h-72 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
          >
            <Check
              aria-hidden
              className={cn('size-4 shrink-0', value === null ? 'opacity-100' : 'opacity-0')}
            />
            <span className="flex-1 truncate">{allLabel}</span>
          </button>

          {visible.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => pick(option.value)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60',
                option.value === value && 'bg-muted/50'
              )}
            >
              <Check
                aria-hidden
                className={cn(
                  'size-4 shrink-0',
                  option.value === value ? 'opacity-100' : 'opacity-0'
                )}
              />
              <span className="flex-1 truncate">{option.value}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {option.count}
              </span>
            </button>
          ))}

          {visible.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nothing matches “{query.trim()}”.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
