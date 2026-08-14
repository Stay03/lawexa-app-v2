'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, Search } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPagination } from '@/components/admin';
import { SegmentedControl } from '@/components/admin/observability';
import {
  CaseReviewList,
  DuplicatesList,
  ProblemNav,
} from '@/components/admin/case-data-review';
import {
  useCaseDataReview,
  useCaseDataReviewSummary,
  useCaseDuplicates,
} from '@/lib/hooks/useAdminCaseDataReview';
import type {
  CaseProblemCount,
  CaseProblemKey,
  DuplicateGroupBy,
} from '@/types/admin-case-data-review';

const SEARCH_DEBOUNCE_MS = 350;

/**
 * What the list is showing. "Correction" means a corrected title and citation
 * and nothing wider, so these labels say that rather than "can be fixed", which
 * would promise that a missing judgment could be recovered here.
 */
type FixView = 'all' | 'fixable' | 'blocked';

const FIX_VIEWS = [
  { value: 'all' as const, label: 'All' },
  { value: 'fixable' as const, label: 'Correction ready' },
  { value: 'blocked' as const, label: 'No correction' },
];

const GROUP_BY_OPTIONS = [
  { value: 'title' as const, label: 'By title' },
  { value: 'citation' as const, label: 'By citation' },
];

/******************************************************************************
                                Page Content
******************************************************************************/

function CaseDataReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tab = searchParams.get('tab') === 'duplicates' ? 'duplicates' : 'problems';
  const urlProblem = searchParams.get('problem') as CaseProblemKey | null;
  const fixView: FixView =
    searchParams.get('fix') === 'blocked'
      ? 'blocked'
      : searchParams.get('fix') === 'fixable'
        ? 'fixable'
        : 'all';
  const search = searchParams.get('search') ?? '';
  const page = Number(searchParams.get('page')) || 1;
  const groupBy: DuplicateGroupBy =
    searchParams.get('by') === 'citation' ? 'citation' : 'title';

  const { data: summaryData, isLoading: summaryLoading } = useCaseDataReviewSummary();

  /**
   * The problem list, its order and its labels all come from the server. The
   * API defines each problem once, so the menu and the table cannot disagree
   * about how much work exists; restating any of it here would put a second
   * copy in the frontend and reintroduce exactly that risk.
   */
  const problems = useMemo(
    () =>
      Object.entries(summaryData?.data.problems ?? {}) as [
        CaseProblemKey,
        CaseProblemCount,
      ][],
    [summaryData]
  );

  /**
   * Derived, never stored. With no problem in the address the screen opens on
   * the first one the server sends, so the table is never a list of healthy
   * cases: asking this endpoint for "everything" returns all 11,571 live cases,
   * problems or not, which is not what a review queue is for.
   */
  const selectedProblem = urlProblem ?? problems[0]?.[0] ?? null;
  const selectedCount = problems.find(([key]) => key === selectedProblem)?.[1];

  const listParams = useMemo(
    () => ({
      problem: selectedProblem ?? undefined,
      blocked: fixView === 'all' ? undefined : fixView === 'blocked',
      search: search || undefined,
      page,
      per_page: 15,
    }),
    [selectedProblem, fixView, search, page]
  );

  const { data: listData, isLoading: listLoading } = useCaseDataReview(listParams);
  const { data: duplicatesData, isLoading: duplicatesLoading } = useCaseDuplicates(
    { by: groupBy, page, per_page: 10 },
    { enabled: tab === 'duplicates' }
  );

  const updateParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      const qs = next.toString();
      router.push(qs ? `/admin/cases/data-review?${qs}` : '/admin/cases/data-review');
    },
    [router, searchParams]
  );

  /* Local, so typing stays instant, and pushed to the address on a pause so a
     filtered view stays shareable. Debounced in the handler rather than an
     effect: an effect here would run on every render that changed anything
     else, and re-push a search nobody retyped. */
  const [searchDraft, setSearchDraft] = useState(search);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = useCallback(
    (value: string) => {
      setSearchDraft(value);
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        updateParams({ search: value || null, page: 1 });
      }, SEARCH_DEBOUNCE_MS);
    },
    [updateParams]
  );

  const emptyMessage = useMemo(() => {
    if (search) return `No case matches "${search}" in this problem.`;
    if (fixView === 'blocked') {
      return 'Nothing is blocked here. Every case with this problem has a correction ready.';
    }
    if (fixView === 'fixable') {
      return 'No correction can be computed for any case with this problem yet.';
    }
    return 'No case carries this problem.';
  }, [search, fixView]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ClipboardList className="h-6 w-6 text-primary" />
          Case Data Review
        </h1>
        <p className="text-sm text-muted-foreground">
          What is wrong with our case data, before an import rewrites it. Nothing
          on this screen changes anything.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          updateParams({ tab: value === 'problems' ? null : value, page: 1 })
        }
      >
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="problems">Problems</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'problems' ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Live cases
              </p>
              {summaryLoading ? (
                <Skeleton className="mt-1 h-8 w-24" />
              ) : (
                <p className="text-2xl font-semibold tabular-nums">
                  {summaryData?.data.live_cases.toLocaleString() ?? '0'}
                </p>
              )}
              {/* Said once, plainly, because the nine counts below sum to far
                  more than the number above and somebody would otherwise add
                  them up and report the wrong figure. */}
              <p className="mt-1 text-xs text-muted-foreground">
                A case can carry several problems at once, so the counts below
                overlap and do not add up to this.
              </p>
            </div>

            <ProblemNav
              problems={problems}
              selected={selectedProblem}
              onSelect={(key) => updateParams({ problem: key, page: 1 })}
              isLoading={summaryLoading}
            />
          </div>

          <Card>
            <CardHeader className="gap-3 space-y-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-lg">
                  {selectedCount?.label ?? 'Cases'}
                </CardTitle>
                <SegmentedControl
                  value={fixView}
                  options={FIX_VIEWS}
                  onChange={(value) => updateParams({ fix: value === 'all' ? null : value, page: 1 })}
                />
              </div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={searchDraft}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Find an exact string, for example LAWEXA ELR"
                  className="pl-9"
                  aria-label="Search title, short title and citation"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CaseReviewList
                rows={listData?.data ?? []}
                isLoading={listLoading || summaryLoading}
                activeProblem={selectedProblem}
                emptyMessage={emptyMessage}
              />
              {listData?.pagination && listData.data.length > 0 && (
                <AdminPagination
                  pagination={listData.pagination}
                  onPageChange={(nextPage) => updateParams({ page: nextPage })}
                  itemLabel="cases"
                />
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-lg">Possible duplicates</CardTitle>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Grouping by title finds copies with the same name. Grouping by
                citation finds the ones whose names were typed differently.
                Nothing here merges or deletes: two cases can share a citation
                and still be different judgments, so a group is evidence for a
                person, not an action.
              </p>
            </div>
            <SegmentedControl
              value={groupBy}
              options={GROUP_BY_OPTIONS}
              onChange={(value) => updateParams({ by: value, page: 1 })}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <DuplicatesList
              groups={duplicatesData?.data.data ?? []}
              isLoading={duplicatesLoading}
              emptyMessage="No duplicate groups under this grouping."
            />
            {duplicatesData?.data && duplicatesData.data.data.length > 0 && (
              <AdminPagination
                pagination={{
                  current_page: duplicatesData.data.current_page,
                  per_page: duplicatesData.data.per_page,
                  total: duplicatesData.data.total,
                  last_page: duplicatesData.data.last_page,
                  from: duplicatesData.data.from,
                  to: duplicatesData.data.to,
                }}
                onPageChange={(nextPage) => updateParams({ page: nextPage })}
                itemLabel="groups"
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/******************************************************************************
                                Main Page
******************************************************************************/

export default function CaseDataReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-10 w-full max-w-sm" />
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Skeleton className="h-[560px] w-full rounded-xl" />
            <Skeleton className="h-[560px] w-full rounded-xl" />
          </div>
        </div>
      }
    >
      <CaseDataReviewContent />
    </Suspense>
  );
}
