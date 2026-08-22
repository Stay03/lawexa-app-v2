'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, FileSearch, HelpCircle, Layers, Loader2, Play, ShieldQuestion } from 'lucide-react';

import { AdminPagination } from '@/components/admin';
import {
  SegmentedControl,
  SummaryStatCard,
  SummaryStatCardSkeleton,
} from '@/components/admin/observability';
import {
  CaseMaintenancePreviewTable,
  CaseMaintenanceRunsTable,
  RUN_TYPE_DESCRIPTION,
  RUN_TYPE_LABEL,
} from '@/components/admin/observability/case-maintenance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCaseMaintenancePreview,
  useCaseMaintenanceRuns,
  useStartCaseMaintenanceRun,
} from '@/lib/hooks/useAdminCaseMaintenanceRuns';
import {
  CASE_MAINTENANCE_RUN_TYPES,
  isNwlrPreviewSummary,
  type CaseMaintenanceRunType,
} from '@/types/admin-case-maintenance-runs';

/**
 * Admin → run the case maintenance jobs, and watch them.
 *
 * ── WHY IT EXISTS (the owner, 22 August 2026) ─────────────────────────────
 * "I dont want a situation where we run it in the terminal and we cant track
 * it. Also i want to be able to select what cases to run."
 *
 * Two jobs live here. Refreshing cases from NWLR — 1,811 of them, roughly 25
 * hours, and it calls a provider. And the editorial cleanups, which are fast,
 * free, and never leave our servers. They are drawn as one screen because they
 * behave the same once started: a run with cases under it, that can be paused,
 * resumed, cancelled and retried.
 *
 * ── CHOOSING IS SEPARATE FROM WATCHING, DELIBERATELY ──────────────────────
 * The top half asks what you would like to run and shows what it would cost
 * before anything happens. The bottom half is every run there has been. A
 * screen that mixed them would put a button that starts 25 hours of work beside
 * a list of things already running, which is where mis-presses come from.
 *
 * ── THE COUNTS COME FROM PREVIEW, WHICH TOUCHES NOTHING ───────────────────
 * `preview` is a POST because the selection can be a long list of case ids, but
 * it writes nothing and calls no provider. It is the safe question asked before
 * the unsafe one, and it is what fills both the summary above and the tick
 * boxes below.
 */
