'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface AbuseLogFiltersProps {
  searchValue: string;
  deviceIdValue: string;
  dateFrom: string;
  dateTo: string;
  onSearchChange: (value: string) => void;
  onDeviceIdChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear: () => void;
}

export function AbuseLogFilters({
  searchValue,
  deviceIdValue,
  dateFrom,
  dateTo,
  onSearchChange,
  onDeviceIdChange,
  onDateFromChange,
  onDateToChange,
  onClear,
}: AbuseLogFiltersProps) {
  const hasActiveFilters = searchValue || deviceIdValue || dateFrom || dateTo;

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Device ID */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:w-[280px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-[240px]">
          <Input
            placeholder="Filter by device ID..."
            value={deviceIdValue}
            onChange={(e) => onDeviceIdChange(e.target.value)}
            className="font-mono text-sm"
          />
          {deviceIdValue && (
            <button
              onClick={() => onDeviceIdChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Date range + Clear */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-[160px]"
          max={dateTo || undefined}
        />
        <span className="text-sm text-muted-foreground">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-[160px]"
          min={dateFrom || undefined}
        />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="gap-1">
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
