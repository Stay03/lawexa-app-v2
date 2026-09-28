'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  Copy,
  Crown,
  Loader2,
  ReceiptText,
  RotateCw,
  Sparkles,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { IInvoice } from '@/types/subscription';
import { SETTINGS_BLOCK, SETTINGS_COLUMN } from '../SettingsList';
import { SettingsFormGroup } from '../SettingsForm';
import { SettingsState } from '../SettingsState';
import { CancelPlanDialog } from './CancelPlanDialog';
import { formatBillingDate, summarisePlan, type CancelKind } from './model';
import { billingQueries } from './queries';
import { BillingFallback } from './states';

/**
 * BillingScreen — v2 `/settings/billing`: the plan and its state, the
 * invoices, and cancelling. What the plan row and the note say is decided in
 * `model.ts` from the server's own fields; the cancel dialog adds no promise
 * the backend has not confirmed.
 *
 * "Upgrade" and "Change plan" open `/pricing`, which is still v1's page.
 * v1's billing page also linked to Message packs; that row sits one line away
 * in Settings, so the shortcut is not repeated here (the 21 September study).
 */
export function BillingScreen() {
  const current = useQuery(billingQueries.current());
  const trialing = current.data?.subscription?.status === 'trialing';
  const trial = useQuery(billingQueries.trial(trialing));
  const invoices = useInfiniteQuery(billingQueries.invoices());
  const [cancelKind, setCancelKind] = useState<CancelKind>(null);

  if (current.isPending || invoices.isPending) return <BillingFallback />;

  if (current.isError || invoices.isError || !current.data) {
    const retrying = current.isFetching || invoices.isFetching;
    return (
      <div className={SETTINGS_COLUMN}>
        <Heading />
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="Your billing did not load"
          description="Check your connection and try again."
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={retrying}
              onClick={() => {
                void current.refetch();
                void invoices.refetch();
              }}
            >
              <RotateCw aria-hidden className={cn('size-4', retrying && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const data = current.data;
  const summary = summarisePlan(data, trial.data ?? null);
  const rows = invoices.data.pages.flatMap((page) => page.data);
  const lastDay =
    cancelKind === 'trial'
      ? formatBillingDate(trial.data?.trial_ends_at)
      : formatBillingDate(data.subscription?.ends_at ?? data.subscription?.next_payment_date);
  const PlanIcon = summary.isFree ? Sparkles : Crown;

  return (
    <div className={SETTINGS_COLUMN}>
      <Heading />
      <div className="flex flex-col gap-5">
        <div>
          <SettingsFormGroup id="billing-plan" label="Plan">
            <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
              <PlanIcon
                aria-hidden
                className={cn('size-5 shrink-0', summary.isFree ? 'text-muted-foreground' : 'text-primary')}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] leading-snug font-medium text-foreground">
                  {data.plan.name}
                </span>
                <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                  {summary.detail}
                </span>
              </span>
              <Button asChild size="sm" variant={summary.isFree ? 'default' : 'outline'} className="shrink-0">
                <Link href="/pricing">{summary.isFree ? 'Upgrade' : 'Change plan'}</Link>
              </Button>
            </li>
          </SettingsFormGroup>
          {summary.note ? (
            <p
              className={cn(
                'px-1 pt-2 text-[13px] leading-snug',
                summary.note.tone === 'alarm' ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {summary.note.text}
            </p>
          ) : null}
        </div>

        <SettingsFormGroup id="billing-invoices" label="Invoices">
          {rows.length === 0 ? (
            <li className="flex min-h-14 items-center px-4 py-2.5 text-[15px] leading-snug text-muted-foreground">
              No invoices yet.
            </li>
          ) : (
            rows.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} />)
          )}
          {invoices.hasNextPage ? (
            <li>
              <button
                type="button"
                onClick={() => void invoices.fetchNextPage()}
                disabled={invoices.isFetchingNextPage}
                className={cn(
                  'v2-interactive flex min-h-12 w-full items-center justify-center gap-2 px-4 py-2 text-[15px] font-medium text-primary',
                  'transition-colors duration-150 hover:bg-foreground/[0.04] motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                )}
              >
                {invoices.isFetchingNextPage ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                Show more
              </button>
            </li>
          ) : null}
        </SettingsFormGroup>

        {summary.cancel ? (
          <ul className={SETTINGS_BLOCK}>
            <li>
              <button
                type="button"
                onClick={() => setCancelKind(summary.cancel)}
                className={cn(
                  'v2-interactive flex min-h-14 w-full items-center gap-3.5 px-4 py-2.5 text-left',
                  'text-destructive transition-colors duration-150 hover:bg-destructive/[0.06] motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                )}
              >
                <XCircle aria-hidden className="size-5 shrink-0" />
                <span className="text-[15px] leading-snug font-medium">
                  {summary.cancel === 'trial' ? 'Cancel free trial' : 'Cancel plan'}
                </span>
              </button>
            </li>
          </ul>
        ) : null}
      </div>

      <CancelPlanDialog
        kind={cancelKind}
        planName={data.plan.name}
        lastDay={lastDay}
        onClose={() => setCancelKind(null)}
      />
    </div>
  );
}

function Heading() {
  return (
    <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
      Billing
    </h1>
  );
}

function InvoiceRow({ invoice }: { invoice: IInvoice }) {
  const date = formatBillingDate(invoice.paid_at ?? invoice.created_at);
  const detail = [invoice.description, date].filter(Boolean).join(' · ');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invoice.invoice_code);
      toast.success('Invoice number copied');
    } catch {
      toast.error("Couldn't copy the invoice number");
    }
  };
  return (
    <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
      <ReceiptText aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] leading-snug font-medium text-foreground tabular-nums">
          {invoice.formatted_amount}
        </span>
        <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{detail}</span>
      </span>
      <span
        className={cn(
          'shrink-0 text-[13px] leading-snug',
          invoice.status === 'success' && 'text-foreground',
          invoice.status === 'pending' && 'text-muted-foreground',
          invoice.status === 'failed' && 'text-destructive',
        )}
      >
        {invoice.status_label}
      </span>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={() => void copy()}
        aria-label={`Copy invoice number ${invoice.invoice_code}`}
        className="shrink-0 text-muted-foreground"
      >
        <Copy aria-hidden />
      </Button>
    </li>
  );
}
