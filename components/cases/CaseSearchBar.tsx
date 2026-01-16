'use client';

import { useEffect, useState, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CaseSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Search bar with debounced input
 */
function CaseSearchBar({
  value,
  onChange,
  placeholder = 'Search cases...',
  className,
}: CaseSearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const isPendingRef = useRef(false);

  // Sync local value with external value ONLY when not actively typing
  useEffect(() => {
    if (!isPendingRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  // Debounce the onChange callback
  useEffect(() => {
    if (localValue === value) {
      isPendingRef.current = false;
      return;
    }
    isPendingRef.current = true;
    const timer = setTimeout(() => {
      isPendingRef.current = false;
      onChange(localValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, onChange, value]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isPendingRef.current = true;
    setLocalValue(e.target.value);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    isPendingRef.current = false;
    onChange(localValue);
  };

  // Clear search input
  const handleClear = () => {
    isPendingRef.current = false;
    setLocalValue('');
    onChange('');
  };

  return (
    <form onSubmit={handleSubmit} className={cn('relative', className)}>
      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-10 pr-10"
      />
      {localValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Clear search</span>
        </Button>
      )}
    </form>
  );
}

export { CaseSearchBar };
