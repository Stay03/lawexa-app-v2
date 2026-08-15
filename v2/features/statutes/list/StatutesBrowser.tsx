'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery, keepPreviousData } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useV2Session } from '@/v2/runtime/session-context';
import { useUrlSearch } from '@/v2/runtime/use-url-search';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { useSearchPosition } from '@/v2/search-position';
import { SearchField } from '@/v2/shell/SearchField';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { STATUTE_COUNTRIES_PLACEHOLDER, statutesQueries } from '../queries';
import { resolveCountryId, statuteRow, type StatuteRowModel } from '../statute-row-model';
import { CountryTabs } from './CountryTabs';
import { StatuteRow } from './StatuteRow';
import {
  NextPageSkeleton,
  StatutesEmptyState,
  StatutesErrorState,
  StatutesListSkeleton,
  StatutesSignedOutState,
} from './states';

/**
 * StatutesBrowser — the `/statutes` body, and the `useSearchParams` consumer
 * (so it lives under the Suspense boundary in `StatutesScreen`).
 *
 * ── THE URL IS THE STATE ────────────────────────────────────────────────────
 * `search` and `country` both live in the query string, so every view of the
 * library is a shareable link. Both are written with the NATIVE history API
 * (`replaceUrlParams` — the loud write, since `useSearchParams` consumers
 * must see it), never `router.push`: v1 pushed a router navigation PER
 * KEYSTROKE, so Back rewound a search letter by letter and every keystroke
 * paid an RSC round trip.
 *
 * ── THE COUNTRY TAB IS A SLUG IN THE URL, AN ID ON THE WIRE ─────────────────
 * `?country=ghana` is the shareable form; `GET /statutes` filters by numeric
 * id. The facets query (live endpoint → seed fallback, with a first-frame
 * seed placeholder) is the ONE translation table, and `resolveCountryId` is
 * the one seam both this browser and the RSC prefetch resolve through. An
 * unknown slug resolves to no id — the list honestly shows All.
 *
 * ── SIGNED-OUT ──────────────────────────────────────────────────────────────
 * Measured July 31, 2026: every statute endpoint 401s without a bearer token
 * (guests hold real tokens, so a guest browses normally). The queries are
 * gated on the session and the signed-out visitor gets the designed sign-in
 * state instead of a network error — the cases-list contract.
 */

/** Stable empty rows reference — a fresh `[]` per render would churn the memo. */
const NO_ROWS: readonly StatuteRowModel[] = [];

/**
 * The centred reading column every state shares (`page-columns.ts`) — the
 * DOCKED variant, because the search pill floats at the bottom here and a
 * `sticky` element needs a containing block a full screen tall.
 *
 * The screen's `h1` is drawn here, so the signed-out panel is under a page that
 * still says what it is and every state carries exactly one heading.
 */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={LIST_COLUMN_DOCKED}>
      <ScreenTitle />
      {children}
    </div>
  );
}

export function StatutesBrowser() {
  const { signedIn, userId: viewerId } = useV2Session();
  const searchParams = useSearchParams();
  const { committedSearch, inputValue, onInputChange, onClear } = useUrlSearch();
  // WHERE the field is drawn — the developer switch (`v2/search-position.ts`).
  const searchAtTop = useSearchPosition() === 'top';

  const activeSearch = committedSearch.trim();
  const countrySlug = searchParams.get('country')?.trim() ?? '';

  const countries = useQuery({
    ...statutesQueries.countries(),
    enabled: signedIn,
    // First-frame tabs: the seed mirrors production, so the filter row is
    // never a late arrival that moves the list under the reader.
    placeholderData: STATUTE_COUNTRIES_PLACEHOLDER,
  });
  const facets = countries.data ?? STATUTE_COUNTRIES_PLACEHOLDER;
  const countryId = resolveCountryId(facets, countrySlug);
  const activeCountryName = countryId
    ? (facets.countries.find((facet) => facet.country.id === countryId)?.country
        .name ?? null)
    : null;

  const query = useInfiniteQuery({
    ...statutesQueries.infiniteList({
      search: activeSearch || undefined,
      country: countryId,
      viewerId,
    }),
    enabled: signedIn,
    // Keep the current results visible (dimmed) while a new search or a tab
    // switch resolves — neither ever flashes a skeleton over rows on screen.
    placeholderData: keepPreviousData,
  });

  const pages = query.data?.pages;
  const rows = useMemo<readonly StatuteRowModel[]>(
    () => pages?.flatMap((page) => page.data.map(statuteRow)) ?? NO_ROWS,
    [pages],
  );

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: query.hasNextPage && !query.isPlaceholderData,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  const setCountry = (slug: string) => {
    replaceUrlParams({ country: slug || null });
  };
  const clearFilters = () => {
    replaceUrlParams({ country: null });
    onClear();
  };

  // Every state decision reads the loaded set, never a projection.
  const showSkeleton = query.isPending;
  const showError = query.isError && rows.length === 0;
  const showEmpty = !showSkeleton && !showError && rows.length === 0;
  const showInlineError = query.isError && rows.length > 0;
  // Dim ONLY while a new filter is actually resolving, so an errored, settled
  // query can never strand the list at reduced opacity.
  const dim = query.isPlaceholderData && query.isFetching;

  if (!signedIn) {
    return (
      <PageShell>
        <StatutesSignedOutState />
      </PageShell>
    );
  }

  // Built ONCE and rendered in whichever position the developer switch names,
  // so the two placements cannot drift in placeholder, label or busy state.
  const searchField = (
    <SearchField
      value={inputValue}
      onChange={onInputChange}
      onClear={onClear}
      busy={dim}
      placeholder="Search statutes by title..."
      label="Search statutes by title"
    />
  );

  return (
    <PageShell>
      {searchAtTop ? <div className="mb-3">{searchField}</div> : null}

      <div className="mb-3">
        <CountryTabs facets={facets} value={countrySlug} onChange={setCountry} />
      </div>

      {showSkeleton ? (
        <StatutesListSkeleton />
      ) : showError ? (
        <StatutesErrorState onRetry={() => void query.refetch()} />
      ) : showEmpty ? (
        <StatutesEmptyState
          search={activeSearch}
          countryName={activeCountryName}
          onClear={clearFilters}
        />
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
              className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            >
              <span>Couldn&rsquo;t update the results — showing your last ones.</span>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void query.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : null}

          <ul className="flex flex-col divide-y divide-border/60">
            {rows.map((row, index) => (
              <StatuteRow key={row.id} row={row} index={index} />
            ))}
          </ul>

          {/* Sentinel + end-cap: while more pages exist this sits at the end
              of the scroll region; once fully loaded the quiet end-cap
              replaces it. */}
          <div ref={sentinelRef} className="pt-1">
            {query.isFetchingNextPage ? (
              <NextPageSkeleton />
            ) : !query.hasNextPage ? (
              <p className="py-6 text-center text-xs text-muted-foreground/70">
                No more statutes
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* The floating search pill. No floating action on `/statutes`: browsing
          a library has no one obvious thing to do (the owner's own list). */}
      {searchAtTop ? null : (
        <ScreenDock>
          <ScreenDockSearch>{searchField}</ScreenDockSearch>
        </ScreenDock>
      )}
    </PageShell>
  );
}
