'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminPagination } from '@/components/admin';
import { AmbassadorsTable, AmbassadorReviewDialog } from '@/components/admin/ambassadors';
import { AmbassadorFilterBar } from '@/components/admin/ambassadors/AmbassadorFilterBar';
import {
  APPLICATION_STATUSES,
  applicationFacets,
  CLEAR_FILTER_UPDATES,
  facetUpdate,
  filterApplications,
  isApplicationsFiltered,
  pageUpdate,
  paginate,
  readView,
  SEARCH_RESETS,
  sortApplications,
  sortUpdate,
  STATUS_LABELS,
  statusCounts,
  statusUpdate,
  SUBMITTED_WINDOW_LABELS,
  toApplicationRows,
  windowUpdate,
  type ApplicationSortColumn,
  type StatusCounts,
} from '@/components/admin/ambassadors/applications';
import { applicationsCsv } from '@/components/admin/ambassadors/applications-csv';
import type { DateWindow, FacetKey } from '@/components/admin/ambassadors/financials';
import { downloadCsv, localDay } from '@/components/admin/ambassadors/financials-csv';

import { useAllAmbassadorApplications } from '@/lib/hooks/useAdminAmbassadors';
import { useUrlSearch } from '@/lib/hooks/useUrlSearch';
import { replaceUrlParams } from '@/lib/utils/url-params';
import type { AmbassadorApplication, AmbassadorStatus } from '@/types/ambassador';

/**
 * Ambassador applications: the queue an admin approves and rejects from.
 *
 * ── THE SERVER FILTERS ON STATUS AND ON NOTHING ELSE ───────────────────────
 * Measured against production on 2026-09-10. `GET /admin/ambassador-applications`
 * honours `status`: `status=approved` returned 114 of the 153 applications. It
 * ignores `search`, `country`, `level`, `university` and `sort=reviewed_at`:
 * each came back with all 153 and the rows unfiltered. It also caps `per_page`
 * at 50, so asking for 100 returns 50.
 *
 * So the screen loads every application once, through
 * `adminAmbassadorsApi.getAllApplications`, which walks the pages until one
 * adds no new uuid, and does everything else in the browser: status, search,
 * the three facets, the date window, the sort and the paging. Status moved
 * into the browser with the rest. A server status filter beside browser facets
 * would be two mechanisms, with the facets counted over a different set of
 * rows from the one the server had filtered.
 *
 * ── A COPIED LINK REOPENS THE SAME VIEW ────────────────────────────────────
 * Every control writes the query string; `ApplicationsView` in
 * `applications.ts` lists the keys. The writes are `replaceUrlParams`, a
 * history write that goes through no navigation, and the search box is
 * `useUrlSearch`, which keeps fast typing intact while the URL catches up. Any
 * filter or sort change deletes `page`, so a changed result opens on its first
 * page.
 *
 * ── THE DATE WINDOW TESTS `created_at` ─────────────────────────────────────
 * Every application carries `created_at`, so the window here is a real filter
 * on when the application was submitted, and each option says "Submitted in
 * the last ...". The financials screen's window tests the last referral and
 * says that instead.
 *
 * ── A REVIEW REACHES THE LIST BEFORE THE DIALOG CLOSES ─────────────────────
 * The rows live in react-query, and `router.refresh()`, which this page called
 * after a review, does not refetch react-query data. Approve and reject return
 * their invalidation of `adminAmbassadorsKeys.all`, the prefix of the
 * all-applications query, so `mutateAsync` resolves after the refetch and the
 * dialog closes onto the new status.
 */

/** The status Select's value for "no status filter". No status has this name. */
const ALL_STATUSES = 'all';

const APPLICATION_NOUN = { one: 'application', many: 'applications' };

/**
 * The status filter, with how many applications each status holds once the
 * other filters are applied. The counts hide while the rows load, when a zero
 * would be a count of nothing.
 */
