'use client';

import { AmbassadorFilterBar } from './AmbassadorFilterBar';
import {
  DATE_WINDOW_LABELS,
  isFiltered,
  NO_FILTERS,
  type FacetKey,
  type FacetOption,
  type FinancialsFilters,
} from './financials';

const AMBASSADOR_NOUN = { one: 'ambassador', many: 'ambassadors' };

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
 *
 * The bar itself is `AmbassadorFilterBar`, which the applications screen shares;
 * this component supplies the financials words.
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
  // The window filters ONE date — the last referral. It cannot narrow the
  // counts or the money to a period, because the row carries no per-day
  // history and the endpoint takes no date parameter, so every option says out
  // loud which date it is testing.
  return (
    <AmbassadorFilterBar
      search={filters.search}
      onSearchChange={(search) => onChange({ search })}
      searchPlaceholder="Search name, email, code, university, country, level"
      searchLabel="Search ambassadors"
      facets={facets}
      selected={filters}
      onFacetChange={onChange}
      dateWindow={filters.window}
      onDateWindowChange={(next) => onChange({ window: next })}
      dateWindowLabels={DATE_WINDOW_LABELS}
      dateWindowTitle="Filter by last referral"
      filtered={isFiltered(filters)}
      onClear={() => onChange(NO_FILTERS)}
      shown={shown}
      total={total}
      noun={AMBASSADOR_NOUN}
      disabled={disabled}
      notes={
        <>
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
        </>
      }
    />
  );
}
