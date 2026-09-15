'use client';

import { useState } from 'react';
import { AlertTriangle, Gauge, Infinity as InfinityIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/lib/hooks/useNow';
import { useCheckAiProviderLimits } from '@/lib/hooks/useAdminAi';
import type {
  AdminAiProviderLimits,
  AdminAiProviderLimitsReading,
} from '@/types/admin-ai';

interface AiProviderLimitsCardProps {
  providerId: number;
}

/** A count as people read it, or an em dash when the provider sent nothing. */
function count(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toLocaleString() : '—';
}

/**
 * `limit_reset` as an instant, when it is one.
 *
 * The API passes this field through from the vendor untouched and no live
 * response has been read yet, so an ISO string is the only shape anyone has
 * seen and it came from a test fixture. Anything that does not parse is shown
 * as the vendor wrote it rather than dropped.
 */
function resetInstant(value: unknown): { at: Date | null; raw: string | null } {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Seconds and milliseconds are both plausible and nobody has confirmed
    // which. Anything below this bound is not a millisecond epoch in this era.
    const ms = value < 1e11 ? value * 1000 : value;
    const at = new Date(ms);
    return { at: Number.isNaN(at.getTime()) ? null : at, raw: String(value) };
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const at = new Date(value);
    return { at: Number.isNaN(at.getTime()) ? null : at, raw: value };
  }
  return { at: null, raw: null };
}

/** How long until an instant, counted down, or null once it has passed. */
function untilText(at: Date, now: number): string | null {
  const ms = at.getTime() - now;
  if (ms <= 0) return null;

  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** When the cap refills, live, and honest when it cannot tell. */
function ResetLine({ value }: { value: unknown }) {
  const now = useNow(1000);
  const { at, raw } = resetInstant(value);

  if (at === null) {
    if (raw === null) {
      return (
        <span className="text-muted-foreground">
          The provider did not say when it resets.
        </span>
      );
    }
    return (
      <span>
        Resets at <span className="font-mono text-xs">{raw}</span>
      </span>
    );
  }

  const absolute = at.toLocaleString();
  // `now` is 0 through hydration, which is not a clock. Show the instant alone
  // rather than count down from the epoch.
  const remaining = now === 0 ? null : untilText(at, now);

  if (remaining === null) {
    return (
      <span>
        Resets at {absolute}
        {now !== 0 && (
          <span className="text-muted-foreground"> · that time has passed</span>
        )}
      </span>
    );
  }

  return (
    <span>
      Resets in <span className="font-medium tabular-nums">{remaining}</span>
      <span className="text-muted-foreground"> · {absolute}</span>
    </span>
  );
}

/** One labelled number in the readout grid. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium tabular-nums">{value}</p>
    </div>
  );
}

/**
 * The three states drawn separately, because they mean different things and a
 * single "N of M" line renders all three identically.
 */
function Reading({ data }: { data: AdminAiProviderLimitsReading }) {
  const cap = typeof data.limit === 'number' ? data.limit : null;
  const remaining =
    typeof data.limit_remaining === 'number' ? data.limit_remaining : null;
  const exhausted = cap !== null && remaining !== null && remaining <= 0;
  const spent =
    cap !== null && cap > 0 && remaining !== null
      ? Math.min(100, Math.max(0, ((cap - remaining) / cap) * 100))
      : null;

  return (
    <div className="space-y-4">
      {cap === null && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3">
          <InfinityIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-medium">No cap on this key.</p>
            <p className="text-sm text-muted-foreground">
              The provider reported no limit, which is not the same as none left.
            </p>
          </div>
        </div>
      )}

      {exhausted && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-destructive">Nothing left on this key.</p>
            <p className="text-sm">
              <ResetLine value={data.limit_reset} />
            </p>
          </div>
        </div>
      )}

      {cap !== null && !exhausted && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p>
              <span className="text-lg font-medium tabular-nums">
                {count(remaining)}
              </span>
              <span className="text-muted-foreground"> left of {count(cap)}</span>
            </p>
            <p className="text-sm">
              <ResetLine value={data.limit_reset} />
            </p>
          </div>
          {spent !== null && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${spent}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure label="Used, all time" value={count(data.usage)} />
        <Figure label="Today" value={count(data.usage_daily)} />
        <Figure label="This week" value={count(data.usage_weekly)} />
        <Figure label="This month" value={count(data.usage_monthly)} />
      </div>

      <p className="text-xs text-muted-foreground">
        {data.label ? <>Key {data.label}. </> : null}
        {data.is_free_tier === true ? 'Free tier. ' : null}
        {data.is_free_tier === false ? 'Paid tier. ' : null}
        {typeof data.response_time_ms === 'number'
          ? `Read in ${data.response_time_ms}ms.`
          : null}
      </p>
    </div>
  );
}

/** Whatever came back, drawn as what it is. */
function Result({ data }: { data: AdminAiProviderLimits }) {
  if (!data.supported) {
    return (
      <p className="text-muted-foreground">
        This provider publishes no account limits, so there is nothing to read.
      </p>
    );
  }

  if (!data.success) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-destructive">
            {typeof data.status === 'number'
              ? `The provider refused the read (${data.status}).`
              : 'Could not reach the provider.'}
          </p>
          {data.error && <p className="break-words text-sm">{data.error}</p>}
        </div>
      </div>
    );
  }

  return <Reading data={data} />;
}

/**
 * What the provider says is left on the account key, read on demand.
 *
 * Nothing reads this on its own: every check spends a request at the vendor,
 * and on the night this was written the vendor was refusing us for reasons
 * nobody could see from inside the app.
 */
export function AiProviderLimitsCard({ providerId }: AiProviderLimitsCardProps) {
  const limits = useCheckAiProviderLimits();
  const [result, setResult] = useState<AdminAiProviderLimits | null>(null);
  const [failed, setFailed] = useState(false);

  const handleCheck = () => {
    setFailed(false);
    limits.mutate(providerId, {
      onSuccess: (response) => setResult(response.data),
      onError: () => {
        setResult(null);
        setFailed(true);
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Account limits
            </CardTitle>
            <CardDescription>
              What the provider says is left on this key. Superadmin only.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheck}
            disabled={limits.isPending}
          >
            {limits.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {result === null && !failed ? 'Check limits' : 'Check again'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {limits.isPending && (
          <div className="space-y-3">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-1.5 w-full" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </div>
        )}

        {!limits.isPending && failed && (
          <p className="text-destructive">
            The request did not get through. An admin who is not a superadmin gets
            turned away here.
          </p>
        )}

        {!limits.isPending && !failed && result === null && (
          <p className="text-muted-foreground">
            Not read yet. Each check spends a request at the provider, so it runs
            when you ask.
          </p>
        )}

        {!limits.isPending && !failed && result !== null && <Result data={result} />}
      </CardContent>
    </Card>
  );
}
