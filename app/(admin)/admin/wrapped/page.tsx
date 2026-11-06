'use client';

import { Suspense, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { WrappedFunnel } from '@/components/admin/wrapped/WrappedFunnel';
import { WrappedSplitTable } from '@/components/admin/wrapped/WrappedSplitTable';
import { WrappedStudentsTable } from '@/components/admin/wrapped/WrappedStudentsTable';
import {
  campusLabel,
  CLEAR_FILTERS,
  editionLabel,
  filterUpdate,
  isFiltered,
  isFilterableCampus,
  pageUpdate,
  percentOf,
  percentText,
  personaLabel,
  readStudentView,
  SEARCH_RESETS,
  splitRows,
  STUDENT_STATUS_LABELS,
  STUDENT_STATUSES,
  storyFunnels,
  STUDENTS_PER_PAGE,
  trackingLine,
  type SplitRow,
} from '@/components/admin/wrapped/wrapped-admin';
import { useWrappedStudents, useWrappedSummary } from '@/lib/hooks/useAdminWrapped';
import { useUrlSearch } from '@/lib/hooks/useUrlSearch';
import { replaceUrlParams } from '@/lib/utils/url-params';
import type { WrappedAdminTotals, WrappedStudentStatus } from '@/types/wrapped-admin';

/**
 * Lawexa Wrapped: who opened their Wrapped and how far they went (Stay's ask,
 * thread f833c285, 6 November 2026; brief 384c 462b8946).
 *
 * ── TWO READS ──────────────────────────────────────────────────────────────
 * The summary (`/admin/wrapped/summary`) draws the totals, the funnel and the
 * two splits. The student list (`/admin/wrapped/students`) is filtered and
 * paged by the server, so only one page of students is ever loaded.
 *
 * ── THE COUNTS START AT THE PUSH ────────────────────────────────────────────
 * The story only reports opens from the release that added the tracking, so
 * the header says from when opens are counted (`tracking_since`).
 *
 * ── A COPIED LINK REOPENS THE SAME LIST ─────────────────────────────────────
 * The list's filters and page live in the query string, written with
 * `replaceUrlParams` as on the ambassador screens. Choosing a personality or a
 * campus in a split table filters the list to it.
 */

/** A Select's value for "no filter". No status, persona or campus has this key. */
const ANY = 'any';

function StatTile({ label, value, note }: { label: string; value: number; note?: string | null }) {
  return (
    <div className="rounded-lg bg-muted/50 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function StatTiles({ totals }: { totals: WrappedAdminTotals }) {
  const share = (n: number) => `${percentText(percentOf(n, totals.have))} of those with one`;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile label="Have a Wrapped" value={totals.have} />
      <StatTile label="Opened" value={totals.opened} note={share(totals.opened)} />
      <StatTile label="Finished" value={totals.finished} note={share(totals.finished)} />
      <StatTile
        label="Shared"
        value={totals.shared}
        note={`${totals.shares.toLocaleString()} ${totals.shares === 1 ? 'share' : 'shares'} in all`}
      />
      <StatTile label="Sign-ups from shares" value={totals.share_signups} />
      <StatTile label="Hid their Wrapped" value={totals.hidden} note="Not counted in Have" />
      {/* Zero until Saturday's notification runs (Backend 8ef3c301), so it shows from then. */}
      {totals.notified > 0 && <StatTile label="Sent the notification" value={totals.notified} />}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  anyLabel,
  title,
  disabled,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
  anyLabel: string;
  title: string;
  disabled: boolean;
}) {
  return (
    <Select value={value ?? ANY} onValueChange={(next) => onChange(next === ANY ? null : next)} disabled={disabled}>
      {/* `title`, not `aria-label`: an aria-label would replace the chosen value as the accessible name. */}
      <SelectTrigger className="w-full sm:w-[190px]" title={title}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{anyLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const optionsOf = (rows: SplitRow[]) => rows.map((row) => ({ value: row.key, label: row.label }));

function WrappedPageContent() {
  const searchParams = useSearchParams();
  const view = useMemo(() => readStudentView(searchParams), [searchParams]);
  const { inputValue: searchInput, onInputChange: onSearchInput, onClear: clearSearch } = useUrlSearch(
    'search',
    SEARCH_RESETS
  );
  const listRef = useRef<HTMLDivElement>(null);

  const summary = useWrappedSummary();
  const studentQuery = useMemo(
    () => ({ ...view, per_page: STUDENTS_PER_PAGE }),
    [view]
  );
  const students = useWrappedStudents(studentQuery);

  const funnels = useMemo(() => (summary.data ? storyFunnels(summary.data) : []), [summary.data]);
  const personaRows = useMemo(
    () => (summary.data ? splitRows(summary.data.by_persona, personaLabel) : []),
    [summary.data]
  );
  const campusRows = useMemo(
    () => (summary.data ? splitRows(summary.data.by_campus, campusLabel) : []),
    [summary.data]
  );
  const campusOptions = useMemo(
    () => optionsOf(campusRows.filter((row) => isFilterableCampus(row.key))),
    [campusRows]
  );

  const setFilter = useCallback((patch: Parameters<typeof filterUpdate>[0]) => {
    replaceUrlParams(filterUpdate(patch));
  }, []);

  // A split table's choice filters the list below, which is then brought into view.
  const selectFromSplit = useCallback((patch: Parameters<typeof filterUpdate>[0]) => {
    replaceUrlParams(filterUpdate(patch));
    listRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  const handlePageChange = useCallback((page: number) => {
    replaceUrlParams(pageUpdate(page));
    listRef.current?.scrollIntoView({ block: 'start' });
  }, []);

  const handleClear = useCallback(() => {
    clearSearch();
    replaceUrlParams(CLEAR_FILTERS);
  }, [clearSearch]);

  const summaryFailed = summary.isError && summary.data === undefined;
  const listFailed = students.isError && students.data === undefined;
  const page = students.data;
  const filtered = isFiltered(view);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lawexa Wrapped</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary.data
            ? `${editionLabel(summary.data.edition)}. ${trackingLine(summary.data.tracking_since)}`
            : 'Who opened their Wrapped, how far they went, and who shared it.'}
        </p>
      </div>

      {summaryFailed ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
            <p>The Wrapped numbers could not be loaded.</p>
            <Button variant="outline" size="sm" onClick={() => summary.refetch()} disabled={summary.isFetching}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !summary.data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px]" />
            ))}
          </div>
          <Skeleton className="h-[380px] w-full" />
        </div>
      ) : (
        <>
          <StatTiles totals={summary.data.totals} />

          <Card>
            <CardHeader>
              <CardTitle>Funnel</CardTitle>
              <CardDescription>
                One funnel per story, since the short story skips cards 2 to 6. Each bar is the share of that
                story&apos;s students.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {funnels.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No story counts yet.</p>
              ) : (
                <div className="grid gap-8 xl:grid-cols-2">
                  {funnels.map((funnel) => (
                    <section key={funnel.story} aria-labelledby={`funnel-${funnel.story}`} className="space-y-3">
                      <div>
                        <h3 id={`funnel-${funnel.story}`} className="text-sm font-semibold">
                          {funnel.title}
                          <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                            {funnel.have.toLocaleString()} {funnel.have === 1 ? 'student' : 'students'}
                          </span>
                        </h3>
                        {funnel.note && <p className="text-xs text-muted-foreground">{funnel.note}</p>}
                      </div>
                      <WrappedFunnel steps={funnel.steps} label={`${funnel.title} funnel`} />
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By personality</CardTitle>
                <CardDescription>Choose one to list its students below.</CardDescription>
              </CardHeader>
              <CardContent>
                <WrappedSplitTable
                  heading="Personality"
                  rows={personaRows}
                  selected={view.persona}
                  onSelect={(persona) => selectFromSplit({ persona })}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By campus</CardTitle>
                <CardDescription>Choose one to list its students below.</CardDescription>
              </CardHeader>
              <CardContent>
                <WrappedSplitTable
                  heading="Campus"
                  rows={campusRows}
                  selected={view.campus}
                  onSelect={(campus) => selectFromSplit({ campus })}
                  canSelect={isFilterableCampus}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div ref={listRef} className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
            <CardDescription>Most recently active first, then those who have not opened theirs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative w-full sm:w-72">
                <Search aria-hidden className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => onSearchInput(event.target.value)}
                  placeholder="Search name or email"
                  aria-label="Search students"
                  className="pl-8"
                />
              </div>
              <FilterSelect
                value={view.status}
                onChange={(status) =>
                  setFilter({ status: STUDENT_STATUSES.find((value) => value === status) ?? null })
                }
                options={STUDENT_STATUSES.map((status: WrappedStudentStatus) => ({
                  value: status,
                  label: STUDENT_STATUS_LABELS[status],
                }))}
                anyLabel="Any progress"
                title="Filter by progress"
                disabled={listFailed}
              />
              <FilterSelect
                value={view.persona}
                onChange={(persona) => setFilter({ persona })}
                options={optionsOf(personaRows)}
                anyLabel="Any personality"
                title="Filter by personality"
                disabled={listFailed || personaRows.length === 0}
              />
              <FilterSelect
                value={view.campus}
                onChange={(campus) => setFilter({ campus })}
                options={campusOptions}
                anyLabel="Any campus"
                title="Filter by campus"
                disabled={listFailed || campusOptions.length === 0}
              />
              {filtered && (
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleClear}>
                  <X aria-hidden className="size-4" />
                  Clear
                </Button>
              )}
              {page && (
                <span className="text-sm text-muted-foreground tabular-nums sm:ml-auto">
                  {page.meta.total.toLocaleString()} {page.meta.total === 1 ? 'student' : 'students'}
                </span>
              )}
            </div>

            {listFailed ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
                <p>The student list could not be loaded.</p>
                <Button variant="outline" size="sm" onClick={() => students.refetch()} disabled={students.isFetching}>
                  Try again
                </Button>
              </div>
            ) : (
              <WrappedStudentsTable
                students={page?.students ?? []}
                isLoading={students.isPending}
                empty={
                  filtered ? (
                    <div className="flex flex-col items-center gap-3">
                      <p>No student matches these filters.</p>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleClear}>
                        <X aria-hidden className="size-4" />
                        Clear filters
                      </Button>
                    </div>
                  ) : (
                    'No student has a Wrapped in this edition yet.'
                  )
                }
              />
            )}

            {page && page.meta.total > 0 && (
              <AdminPagination
                pagination={{
                  ...page.meta,
                  from: (page.meta.current_page - 1) * page.meta.per_page + 1,
                  to: (page.meta.current_page - 1) * page.meta.per_page + page.students.length,
                }}
                onPageChange={handlePageChange}
                itemLabel="students"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminWrappedPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <WrappedPageContent />
    </Suspense>
  );
}
