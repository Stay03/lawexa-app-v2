'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { CitedByFilters, CitedBySort } from '@/types/case';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { SearchField } from '@/v2/shell/SearchField';
import { TabRow } from '@/v2/shell/TabRow';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { AuthorityRow } from '../detail/AuthorityList';
import { casesQueries } from '../queries';
import {
  DEFAULT_CITED_BY_QUERY,
  citedBySummary,
  citingCaseItem,
  flattenCitingPages,
  isNarrowed,
  visibleYears,
  type CitedByQuery,
} from './model';
import {
  CitedByEmptyState,
  CitedByErrorState,
  CitedByListSkeleton,
  CitedByNoMatchState,
  FilterChipsSkeleton,
  NextPageSkeleton,
} from './states';
import { useSheetSide } from './use-sheet-side';

/** Matches `useUrlSearch`: a pause long enough that typing is one request. */
const SEARCH_DEBOUNCE_MS = 300;

const SORTS: { id: CitedBySort; label: string }[] = [
  { id: 'most_cited', label: 'Most cited' },
  { id: 'newest', label: 'Newest' },
];

/**
 * CitedByPanel — every later case that cites this one, in a sheet over the
 * case page: from the right on a desktop, from the bottom on a phone. Opened by
 * "See all N" under the section's ten; the caller owns the `Sheet` root and
 * the trigger, this is the content.
 *
 * ── THE PANEL HOLDS NO ADDRESS ──────────────────────────────────────────────
 * Open/closed, search, sort and filters are component state. The case route
 * sits under the rewritten `[slug]` segment, where a history write the App
 * Router notices sets off the `/cases/undefined` refetch loop documented in
 * `v2/runtime/url-params.ts` and `CaseScreen`. So the panel adds no history
 * entry: Back with it open leaves the case page, as Back does with any other
 * sheet in v2. Closing it (the X, Escape, the overlay, a swipe) puts focus back
 * on "See all", and the page under it never scrolled, because the shell's
 * scroll region is not the one the dialog locks.
 *
 * ── THE FILTERS NEVER SHRINK ────────────────────────────────────────────────
 * Every response carries the courts and years among ALL the citing cases,
 * whatever the request narrowed to. The chips are drawn from that, so picking
 * "Court of Appeal" leaves "Supreme Court" there to switch to, with the same
 * counts. A change keeps the last rows on screen, dimmed, until the new first
 * page lands: no skeleton flash over a list already there.
 *
 * The body mounts when the sheet opens and unmounts after it closes, so each
 * opening starts on Most cited with nothing narrowed; the query cache makes a
 * second opening instant.
 */
export function CitedByPanel({
  slug,
  total,
  caseName,
}: {
  slug: string;
  total: number;
  caseName: string;
}) {
  const side = useSheetSide();
  const contentRef = useRef<HTMLDivElement | null>(null);

  return (
    <SheetContent
      ref={contentRef}
      side={side}
      // Width and height must be stated per side: the primitive sizes with
      // `data-[side=*]` selectors, which outrank a bare utility.
      className={cn(
        'flex flex-col gap-0 p-0 outline-none',
        'data-[side=right]:w-full data-[side=right]:sm:max-w-lg',
        'v2-safe-bottom data-[side=bottom]:h-[92svh] data-[side=bottom]:rounded-t-2xl',
      )}
      // On a phone, focusing the search box on open would raise the keyboard
      // over the list the reader asked to see. The dialog itself takes focus
      // there; on a desktop the search box takes it, ready to type.
      onOpenAutoFocus={(event) => {
        if (side !== 'bottom') return;
        event.preventDefault();
        contentRef.current?.focus();
      }}
    >
      <CitedByPanelBody slug={slug} total={total} caseName={caseName} />
    </SheetContent>
  );
}

