'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Radar, Percent, CircleDashed, XCircle, WalletMinimal, AlertTriangle, X } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import {
  SummaryStatCard,
  SummaryStatCardSkeleton,
  EnumFilterSelect,
} from '@/components/admin/observability';
import { RadarScansTable } from '@/components/admin/observability/radar-scans/RadarScansTable';
import { useRadarScans, useRadarScanSummary } from '@/lib/hooks/useAdminRadarScans';
import {
  RADAR_SCAN_STATUSES,
  RADAR_SCAN_TRIGGERS,
  failureRate,
  type RadarScansParams,
  type RadarScanStatus,
  type RadarScanTrigger,
} from '@/types/admin-radar-scans';

function statusLabel(value: string): string {
  return value === 'skipped_no_balance'
    ? 'No balance'
    : value.charAt(0).toUpperCase() + value.slice(1);
}

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo<RadarScansParams>(() => {
    const status = searchParams.get('status') as RadarScanStatus | null;
    const triggered_by = searchParams.get('triggered_by') as RadarScanTrigger | null;
    const findings = searchParams.get('has_findings');
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      status: status ?? undefined,
      triggered_by: triggered_by ?? undefined,
      has_findings: findings === null ? undefined : findings === 'true',
      user_id: searchParams.get('user_id') ? Number(searchParams.get('user_id')) : undefined,
      radar_id: searchParams.get('radar_id') ? Number(searchParams.get('radar_id')) : undefined,
    };
  }, [searchParams]);

  const { data: summaryData, isLoading: summaryLoading } = useRadarScanSummary();
  const { data, isLoading } = useRadarScans(params);
  const summary = summaryData?.data;

  const updateParams = useCallback(
    (updates: Partial<RadarScansParams>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      });
      const qs = next.toString();
      router.push(qs ? `/admin/operations/radar-scans?${qs}` : '/admin/operations/radar-scans');
    },
    [router, searchParams]
  );

  const weeklyRate = summary ? failureRate(summary.last_7_days) : 0;
  const ratePct = Math.round(weeklyRate * 100);
  const hasUserFilter = params.user_id != null || params.radar_id != null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Radar className="h-6 w-6 text-primary" />
          Radar Scans
        </h1>
        <p className="text-sm text-muted-foreground">
          Every radar scan across all users — surfaces the silent-failure rate that hid the 2026 incident.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {summaryLoading || !summary ? (
          Array.from({ length: 5 }).map((_, i) => <SummaryStatCardSkeleton key={i} />)
        ) : (
          <>
            <SummaryStatCard
              icon={Percent}
              label="Failure rate (7d)"
              value={`${ratePct}%`}
              hint="failed / (completed+failed)"
              tone={weeklyRate > 0.05 ? 'danger' : 'default'}
            />
            <SummaryStatCard icon={CircleDashed} label="Running" value={summary.scans.running} />
            <SummaryStatCard
              icon={XCircle}
              label="Failed (all)"
              value={summary.scans.failed}
              tone={summary.scans.failed > 0 ? 'danger' : 'default'}
            />
            <SummaryStatCard
              icon={WalletMinimal}
              label="No balance"
              value={summary.scans.skipped_no_balance}
              hint="Retention signal"
              tone={summary.scans.skipped_no_balance > 0 ? 'warning' : 'default'}
            />
            <SummaryStatCard
              icon={AlertTriangle}
              label="Stuck in-flight"
              value={summary.stuck_in_flight}
              hint="Sweeper broken if > 0"
              tone={summary.stuck_in_flight > 0 ? 'danger' : 'default'}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <CardTitle className="text-lg">Scans</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <EnumFilterSelect
              value={params.status}
              options={RADAR_SCAN_STATUSES}
              onChange={(v) => updateParams({ status: v as RadarScanStatus | undefined, page: 1 })}
              placeholder="Status"
              allLabel="All statuses"
              labelFor={statusLabel}
            />
            <EnumFilterSelect
              value={params.triggered_by}
              options={RADAR_SCAN_TRIGGERS}
              onChange={(v) => updateParams({ triggered_by: v as RadarScanTrigger | undefined, page: 1 })}
              placeholder="Trigger"
              allLabel="Any trigger"
              className="w-[150px]"
            />
            <EnumFilterSelect
              value={params.has_findings === undefined ? undefined : String(params.has_findings)}
              options={['true', 'false']}
              onChange={(v) => updateParams({ has_findings: v === undefined ? undefined : v === 'true', page: 1 })}
              placeholder="Findings"
              allLabel="Any findings"
              className="w-[150px]"
              labelFor={(v) => (v === 'true' ? 'With findings' : 'No findings')}
            />
            {hasUserFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1 text-muted-foreground"
                onClick={() => updateParams({ user_id: undefined, radar_id: undefined, page: 1 })}
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadarScansTable scans={data?.data || []} isLoading={isLoading} />
          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={(page) => updateParams({ page })}
              itemLabel="scans"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RadarScansPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <PageContent />
    </Suspense>
  );
}
