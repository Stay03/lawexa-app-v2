'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityFeedLiveToggle } from '@/components/admin/activity/ActivityFeedLiveToggle';
import {
  PaystackWebhooksFilters,
  type WebhookFilterState,
} from '@/components/admin/paystack-webhooks/PaystackWebhooksFilters';
import { PaystackWebhooksTable } from '@/components/admin/paystack-webhooks/PaystackWebhooksTable';
import { PaystackWebhookDetailSheet } from '@/components/admin/paystack-webhooks/PaystackWebhookDetailSheet';
import { usePaystackWebhooks } from '@/lib/hooks/useAdminPaystackWebhooks';
import {
  PAYSTACK_WEBHOOK_PROCESSING_STATUSES,
  type PaystackWebhookProcessingStatus,
} from '@/types/admin-paystack-webhooks';

const STATUS_SET = new Set<string>(PAYSTACK_WEBHOOK_PROCESSING_STATUSES);

function parseFilters(search: URLSearchParams): WebhookFilterState {
  const eventTypes = search.getAll('event_type');
  const statuses = search
    .getAll('processing_status')
    .filter((s): s is PaystackWebhookProcessingStatus => STATUS_SET.has(s));

  const sig = search.get('signature_valid');
  const signature_valid =
    sig === null ? undefined : sig === 'true' || sig === '1';

  return {
    event_type: eventTypes.length ? eventTypes : undefined,
    processing_status: statuses.length ? statuses : undefined,
    signature_valid,
    user_id: search.get('user_id') ? Number(search.get('user_id')) : undefined,
    event_id: search.get('event_id') ?? undefined,
    reference: search.get('reference') ?? undefined,
    date_from: search.get('date_from') ?? undefined,
    date_to: search.get('date_to') ?? undefined,
  };
}

function toSearchParams(
  filters: WebhookFilterState,
  selectedId: number | null
): URLSearchParams {
  const p = new URLSearchParams();
  filters.event_type?.forEach((e) => p.append('event_type', e));
  filters.processing_status?.forEach((s) => p.append('processing_status', s));
  if (filters.signature_valid !== undefined)
    p.set('signature_valid', String(filters.signature_valid));
  if (filters.user_id) p.set('user_id', String(filters.user_id));
  if (filters.event_id) p.set('event_id', filters.event_id);
  if (filters.reference) p.set('reference', filters.reference);
  if (filters.date_from) p.set('date_from', filters.date_from);
  if (filters.date_to) p.set('date_to', filters.date_to);
  if (selectedId !== null) p.set('selected', String(selectedId));
  return p;
}

function PaystackWebhooksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const selectedId = useMemo(() => {
    const raw = searchParams.get('selected');
    return raw ? Number(raw) : null;
  }, [searchParams]);

  const updateUrl = useCallback(
    (nextFilters: WebhookFilterState, nextSelectedId: number | null) => {
      const qs = toSearchParams(nextFilters, nextSelectedId).toString();
      router.push(
        qs ? `/admin/paystack-webhooks?${qs}` : '/admin/paystack-webhooks'
      );
    },
    [router]
  );

  const handleFiltersChange = useCallback(
    (next: WebhookFilterState) => {
      // Filter changes drop the selected row to avoid orphan refs that don't
      // match the new result set.
      updateUrl(next, null);
    },
    [updateUrl]
  );

  const handleRowClick = useCallback(
    (id: number) => {
      updateUrl(filters, id);
    },
    [filters, updateUrl]
  );

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      if (!open) updateUrl(filters, null);
    },
    [filters, updateUrl]
  );

  const [liveRequested, setLiveRequested] = useState(true);
  const live = liveRequested;

  const feed = usePaystackWebhooks(filters, { live });
  const lastUpdated = feed.dataUpdatedAt || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Paystack Webhooks
          </h1>
          <p className="text-sm text-muted-foreground">
            Every Paystack delivery — good, bad-signature, duplicate, and
            handler-exception. Replay failed ones from the detail panel.
          </p>
        </div>
        <ActivityFeedLiveToggle
          live={live}
          onToggle={() => setLiveRequested((v) => !v)}
          lastUpdated={lastUpdated}
          isRefetching={feed.isRefetching}
          onRefresh={() => feed.refetch()}
        />
      </div>

      <PaystackWebhooksFilters
        value={filters}
        onChange={handleFiltersChange}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <PaystackWebhooksTable
            pages={feed.data?.pages}
            isLoading={feed.isLoading}
            isFetchingNextPage={feed.isFetchingNextPage}
            hasNextPage={feed.hasNextPage}
            onLoadMore={() => feed.fetchNextPage()}
            onRowClick={handleRowClick}
            selectedId={selectedId}
            error={feed.error as Error | null}
          />
        </CardContent>
      </Card>

      <PaystackWebhookDetailSheet
        open={selectedId !== null}
        onOpenChange={handleSheetOpenChange}
        webhookId={selectedId}
      />
    </div>
  );
}

export default function PaystackWebhooksPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-[260px]" />
          <Skeleton className="h-10 w-full max-w-[720px]" />
          <Skeleton className="h-[500px] rounded-2xl" />
        </div>
      }
    >
      <PaystackWebhooksContent />
    </Suspense>
  );
}
