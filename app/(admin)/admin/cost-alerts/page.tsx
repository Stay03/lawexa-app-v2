'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Info, Settings, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CostAlertsTable } from '@/components/admin/cost-alerts/CostAlertsTable';
import { useAdminCostAlerts } from '@/lib/hooks/useAdminCostAlerts';
import {
  COST_ALERT_NOTE,
  COST_ALERT_PERIODS,
  COST_ALERT_SORTS,
  costAlertFiltersFrom,
  costAlertParams,
  costAlertRule,
  costAlertSearch,
  type CostAlertFilters,
} from '@/lib/utils/cost-alerts';
import type { CostAlertPeriod, CostAlertSort } from '@/types/admin-cost-alerts';

/**
 * Admin > Billing > Cost alerts (Arthur, 18 November 2026, thread dfa0d9b8;
 * Backend's GET /admin/cost-alerts). Paying users whose AI cost in a paid
 * period reached the set share of their plan price, highest share first. The
 * filters live in the address, so a user page can link to its own rows
 * (`?user=<uuid>`). The rule and its settings are stated at the top, from the
 * list's own meta, with a link to change them in Billing settings.
 */
function CostAlertsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => costAlertFiltersFrom(new URLSearchParams(searchParams.toString())), [searchParams]);
  const alerts = useAdminCostAlerts(costAlertParams(filters));
  const meta = alerts.data?.meta;

  const go = (next: CostAlertFilters) => {
    const search = costAlertSearch(next);
    router.push(search ? `/admin/cost-alerts?${search}` : '/admin/cost-alerts');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Cost alerts</h1>
          <p className="text-sm text-muted-foreground">
            {meta ? costAlertRule(meta) : 'Paying users whose AI cost reached a set share of their plan price.'}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info aria-hidden className="h-3.5 w-3.5 shrink-0" />
            {COST_ALERT_NOTE}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
          <Link href="/admin/billing/settings">
            <Settings aria-hidden className="h-3.5 w-3.5" />
            Alert settings
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filters.period} onValueChange={(value) => go({ ...filters, period: value as CostAlertPeriod, page: 1 })}>
          <SelectTrigger className="w-[180px]" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COST_ALERT_PERIODS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.sort} onValueChange={(value) => go({ ...filters, sort: value as CostAlertSort, page: 1 })}>
          <SelectTrigger className="w-[200px]" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COST_ALERT_SORTS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filters.user ? (
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => go({ ...filters, user: null, page: 1 })}>
            Showing alerts for {meta?.user?.name ?? 'one user'}
            <X aria-label="Show every user" className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {meta ? `${meta.total.toLocaleString('en-US')} ${meta.total === 1 ? 'alert' : 'alerts'}` : 'Alerts'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CostAlertsTable
            rows={alerts.data?.data}
            threshold={meta?.threshold_percent ?? 100}
            isLoading={alerts.isLoading}
            error={alerts.error as Error | null}
            filteredToUser={!!filters.user}
          />
          {meta && meta.last_page > 1 ? (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {meta.current_page} of {meta.last_page}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.current_page <= 1}
                  onClick={() => go({ ...filters, page: meta.current_page - 1 })}
                >
                  <ChevronLeft aria-hidden className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.current_page >= meta.last_page}
                  onClick={() => go({ ...filters, page: meta.current_page + 1 })}
                >
                  Next
                  <ChevronRight aria-hidden className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CostAlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-[220px]" />
          <Skeleton className="h-10 w-full max-w-[420px]" />
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
      }
    >
      <CostAlertsContent />
    </Suspense>
  );
}
