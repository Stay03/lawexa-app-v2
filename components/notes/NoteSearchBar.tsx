'use client';

import { useEffect, useState, useRef } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { NoteSortField } from '@/types/note';

interface NoteSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onFilterChange?: (filters: NoteFilters) => void;
  filters?: NoteFilters;
  placeholder?: string;
  showFilters?: boolean;
  className?: string;
}

interface NoteFilters {
  free?: boolean;
  paid?: boolean;
  sort?: NoteSortField;
  order?: 'asc' | 'desc';
}

/**
 * Search bar with debounced input and filter options
 */
function NoteSearchBar({
  value,
  onChange,
  onFilterChange,
  filters = {},
  placeholder = 'Search notes...',
  showFilters = true,
  className,
}: NoteSearchBarProps) {
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

  // Handle price filter change
  const handlePriceFilter = (type: 'all' | 'free' | 'paid') => {
    if (!onFilterChange) return;
    if (type === 'all') {
      onFilterChange({ ...filters, free: undefined, paid: undefined });
    } else if (type === 'free') {
      onFilterChange({ ...filters, free: true, paid: undefined });
    } else {
      onFilterChange({ ...filters, free: undefined, paid: true });
    }
  };

  // Handle sort change
  const handleSortChange = (sortValue: string) => {
    if (!onFilterChange) return;
    const [sort, order] = sortValue.split('-') as [NoteSortField, 'asc' | 'desc'];
    onFilterChange({ ...filters, sort, order });
  };

  // Get current price filter state
  const currentPriceFilter = filters.free ? 'free' : filters.paid ? 'paid' : 'all';

  // Get current sort value
  const currentSort = filters.sort && filters.order
    ? `${filters.sort}-${filters.order}`
    : 'created_at-desc';

  // Count active filters
  const activeFilterCount = [
    filters.free || filters.paid,
    filters.sort && filters.sort !== 'created_at',
  ].filter(Boolean).length;

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      {/* Search input */}
      <form onSubmit={handleSubmit} className="relative flex-1">
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

      {/* Filters */}
      {showFilters && onFilterChange && (
        <div className="flex items-center gap-2">
          {/* Price filter buttons */}
          <div className="hidden items-center gap-1 sm:flex">
            <Button
              variant={currentPriceFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePriceFilter('all')}
            >
              All
            </Button>
            <Button
              variant={currentPriceFilter === 'free' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePriceFilter('free')}
            >
              Free
            </Button>
            <Button
              variant={currentPriceFilter === 'paid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePriceFilter('paid')}
            >
              Paid
            </Button>
          </div>

          {/* Sort dropdown */}
          <Select value={currentSort} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at-desc">Newest first</SelectItem>
              <SelectItem value="created_at-asc">Oldest first</SelectItem>
              <SelectItem value="title-asc">Title A-Z</SelectItem>
              <SelectItem value="title-desc">Title Z-A</SelectItem>
              <SelectItem value="price_ngn-asc">Price: Low to High</SelectItem>
              <SelectItem value="price_ngn-desc">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>

          {/* Mobile filters popover */}
          <Popover>
            <PopoverTrigger asChild className="sm:hidden">
              <Button variant="outline" size="icon" className="relative">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <Badge
                    variant="default"
                    className="absolute -right-1 -top-1 h-4 w-4 p-0 text-[10px]"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48">
              <div className="space-y-3">
                <div className="text-sm font-medium">Price</div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant={currentPriceFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePriceFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    variant={currentPriceFilter === 'free' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePriceFilter('free')}
                  >
                    Free
                  </Button>
                  <Button
                    variant={currentPriceFilter === 'paid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePriceFilter('paid')}
                  >
                    Paid
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

export { NoteSearchBar };
export type { NoteFilters };
