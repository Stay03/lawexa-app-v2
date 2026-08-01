'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { FileQuestion, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getTrendingLabel } from '@/types/trending';
import { useV2Session } from '@/v2/runtime/session-context';
import { useUrlSearch } from '@/v2/runtime/use-url-search';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { SearchField } from '@/v2/shell/SearchField';
import { TabRow } from '@/v2/shell/TabRow';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { casesQueries } from '../queries';
import { browseRow, trendingRow, type CaseRowModel } from '../case-row-model';
import { CaseRow } from './CaseRow';
import { RequestCaseDialog } from './RequestCaseDialog';
import {
  CasesEmptyState,
  CasesErrorState,
  CasesListSkeleton,
  CasesSignedOutState,
  NextPageSkeleton,
  TrendingEmptyState,
} from './states';

/**
 * CasesBrowser — the `/cases` body, and the `useSearchParams` consumer (so it
 * lives under the Suspense boundary in `CasesScreen`).
 *
 * ── THE URL IS THE STATE ─────────────────────────────────────────────────────
 * `search`, `tags` and `view` all live in the query string, so every view of the
 * library is a shareable link and the back button does what it looks like it
 * does. All three are written with the NATIVE history API (`replaceUrlParams`),
 * not `router.replace`: this page reads nothing from `searchParams` on the
 * server, so a router navigation would fetch an RSC payload that cannot differ
 * from the one on screen — and each distinct query string is its own router-cache
 * entry, so every keystroke and every tag press would pay a round trip and
 * re-show `loading.tsx`.
 *
 * ── TWO VIEWS, ONE SURFACE ───────────────────────────────────────────────────
 * Library and Trending are different endpoints with different row shapes, mapped
 * to one row model at the edge (`case-row-model.ts`) and rendered by one row
 * component — so the tabs genuinely show the same list ranked two ways.
 *
 * The filters belong to the LIBRARY view and are not rendered on Trending
 * (`/trending/cases` takes no search or tag, and a control that does nothing is
 * worse than no control). Switching views does NOT clear them: the URL keeps the
 * search, so a peek at what is trending and a step back returns the reader to
 * exactly the search they left.
 *
 * ── NO "N NEW" PILL, DELIBERATELY ───────────────────────────────────────────
 * The conversations list announces rows that arrive while you are reading,
 * because you can create one from another tab. Nobody publishes a case from
 * another tab — the library changes when our editors add to it, on a cadence of
 * days — so there is nothing to announce, and the `reference` staleTime is the
 * honest lever instead. See the note in `queries.ts`.
 */

/** Stable empty rows reference — a fresh `[]` per render would churn the memo. */
const NO_ROWS: readonly CaseRowModel[] = [];

/** The centred reading column every state shares — the SHARED v2 list column
 *  (`page-columns.ts`), identical to `/conversations` by construction. */
function PageShell({ children }: { children: React.ReactNode }) {
  return <div className={LIST_COLUMN}>{children}</div>;
}

