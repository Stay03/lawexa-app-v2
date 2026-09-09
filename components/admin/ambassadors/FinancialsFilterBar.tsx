'use client';

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
  DATE_WINDOW_LABELS,
  isFiltered,
  NO_FILTERS,
  type DateWindow,
  type FacetKey,
  type FacetOption,
  type FinancialsFilters,
} from './financials';

interface FinancialsFilterBarProps {
  filters: FinancialsFilters;
  onChange: (patch: Partial<FinancialsFilters>) => void;
  facets: Record<FacetKey, FacetOption[]>;
  /** How many rows the table is showing, and how many were loaded. */
  shown: number;
  total: number;
  disabled?: boolean;
  /** The applications call is what carries university, level and country. When
   *  it fails the three pickers are empty, and saying so beats an empty menu. */
  profilesFailed?: boolean;
}

/**
 * Search, three facets and a date window over the loaded financials rows.
 *
 * Every control narrows an array that is already in the browser — the endpoint
 * takes no parameters (measured 2026-09-09) — so nothing here refetches and
 * clearing everything is always one click away.
 */
export function FinancialsFilterBar({
  filters,
  onChange,
  facets,
  shown,
  total,
  disabled,
  profilesFailed,
}: FinancialsFilterBarProps) {
  const filtered = isFiltered(filters);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Search name, email, code, university, country, level"
            aria-label="Search ambassadors"
            disabled={disabled}
            className="pl-9"
          />
        </div>

        <FacetSelect
          allLabel="All universities"
          searchPlaceholder="Search universities…"
          options={facets.university}
          value={filters.university}
          onChange={(university) => onChange({ university })}
          disabled={disabled}
          className="w-[200px]"
        />
        <FacetSelect
          allLabel="All levels"
          searchPlaceholder="Search levels…"
          options={facets.level}
          value={filters.level}
          onChange={(level) => onChange({ level })}
          disabled={disabled}
          className="w-[150px]"
        />
        <FacetSelect
          allLabel="All countries"
          searchPlaceholder="Search countries…"
          options={facets.country}
          value={filters.country}
          onChange={(country) => onChange({ country })}
          disabled={disabled}
          className="w-[160px]"
        />

        {/* The window filters ONE date — the last referral. It cannot narrow the
            counts or the money to a period, because the row carries no per-day
            history and the endpoint takes no date parameter, so every option
            says out loud which date it is testing. */}
        <Select
          value={filters.window}
          onValueChange={(value) => onChange({ window: value as DateWindow })}
          disabled={disabled}
        >
          {/* `title`, not `aria-label`: an aria-label on the trigger REPLACES
              the accessible name, so it would read the control's purpose and
              swallow the chosen option, which is the half that carries the
              meaning here. */}
          <SelectTrigger className="w-[240px]" title="Filter by last referral">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_WINDOWS.map((option) => (
              <SelectItem key={option} value={option}>
                {DATE_WINDOW_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtered && (
          <Button
            type="button"
            variant="ghost"
            className="h-9 gap-1.5 text-muted-foreground"
            onClick={() => onChange(NO_FILTERS)}
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
              ? `Showing ${shown} of ${total} ambassadors`
              : `${total} ${total === 1 ? 'ambassador' : 'ambassadors'}`}
          </p>
        )}
        {filters.window !== 'all' && (
          <p>
            Filtered on when each ambassador last referred somebody. The counts and
            the money in the table are all-time either way.
          </p>
        )}
        {profilesFailed && (
          <p>
            University, level and country could not be loaded, so those three
            filters are empty and the search does not match them.
          </p>
        )}
      </div>
    </div>
  );
}
