'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FacetOption {
  value: string;
  label?: string;
  count?: number;
  hint?: string;
}

interface FacetSelectProps {
  placeholder: string;
  value: string | null | undefined;
  options: FacetOption[];
  onChange: (value: string | null) => void;
  isLoading?: boolean;
  allowFreeText?: boolean;
  width?: string;
}

export function FacetSelect({
  placeholder,
  value,
  options,
  onChange,
  isLoading,
  allowFreeText = true,
  width = 'w-[180px]',
}: FacetSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) =>
      (o.label ?? o.value).toLowerCase().includes(q)
    );
  }, [options, search]);

  const showCreate =
    allowFreeText &&
    search.trim() &&
    !options.some(
      (o) => (o.label ?? o.value).toLowerCase() === search.trim().toLowerCase()
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('justify-between font-normal', width)}
        >
          <span className="truncate">
            {value ? value : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          {value ? (
            <X
              className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="border-b p-2">
          <Input
            autoFocus
            placeholder={`Search ${placeholder.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {isLoading && !options.length ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              Loading…
            </div>
          ) : filtered.length === 0 && !showCreate ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              No matches
            </div>
          ) : (
            <>
              {filtered.map((option) => {
                const label = option.label ?? option.value;
                const selected = value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent',
                      selected && 'bg-accent'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Check
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          selected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="truncate">{label}</span>
                      {option.hint && (
                        <span className="text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      )}
                    </span>
                    {option.count !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {option.count.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
              {showCreate && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(search.trim());
                    setOpen(false);
                    setSearch('');
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-primary hover:bg-accent"
                >
                  <span className="text-xs">Use:</span>
                  <span className="font-medium truncate">{search.trim()}</span>
                </button>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