function StatusSelect({
  value,
  counts,
  onChange,
  disabled,
}: {
  value: AmbassadorStatus | null;
  counts: StatusCounts;
  onChange: (status: AmbassadorStatus | null) => void;
  disabled: boolean;
}) {
  const count = (n: number) =>
    disabled ? null : <span className="tabular-nums text-muted-foreground">{n}</span>;

  return (
    <Select
      value={value ?? ALL_STATUSES}
      onValueChange={(next) =>
        onChange(APPLICATION_STATUSES.find((status) => status === next) ?? null)
      }
      disabled={disabled}
    >
      {/* `title`, not `aria-label`, as in AmbassadorFilterBar: an aria-label
          would replace the chosen status as the control's accessible name. */}
      <SelectTrigger className="w-[180px]" title="Filter by status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_STATUSES}>
          All statuses
          {count(counts.all)}
        </SelectItem>
        {APPLICATION_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {STATUS_LABELS[status]}
            {count(counts[status])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AmbassadorsPageContent() {
  const searchParams = useSearchParams();
  const view = useMemo(() => readView(searchParams), [searchParams]);
  const { filters, sort, page } = view;
  const {
    inputValue: searchInput,
    onInputChange: onSearchInput,
    onClear: clearSearch,
  } = useUrlSearch('search', SEARCH_RESETS);

  const [selected, setSelected] = useState<AmbassadorApplication | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // The clock, read ONCE as the screen opens, as on the financials screen.
  // React Compiler rejects a clock read during render, and a cutoff that moved
  // every frame would make the memos below impossible to reuse.
  const [openedAt] = useState(() => Date.now());

  const query = useAllAmbassadorApplications();
  const rows = useMemo(() => toApplicationRows(query.data ?? []), [query.data]);

  const visible = useMemo(
    () => sortApplications(filterApplications(rows, filters, openedAt), sort),
    [rows, filters, openedAt, sort]
  );
  const facets = useMemo(
    () => applicationFacets(rows, filters, openedAt),
    [rows, filters, openedAt]
  );
  const counts = useMemo(() => statusCounts(rows, filters, openedAt), [rows, filters, openedAt]);
  const paged = useMemo(() => paginate(visible, page), [visible, page]);

  const handleReview = useCallback((application: AmbassadorApplication) => {
    setSelected(application);
    setDialogOpen(true);
  }, []);

  const handleStatusChange = useCallback((status: AmbassadorStatus | null) => {
    replaceUrlParams(statusUpdate(status));
  }, []);

  const handleFacetChange = useCallback(
    (patch: Partial<Record<FacetKey, string | null>>) => {
      replaceUrlParams(facetUpdate(patch));
    },
    []
  );

  const handleWindowChange = useCallback((next: DateWindow) => {
    replaceUrlParams(windowUpdate(next));
  }, []);

  // From the LIVE URL rather than `sort` from the last render: the URL reaches
  // `useSearchParams` in a transition, so a second click before it lands would
  // flip a direction that is already gone.
  const handleSort = useCallback((column: ApplicationSortColumn) => {
    const current = readView(new URLSearchParams(window.location.search)).sort;
    replaceUrlParams(sortUpdate(column, current));
  }, []);

  // A history write does not scroll, and "Next" is pressed at the bottom of the
  // table, so the new page is brought to the top here.
  const handlePageChange = useCallback((next: number) => {
    replaceUrlParams(pageUpdate(next));
    topRef.current?.scrollIntoView({ block: 'start' });
  }, []);

  const handleClear = useCallback(() => {
    clearSearch();
    replaceUrlParams(CLEAR_FILTER_UPDATES);
  }, [clearSearch]);

  const handleExport = useCallback(() => {
    downloadCsv(
      `ambassador-applications-${localDay(new Date())}.csv`,
      applicationsCsv(visible)
    );
  }, [visible]);

  const isLoading = query.isPending;
  // Only when there is nothing to show. A failed background refetch keeps the
  // rows it already had on screen.
  const loadFailed = query.isError && query.data === undefined;

  return (
    <div ref={topRef} className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Ambassador Applications</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={isLoading || visible.length === 0}
          >
            <Download aria-hidden className="size-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <AmbassadorFilterBar
            search={searchInput}
            onSearchChange={onSearchInput}
            searchPlaceholder="Search name, email, phone, school, faculty, country, level, handle"
            searchLabel="Search applications"
            facets={facets}
            selected={filters}
            onFacetChange={handleFacetChange}
            dateWindow={filters.window}
            onDateWindowChange={handleWindowChange}
            dateWindowLabels={SUBMITTED_WINDOW_LABELS}
            dateWindowTitle="Filter by submission date"
            leading={
              <StatusSelect
                value={filters.status}
                counts={counts}
                onChange={handleStatusChange}
                disabled={isLoading || loadFailed}
              />
            }
            filtered={isApplicationsFiltered(filters)}
            onClear={handleClear}
            shown={visible.length}
            total={rows.length}
            noun={APPLICATION_NOUN}
            disabled={isLoading || loadFailed}
          />

          {loadFailed ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
              <p>The applications could not be loaded.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => query.refetch()}
                disabled={query.isFetching}
              >
                Try again
              </Button>
            </div>
          ) : (
            <AmbassadorsTable
              applications={paged.rows}
              isLoading={isLoading}
              onReview={handleReview}
              sort={sort}
              onSort={handleSort}
              empty={
                rows.length === 0 ? (
                  'No ambassador applications yet.'
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <p>No application matches these filters.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleClear}
                    >
                      <X aria-hidden className="size-4" />
                      Clear filters
                    </Button>
                  </div>
                )
              }
            />
          )}

          {!isLoading && paged.pagination.total > 0 && (
            <AdminPagination
              pagination={paged.pagination}
              onPageChange={handlePageChange}
              itemLabel="applications"
            />
          )}
        </CardContent>
      </Card>

      <AmbassadorReviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        application={selected}
      />
    </div>
  );
}

export default function AmbassadorsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <AmbassadorsPageContent />
    </Suspense>
  );
}