function CitedByPanelBody({
  slug,
  total,
  caseName,
}: {
  slug: string;
  total: number;
  caseName: string;
}) {
  const { userId: viewerId } = useV2Session();
  const [query, setQuery] = useState<CitedByQuery>(DEFAULT_CITED_BY_QUERY);
  const [inputValue, setInputValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = debounceRef;
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const onInputChange = (value: string) => {
    setInputValue(value);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setQuery((prev) => ({ ...prev, search: value })),
      SEARCH_DEBOUNCE_MS,
    );
  };
  const onClearSearch = () => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    setInputValue('');
    setQuery((prev) => ({ ...prev, search: '' }));
  };
  const onClearAll = () => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    setInputValue('');
    setQuery((prev) => ({ ...DEFAULT_CITED_BY_QUERY, sort: prev.sort }));
  };

  const list = useInfiniteQuery({
    ...casesQueries.infiniteCitedBy(slug, { ...query, viewerId }),
    placeholderData: keepPreviousData,
  });

  const pages = list.data?.pages;
  const items = useMemo(() => flattenCitingPages(pages).map(citingCaseItem), [pages]);
  const filters = pages?.[0]?.filters ?? null;
  const matches = pages?.[0]?.pagination.total ?? null;
  const narrowed = isNarrowed(query);

  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement, HTMLDivElement>({
    hasNextPage: list.hasNextPage && !list.isPlaceholderData,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: list.fetchNextPage,
    rootRef: bodyRef,
    rootMargin: '320px',
  });

  const showSkeleton = list.isPending;
  const showError = list.isError && items.length === 0;
  const showEmpty = !showSkeleton && !showError && items.length === 0;
  const showInlineError = list.isError && items.length > 0;
  const dim = list.isPlaceholderData && list.isFetching;

  return (
    <>
      <SheetHeader className="gap-3 border-b px-4 pb-3 pt-4 sm:px-5">
        <div className="flex min-w-0 flex-col gap-0.5 pr-10">
          <SheetTitle className="text-left text-base font-semibold">
            Cited by
            <span className="text-muted-foreground/60 tabular-nums"> · {total}</span>
          </SheetTitle>
          <SheetDescription className="truncate text-left text-xs">{caseName}</SheetDescription>
        </div>
        <SearchField
          value={inputValue}
          onChange={onInputChange}
          onClear={onClearSearch}
          busy={dim}
          placeholder="Search name or citation"
          label="Search the citing cases by name or citation"
        />
        <SortTabs
          value={query.sort}
          onChange={(sort) => setQuery((prev) => ({ ...prev, sort }))}
        />
      </SheetHeader>

      <div
        ref={bodyRef}
        className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="border-b border-border/60 px-4 py-3 sm:px-5">
          {filters ? (
            <FilterChips
              filters={filters}
              courtId={query.courtId}
              year={query.year}
              onCourt={(courtId) => setQuery((prev) => ({ ...prev, courtId }))}
              onYear={(year) => setQuery((prev) => ({ ...prev, year }))}
            />
          ) : showError ? null : (
            <FilterChipsSkeleton />
          )}
        </div>

        <div className="px-2 pb-8 pt-2 sm:px-3">
          {matches !== null && !showEmpty ? (
            <p
              role="status"
              className="px-2 pb-1 text-xs text-muted-foreground tabular-nums motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            >
              {citedBySummary(matches, total, narrowed && !list.isPlaceholderData)}
            </p>
          ) : null}

          {showSkeleton ? (
            <CitedByListSkeleton />
          ) : showError ? (
            <CitedByErrorState onRetry={() => void list.refetch()} retrying={list.isFetching} />
          ) : showEmpty ? (
            narrowed ? (
              <CitedByNoMatchState onClear={onClearAll} />
            ) : (
              <CitedByEmptyState />
            )
          ) : (
            <div
              className={cn(
                'transition-opacity duration-200 motion-reduce:transition-none',
                dim && 'pointer-events-none opacity-60',
              )}
            >
              {showInlineError ? (
                <div
                  role="alert"
                  className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
                >
                  <span>Couldn&rsquo;t load more. Showing what loaded last.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => void list.refetch()}
                  >
                    Try again
                  </Button>
                </div>
              ) : null}

              <ul className="flex flex-col divide-y divide-border/60 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                {items.map((item) => (
                  <li key={item.key}>
                    <AuthorityRow item={item} />
                  </li>
                ))}
              </ul>

              {/* Sentinel + end cap: skeleton rows while the next page loads,
                  a quiet line once every page has. Never both. */}
              <div ref={sentinelRef} className="pt-1">
                {list.isFetchingNextPage ? (
                  <NextPageSkeleton />
                ) : !list.hasNextPage ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/70">
                    {narrowed ? 'No more matches' : 'That is every citing case'}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Most cited | Newest — the cases list's segmented control, same primitive. */
function SortTabs({
  value,
  onChange,
}: {
  value: CitedBySort;
  onChange: (next: CitedBySort) => void;
}) {
  return (
    <TabRow
      tabs={SORTS}
      value={value}
      onChange={onChange}
      ariaLabel="Sort the citing cases"
      className="inline-flex items-center gap-0.5 self-start rounded-full bg-secondary/60 p-0.5"
      tabClassName={(selected) =>
        cn(
          'v2-interactive min-h-8 rounded-full px-3.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
          selected
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {(tab) => tab.label}
    </TabRow>
  );
}

/**
 * The court and year chips. Single choice per row; pressing the chosen chip
 * again, or the row's "All", lifts it. Years fold to the newest few behind
 * "More years" (`visibleYears`), because a case cited since the 1980s has
 * forty of them.
 */
function FilterChips({
  filters,
  courtId,
  year,
  onCourt,
  onYear,
}: {
  filters: CitedByFilters;
  courtId: number | null;
  year: number | null;
  onCourt: (courtId: number | null) => void;
  onYear: (year: number | null) => void;
}) {
  const [allYears, setAllYears] = useState(false);
  const { shown, hidden } = visibleYears(filters.years, year, allYears);

  return (
    <div className="flex flex-col gap-2.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {filters.courts.length > 0 ? (
        <ChipGroup label="Court">
          <Chip selected={courtId === null} onClick={() => onCourt(null)}>
            All courts
          </Chip>
          {filters.courts.map((court) => (
            <Chip
              key={court.id}
              selected={court.id === courtId}
              count={court.count}
              onClick={() => onCourt(court.id === courtId ? null : court.id)}
            >
              {court.name}
            </Chip>
          ))}
        </ChipGroup>
      ) : null}
      {filters.years.length > 0 ? (
        <ChipGroup label="Year">
          <Chip selected={year === null} onClick={() => onYear(null)}>
            Any year
          </Chip>
          {shown.map((entry) => (
            <Chip
              key={entry.year}
              selected={entry.year === year}
              count={entry.count}
              onClick={() => onYear(entry.year === year ? null : entry.year)}
            >
              {entry.year}
            </Chip>
          ))}
          {hidden > 0 || allYears ? (
            <button
              type="button"
              onClick={() => setAllYears((prev) => !prev)}
              aria-expanded={allYears}
              className={cn(
                'v2-interactive inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
                FOCUS_RING,
              )}
            >
              {allYears ? (
                <>
                  <ChevronUp aria-hidden className="size-3.5" />
                  Fewer years
                </>
              ) : (
                <>
                  <ChevronDown aria-hidden className="size-3.5" />
                  More years
                </>
              )}
            </button>
          ) : null}
        </ChipGroup>
      ) : null}
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {children}
    </div>
  );
}

function Chip({
  selected,
  count,
  onClick,
  children,
}: {
  selected: boolean;
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'v2-interactive inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
        selected
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border/70 text-muted-foreground hover:border-border hover:text-foreground',
        FOCUS_RING,
      )}
    >
      {children}
      {count !== undefined ? (
        <span
          className={cn(
            'tabular-nums',
            selected ? 'text-primary/70' : 'text-muted-foreground/60',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