export function CasesBrowser() {
  const { signedIn, userId: viewerId, role } = useV2Session();
  const searchParams = useSearchParams();
  const { committedSearch, inputValue, onInputChange, onClear } = useUrlSearch();
  const [requestOpen, setRequestOpen] = useState(false);

  const activeSearch = committedSearch.trim();
  const tag = searchParams.get('tags')?.trim() ?? '';
  const view = searchParams.get('view') === 'trending' ? 'trending' : 'library';

  // A content request needs an account; guests are view-only pre-registration.
  const canRequest = viewerId !== null && role !== 'guest';

  const library = useInfiniteQuery({
    ...casesQueries.infiniteList({
      search: activeSearch || undefined,
      tags: tag || undefined,
      viewerId,
    }),
    // MEASURED, not assumed (July 25, 2026): `GET /api/cases` answers **401**
    // without a bearer token, so the library is not readable signed out. Gating
    // the query is what turns that into a designed sign-in state instead of
    // "Couldn't load cases" — and stops a request we know the answer to.
    enabled: signedIn && view === 'library',
    // Keep the current results visible (dimmed) while a new search resolves, so
    // search-as-you-type never flashes a skeleton over rows already on screen.
    placeholderData: keepPreviousData,
  });

  const trending = useInfiniteQuery({
    ...casesQueries.infiniteTrending({ time_range: 'month', viewerId }),
    enabled: signedIn && view === 'trending',
  });

  const query = view === 'trending' ? trending : library;

  const libraryPages = library.data?.pages;
  const trendingPages = trending.data?.pages;
  const rows = useMemo<readonly CaseRowModel[]>(() => {
    if (view === 'trending') {
      return trendingPages?.flatMap((page) => page.data.map(trendingRow)) ?? NO_ROWS;
    }
    return libraryPages?.flatMap((page) => page.data.map(browseRow)) ?? NO_ROWS;
  }, [view, libraryPages, trendingPages]);

  // The contextual ranking label ("Trending in Nigeria"), which is only knowable
  // AFTER the response. It is shown as a quiet line above the list rather than
  // inside the tab, so the tab's width — and therefore the whole control row —
  // never shifts when the data lands.
  const trendingLabel = getTrendingLabel(trendingPages?.[0]?.meta?.filters_applied);

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: query.hasNextPage && !query.isPlaceholderData,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  const setView = (next: 'library' | 'trending') => {
    replaceUrlParams({ view: next === 'trending' ? 'trending' : null });
  };
  const clearFilters = () => {
    replaceUrlParams({ tags: null });
    onClear();
  };

  // Every state decision reads the loaded set, never a projection.
  const showSkeleton = query.isPending;
  const showError = query.isError && rows.length === 0;
  const showEmpty = !showSkeleton && !showError && rows.length === 0;
  const showInlineError = query.isError && rows.length > 0;
  // Dim ONLY while a new search is actually resolving, so an errored, settled
  // query can never strand the list at reduced opacity with pointer-events off.
  const dim = query.isPlaceholderData && query.isFetching;

  if (!signedIn) {
    return (
      <PageShell>
        <CasesSignedOutState />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* The search field renders on BOTH views (owner, July 29) so the surface
          never loses its most-used control — but search FILTERS the library, so
          on Trending the first keystroke's focus hands the reader back to the
          library view. The field stays mounted across the switch, so focus and
          the keystroke that caused it survive; `onFocusCapture` fires before
          the input's own handlers, making the swap invisible. */}
      <div
        onFocusCapture={
          view === 'trending' ? () => setView('library') : undefined
        }
      >
        <SearchField
          value={inputValue}
          onChange={onInputChange}
          onClear={onClear}
          busy={library.isFetching && dim}
          placeholder="Search cases by title..."
          label="Search cases by title"
          className="mb-3"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ViewTabs value={view} onChange={setView} />
        {view === 'library' && tag ? (
          <button
            type="button"
            onClick={clearFilters}
            className={cn(
              'v2-interactive inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/20',
              FOCUS_RING,
            )}
            aria-label={`Remove the ${tag} tag filter`}
          >
            {tag}
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>

      {view === 'trending' && rows.length > 0 ? (
        <p className="mb-1 px-2 text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          {trendingLabel} · past month
        </p>
      ) : null}

      {showSkeleton ? (
        <CasesListSkeleton />
      ) : showError ? (
        <CasesErrorState onRetry={() => void query.refetch()} />
      ) : showEmpty ? (
        view === 'trending' ? (
          <TrendingEmptyState />
        ) : (
          <CasesEmptyState
            search={activeSearch}
            tag={tag}
            onClear={clearFilters}
            onRequest={canRequest ? () => setRequestOpen(true) : undefined}
          />
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
              <CaseRow
                key={row.id}
                row={row}
                searchQuery={view === 'library' ? activeSearch : undefined}
                index={index}
              />
            ))}
          </ul>

          {/* Sentinel + end-cap. While more pages exist this sits at the end of
              the scroll region; scrolling it into view loads the next page. Once
              the list is fully loaded the quiet end-cap replaces it, and a search
              that found only a handful gets the request path there too. */}
          <div ref={sentinelRef} className="pt-1">
            {query.isFetchingNextPage ? (
              <NextPageSkeleton />
            ) : !query.hasNextPage ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <p className="text-center text-xs text-muted-foreground/70">
                  No more cases
                </p>
                {view === 'library' && activeSearch && canRequest && rows.length <= 3 ? (
                  <Button variant="ghost" size="sm" onClick={() => setRequestOpen(true)}>
                    <FileQuestion aria-hidden className="size-4" />
                    Can&rsquo;t find it? Request this case
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {canRequest ? (
        <RequestCaseDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          defaultTitle={activeSearch || undefined}
        />
      ) : null}
    </PageShell>
  );
}

/**
 * The view switch — the shared `TabRow` primitive (full APG tablist contract;
 * see its docblock). Static chrome — it renders on the first frame and never
 * waits on data (v1 hid its tabs behind the list's loading state, which is
 * exactly what standards §8i forbids).
 *
 * The active state is a background that cross-fades on the tab itself, NOT a
 * sliding indicator pill. A sliding pill has to know each tab's width, and these
 * two labels are different lengths — the usual `translate-x-full` trick silently
 * lands a few pixels off. Colour is exact at any label width, and a 120ms
 * `transition-colors` reads as smooth without pretending to be an animation.
 */
function ViewTabs({
  value,
  onChange,
}: {
  value: 'library' | 'trending';
  onChange: (next: 'library' | 'trending') => void;
}) {
  const tabs = [
    { id: 'library' as const, label: 'Library' },
    { id: 'trending' as const, label: 'Trending' },
  ];

  return (
    <TabRow
      tabs={tabs}
      value={value}
      onChange={onChange}
      ariaLabel="Case list view"
      className="inline-flex items-center gap-0.5 rounded-full bg-secondary/60 p-0.5"
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
