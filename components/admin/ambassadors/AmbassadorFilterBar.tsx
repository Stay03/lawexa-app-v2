'use client';

import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FacetSelect } from './FacetSelect';
import {
  DATE_WINDOWS,
  type DateWindow,
  type FacetKey,
  type FacetOption,
} from './financials';

interface AmbassadorFilterBarProps {
  search: string;
  onSearchChange: (search: string) => void;
  /** Names the fields the search matches, so a match is never a mystery. */
  searchPlaceholder: string;
  searchLabel: string;
  facets: Record<FacetKey, FacetOption[]>;
  selected: Record<FacetKey, string | null>;
  onFacetChange: (patch: Partial<Record<FacetKey, string | null>>) => void;
  dateWindow: DateWindow;
  onDateWindowChange: (dateWindow: DateWindow) => void;
  /** Every option names the date it tests. The two screens test different
   *  dates, so each passes its own words. */
  dateWindowLabels: Record<DateWindow, string>;
  dateWindowTitle: string;
  /** A control placed before the facets: the applications screen's status. */
  leading?: ReactNode;
  filtered: boolean;
  onClear: () => void;
  /** How many rows the table is showing, and how many were loaded. */
  shown: number;
  total: number;
  noun: { one: string; many: string };
  disabled?: boolean;
  /** Lines under the count that say what a filter does not do. */
  notes?: ReactNode;
}

/**
 * Search, three facets and a date window over an ambassador list that is
 * already in the browser.
 *
 * The financials and applications screens both render it. Neither endpoint
 * can filter the way these controls do (financials takes no parameters,
 * measured 2026-09-09; applications honours `status` alone, measured
 * 2026-09-10), so nothing here refetches and clearing everything is always one
 * click away.
 */
export function AmbassadorFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  facets,
  selected,
  onFacetChange,
  dateWindow,
  onDateWindowChange,
  dateWindowLabels,
  dateWindowTitle,
  leading,
  filtered,
  onClear,
  shown,
  total,
  noun,
  disabled,
  notes,
}: AmbassadorFilterBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            disabled={disabled}
            className="pl-9"
          />
        </div>

        {leading}

        <FacetSelect
          allLabel="All universities"
          searchPlaceholder="Search universities…"
          options={facets.university}
          value={selected.university}
          onChange={(university) => onFacetChange({ university })}
          disabled={disabled}
          className="w-[200px]"
        />
        <FacetSelect
          allLabel="All levels"
          searchPlaceholder="Search levels…"
          options={facets.level}
          value={selected.level}
          onChange={(level) => onFacetChange({ level })}
          disabled={disabled}
          className="w-[150px]"
        />
        <FacetSelect
          allLabel="All countries"
          searchPlaceholder="Search countries…"
          options={facets.country}
          value={selected.country}
          onChange={(country) => onFacetChange({ country })}
          disabled={disabled}
          className="w-[160px]"
        />

        <Select
          value={dateWindow}
          onValueChange={(value) => {
            const next = DATE_WINDOWS.find((option) => option === value);
            if (next) onDateWindowChange(next);
          }}
          disabled={disabled}
        >
          {/* `title`, not `aria-label`: an aria-label on the trigger REPLACES
              the accessible name, so it would read the control's purpose and
              swallow the chosen option, which is the half that carries the
              meaning here. */}
          <SelectTrigger className="w-[240px]" title={dateWindowTitle}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_WINDOWS.map((option) => (
              <SelectItem key={option} value={option}>
                {dateWindowLabels[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtered && (
          <Button
            type="button"
            variant="ghost"
            className="h-9 gap-1.5 text-muted-foreground"
            onClick={onClear}
          >
            <X aria-hidden className="size-4" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {/* Nothing is loaded yet while the table is skeletons, and "0
            ambassadors" under them would be a count of nothing dressed as an
            answer. */}
        {!disabled && (
          <p>
            {filtered
              ? `Showing ${shown} of ${total} ${noun.many}`
              : `${total} ${total === 1 ? noun.one : noun.many}`}
          </p>
        )}
        {notes}
      </div>
    </div>
  );
}
