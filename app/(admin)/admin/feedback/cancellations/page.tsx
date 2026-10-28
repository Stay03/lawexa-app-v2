'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { adminFeedbackApi, type AdminCancellationParams } from '@/lib/api/admin-feedback';
import { AdminPagination } from '@/components/admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CancellationReason } from '@/types/feedback';

/******************************************************************************
                                 Constants
******************************************************************************/

/** The four answers, as the cancel step shows them (Arthur, 28 October 2026). */
const REASON_LABEL: Record<CancellationReason, string> = {
  too_expensive: 'Too expensive',
  not_used_enough: 'Didn’t use it enough',
  missing_something: 'Missing something I need',
  other: 'Other',
};
const REASONS = Object.keys(REASON_LABEL) as CancellationReason[];

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '—' : DATE.format(time);
}

function isReason(value: string | null): value is CancellationReason {
  return value !== null && (REASONS as string[]).includes(value);
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Why people cancelled: every "Why are you cancelling?" answer, newest
 * first, with how many gave each reason. Tap a reason to see only its
 * answers. Read only.
 */
function AdminCancellationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo<AdminCancellationParams>(() => {
    const reason = searchParams.get('reason');
    return {
      reason: isReason(reason) ? reason : undefined,
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 25,
    };
  }, [searchParams]);

  const list = useQuery({
    queryKey: ['admin', 'feedback', 'cancellations', params],
    queryFn: () => adminFeedbackApi.getCancellations(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
  // The counts ignore the reason filter, so every reason keeps its number.
  const summary = useQuery({
    queryKey: ['admin', 'feedback', 'cancellations', 'summary'],
    queryFn: () => adminFeedbackApi.getCancellationSummary({}),
    staleTime: 30 * 1000,
  });

  const updateParams = useCallback(
    (updates: Partial<AdminCancellationParams>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      const query = next.toString();
      router.push(query ? `/admin/feedback/cancellations?${query}` : '/admin/feedback/cancellations');
    },
    [router, searchParams],
  );

  const counts = summary.data?.data;
  const rows = list.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Why people cancelled</h1>
        <p className="text-sm text-muted-foreground">
          Answers to “Why are you cancelling?”, asked after a paid plan is cancelled. It is optional, so not every
          cancel has one.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by reason">
        <ReasonChip
          label="All"
          count={counts?.total}
          active={params.reason === undefined}
          onClick={() => updateParams({ reason: undefined, page: 1 })}
        />
        {REASONS.map((reason) => (
          <ReasonChip
            key={reason}
            label={REASON_LABEL[reason]}
            count={counts?.reasons[reason]}
            active={params.reason === reason}
            onClick={() => updateParams({ reason, page: 1 })}
          />
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="min-w-64">What they said</TableHead>
              <TableHead className="w-28">Plan ends</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isPending ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : list.isError ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Couldn’t load the answers. Reload the page to try again.
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {params.reason ? 'No one has given this reason yet.' : 'No one has said why they cancelled yet.'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm whitespace-nowrap tabular-nums">{formatDate(row.created_at)}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{row.user.name}</div>
                    <div className="text-xs text-muted-foreground">{row.user.email}</div>
                  </TableCell>
                  <TableCell className="text-sm">{row.plan?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{REASON_LABEL[row.reason] ?? row.reason}</TableCell>
                  <TableCell className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {row.details?.trim() ? row.details : '—'}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap tabular-nums">
                    {formatDate(row.subscription.ends_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {list.data?.pagination ? (
        <AdminPagination
          pagination={list.data.pagination}
          onPageChange={(page) => updateParams({ page })}
          perPage={params.per_page || 25}
          onPerPageChange={(perPage) => updateParams({ per_page: perPage, page: 1 })}
          itemLabel="answers"
        />
      ) : null}
    </div>
  );
}

function ReasonChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number | undefined;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        active ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-secondary',
      )}
    >
      {label}
      <span className={cn('tabular-nums', active ? 'text-background/70' : 'text-muted-foreground')}>
        {count ?? '·'}
      </span>
    </button>
  );
}

/******************************************************************************
                                 Export default
******************************************************************************/

export default function AdminCancellationsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-[240px]" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-28 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <AdminCancellationsContent />
    </Suspense>
  );
}
