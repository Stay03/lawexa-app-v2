'use client';

import { use, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { AdminPagination } from '@/components/admin';
import { EnumFilterSelect, StatusBadge } from '@/components/admin/observability';
import {
  CaseMaintenanceItemsTable,
  RUN_TYPE_LABEL,
  RunProgress,
  runStatusMeta,
} from '@/components/admin/observability/case-maintenance';
import { RunControls } from '@/components/admin/observability/case-maintenance/RunControls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import {
  useCancelCaseMaintenanceRun,
  useCaseMaintenanceItems,
  useCaseMaintenanceRun,
  useDecideCaseMaintenanceItem,
  usePauseCaseMaintenanceRun,
  useResumeCaseMaintenanceRun,
  useRetryFailedCaseMaintenanceItems,
} from '@/lib/hooks/useAdminCaseMaintenanceRuns';
import {
  CASE_MAINTENANCE_ITEM_STATUSES,
  CLEANUP_ONLY_EXCLUDED_ITEM_STATUSES,
  type CaseMaintenanceItemStatus,
} from '@/types/admin-case-maintenance-runs';

/**
 * One run: how far it has got, what it changed, and every case inside it.
 *
 * ── THE CASES THAT NEED A PERSON COME FIRST, WITHOUT BEING ASKED FOR ──────
 * A run of 1,811 cases can leave 126 sitting at "needs a decision", and a
 * reader who has to find them by changing a filter will not find them at all —
 * they will look at a screen that says Running, conclude it is fine, and close
 * it. So when anything is waiting on a person the list opens on those, and the
 * filter says so.
 *
 * ── THE FILTER OFFERS ONLY WHAT THIS KIND OF RUN CAN REACH ────────────────
 * A cleanup never produces "needs a decision", "disagrees" or "not found".
 * Offering them anyway would give a reader three filters that always return
 * nothing and no way to know whether that means "none" or "broken".
 */
export default function CaseMaintenanceRunPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = use(params);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CaseMaintenanceItemStatus | ''>('');
  /** Set once, so re-renders do not keep dragging the reader back. */
  const [jumpedToWaiting, setJumpedToWaiting] = useState(false);

  const runQuery = useCaseMaintenanceRun(uuid);
  const run = runQuery.data?.data;

  const waiting = run?.progress.awaiting_confirmation ?? 0;
  const effectiveFilter: CaseMaintenanceItemStatus | '' =
    !jumpedToWaiting && waiting > 0 ? 'awaiting_confirmation' : statusFilter;

  const itemsQuery = useCaseMaintenanceItems(uuid, {
    page,
    per_page: 20,
    status: effectiveFilter || undefined,
  });

  const pause = usePauseCaseMaintenanceRun(uuid);
  const resume = useResumeCaseMaintenanceRun(uuid);
  const cancel = useCancelCaseMaintenanceRun(uuid);
  const retry = useRetryFailedCaseMaintenanceItems(uuid);
  const decide = useDecideCaseMaintenanceItem(uuid);

  const busy =
    pause.isPending || resume.isPending || cancel.isPending || retry.isPending;

  const statusOptions = useMemo(() => {
    const usable =
      run?.type === 'editorial_cleanup'
        ? CASE_MAINTENANCE_ITEM_STATUSES.filter(
            (s) => !CLEANUP_ONLY_EXCLUDED_ITEM_STATUSES.includes(s),
          )
        : CASE_MAINTENANCE_ITEM_STATUSES;
    return usable;
  }, [run?.type]);

  /* `undefined` is what the select sends for "every case" — it is a distinct
     value there, not a missing one, so it is turned into the empty string this
     screen uses rather than left to become `status: undefined` by accident. */
  const changeFilter = useCallback((next: string | undefined) => {
    setJumpedToWaiting(true);
    setStatusFilter((next ?? '') as CaseMaintenanceItemStatus | '');
    setPage(1);
  }, []);

  const onDecide = useCallback(
    (itemId: number, decision: 'confirm' | 'reject') => {
      decide.mutate({ itemId, decision });
    },
    [decide],
  );

  if (runQuery.isPending) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  if (runQuery.isError || !run) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-destructive">
          {runQuery.isError
            ? extractApiError(runQuery.error).message
            : 'That run could not be read.'}
        </p>
      </div>
    );
  }

  /* A finished or cancelled run cannot be decided on. Passing null rather than
     drawing disabled buttons: a reader should not have to press something to
     learn it is over. */
  const decidable = run.status === 'running' || run.status === 'paused' || run.status === 'pending';

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {RUN_TYPE_LABEL[run.type]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {run.total_items.toLocaleString()} cases
            {run.created_by ? ` · started by ${run.created_by.name}` : ''}
          </p>
        </div>
        <StatusBadge meta={runStatusMeta(run.status)} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <RunProgress run={run} />
          <RunControls
            run={run}
            busy={busy}
            onPause={() => pause.mutate()}
            onResume={() => resume.mutate()}
            onCancel={() => cancel.mutate()}
            onRetryFailed={() => retry.mutate()}
          />
          {run.error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {run.error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>
            Cases
            {waiting > 0 ? (
              <span className="ml-2 text-sm font-normal text-amber-700 dark:text-amber-400">
                {waiting.toLocaleString()} waiting on you
              </span>
            ) : null}
          </CardTitle>
          <EnumFilterSelect
            value={effectiveFilter}
            options={statusOptions}
            onChange={changeFilter}
            allLabel="Every case"
            placeholder="Every case"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <CaseMaintenanceItemsTable
            items={itemsQuery.data?.data ?? []}
            isLoading={itemsQuery.isPending}
            onDecide={decidable ? onDecide : null}
            decidingId={
              decide.isPending ? (decide.variables?.itemId ?? null) : null
            }
          />
          {itemsQuery.data?.pagination && itemsQuery.data.pagination.total > 0 ? (
            <AdminPagination
              pagination={itemsQuery.data.pagination}
              onPageChange={setPage}
              itemLabel="case"
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/operations/case-maintenance"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden className="h-4 w-4" />
      All runs
    </Link>
  );
}