function PageContent() {
  const router = useRouter();
  const [type, setType] = useState<CaseMaintenanceRunType>('nwlr_refresh');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  /** True when the reader means "everything that matches", not "these rows". */
  const [wholeSelection, setWholeSelection] = useState(false);

  /* `mode` is required by the endpoint and is not optional sugar: a body
     without it is refused outright. `nwlr` for the refresh, `all` for the
     cleanup — those are what the server accepts for "everything that
     qualifies" in each case. */
  const previewParams = useMemo(
    () => ({
      type,
      selection: (type === 'nwlr_refresh'
        ? { mode: 'nwlr' as const }
        : { mode: 'all' as const }),
      page,
      per_page: 15,
    }),
    [type, page],
  );
  const preview = useCaseMaintenancePreview(previewParams);
  const runs = useCaseMaintenanceRuns({ page: 1, per_page: 15 });
  const start = useStartCaseMaintenanceRun();

  /* Everything preview answers with is nested under `data`, unlike the run
     list beside it. Measured, not assumed. */
  const payload = preview.data?.data;
  const summary = payload?.summary;
  const rows = useMemo(() => payload?.data ?? [], [payload]);

  /* Changing the kind of run throws the ticks away. Keeping them would let
     somebody tick cases under one job and start a different one with them. */
  const changeType = useCallback((next: CaseMaintenanceRunType) => {
    setType(next);
    setPage(1);
    setSelected(new Set());
    setWholeSelection(false);
  }, []);

  const toggle = useCallback((id: number) => {
    setWholeSelection(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: number[], select: boolean) => {
    setWholeSelection(false);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const total = summary?.total ?? 0;
  const willRun = wholeSelection ? total : selected.size;

  const run = useCallback(() => {
    if (willRun === 0) return;
    start.mutate(
      {
        type,
        selection: wholeSelection
          ? type === 'nwlr_refresh'
            ? { mode: 'nwlr' as const }
            : { mode: 'all' as const }
          : { mode: 'ids' as const, case_ids: [...selected] },
      },
      {
        onSuccess: () => {
          setSelected(new Set());
          setWholeSelection(false);
        },
      },
    );
  }, [start, type, wholeSelection, selected, willRun]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Case maintenance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update cases in bulk, and watch it happen.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Start a run</CardTitle>
          <SegmentedControl
            value={type}
            onChange={(next) => changeType(next as CaseMaintenanceRunType)}
            options={CASE_MAINTENANCE_RUN_TYPES.map((id) => ({
              value: id,
              label: RUN_TYPE_LABEL[id],
            }))}
          />
          <p className="text-sm text-muted-foreground">{RUN_TYPE_DESCRIPTION[type]}</p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {preview.isPending || !summary ? (
              Array.from({ length: 4 }).map((_, i) => <SummaryStatCardSkeleton key={i} />)
            ) : isNwlrPreviewSummary(summary) ? (
              <>
                <SummaryStatCard icon={Layers} label="Cases in scope" value={summary.total} />
                <SummaryStatCard icon={CheckCircle2} label="Matched by citation" value={summary.exact_key} />
                {/* Amber, because these are the ones that will stop and wait for
                    a person part way through a 25 hour run. */}
                <SummaryStatCard
                  icon={ShieldQuestion}
                  label="Need a decision"
                  value={summary.title_only}
                  tone="warning"
                  hint="Matched by title only — confirmed one by one"
                />
                <SummaryStatCard
                  icon={HelpCircle}
                  label="Nothing to match on"
                  value={summary.no_reference}
                  hint="Cannot be refreshed from NWLR"
                />
              </>
            ) : (
              <>
                <SummaryStatCard icon={Layers} label="Cases in scope" value={summary.total} />
                {/* The number that matters on a cleanup: most cases are already
                    fine, so "in scope" is not "will be rewritten". */}
                <SummaryStatCard icon={FileSearch} label="Would change" value={summary.would_change} />
                <SummaryStatCard icon={CheckCircle2} label="Already correct" value={summary.unchanged} />
                <SummaryStatCard
                  icon={AlertTriangle}
                  label="Held back"
                  value={summary.held_back}
                  tone="warning"
                />
              </>
            )}
          </div>

          <CaseMaintenancePreviewTable
            rows={rows}
            isLoading={preview.isPending}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
          />

          {payload?.pagination && payload.pagination.total > 0 ? (
            <AdminPagination
              pagination={payload.pagination}
              onPageChange={setPage}
              itemLabel="cases"
            />
          ) : null}

          {/* THE TWO SCOPES, SAID IN WORDS. Ticking rows selects rows; running
              everything that matches is a different, larger thing and has to be
              chosen on purpose rather than inferred from a header checkbox. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {wholeSelection ? (
                <>
                  Running <span className="font-medium text-foreground">all {total.toLocaleString()}</span> cases that match.{' '}
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    onClick={() => setWholeSelection(false)}
                  >
                    Just the ticked ones instead
                  </button>
                </>
              ) : selected.size > 0 ? (
                <>
                  <span className="font-medium text-foreground">{selected.size.toLocaleString()}</span> ticked.{' '}
                  {total > selected.size ? (
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={() => setWholeSelection(true)}
                    >
                      Run all {total.toLocaleString()} instead
                    </button>
                  ) : null}
                </>
              ) : (
                <>Tick the cases to run, or <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() => setWholeSelection(true)}
                  disabled={total === 0}
                >run all {total.toLocaleString()}</button>.</>
              )}
            </p>

            <Button onClick={run} disabled={willRun === 0 || start.isPending}>
              {start.isPending ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <Play aria-hidden className="h-4 w-4" />
              )}
              Run {willRun > 0 ? willRun.toLocaleString() : ''}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CaseMaintenanceRunsTable
            runs={runs.data?.data ?? []}
            isLoading={runs.isPending}
            /* router.push, not a location assignment: this is an in-app
               navigation and a full reload would throw away every warm query
               on the way to a screen that shares most of them. */
            onOpen={(opened) =>
              router.push(`/admin/operations/case-maintenance/${opened.uuid}`)
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function CaseMaintenancePage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <PageContent />
    </Suspense>
  );
}
