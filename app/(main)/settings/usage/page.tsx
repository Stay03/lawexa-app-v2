'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bookmark,
  Infinity as InfinityIcon,
  MessageSquare,
  NotebookPen,
  Plus,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import PurchaseDialog from '@/components/payg/PurchaseDialog';
import { MessageBlockBanner } from '@/components/chat/message-block-banner';
import { useUserLimits } from '@/lib/hooks/useUserLimits';
import { cn } from '@/lib/utils';
import type {
  IAiMessagesLimit,
  IGenericLimit,
  IUserLimits,
  IUserLimitsPlan,
} from '@/types/message-pack';

/******************************************************************************
                               Page
******************************************************************************/

export default function UsagePage() {
  const limitsQuery = useUserLimits();

  if (limitsQuery.isLoading) return <UsageSkeleton />;
  if (limitsQuery.isError || !limitsQuery.data?.data) {
    return (
      <ErrorState
        title="Failed to load usage"
        description="We couldn't load your plan limits and balances."
        retry={() => limitsQuery.refetch()}
      />
    );
  }

  const data: IUserLimits = limitsQuery.data.data;
  const blocked = data.ai_messages.blocked_reason;

  return (
    <div>
      {blocked && (
        <MessageBlockBanner
          message={blocked.message}
          reason={blocked.reason}
          planIsFree={data.plan.is_free}
          className="mb-6"
        />
      )}

      <PlanHeader plan={data.plan} />

      <Separator className="my-8" />

      <SectionHeading>AI Messages</SectionHeading>
      <AiMessagesCard ai={data.ai_messages} paygBalance={data.payg.balance} />

      <Separator className="my-8" />

      <SectionHeading>Pay-as-you-go</SectionHeading>
      <PaygCard balance={data.payg.balance} />

      <Separator className="my-8" />

      <SectionHeading>Other limits</SectionHeading>
      <div className="space-y-6">
        <LimitRow
          label="Note creations"
          icon={NotebookPen}
          limit={data.note_creations}
        />
        <LimitRow label="Bookmarks" icon={Bookmark} limit={data.bookmarks} />
      </div>
    </div>
  );
}

/******************************************************************************
                               Plan header
******************************************************************************/

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past due',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const STATUS_TONE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  trialing: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  past_due: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  expired: 'bg-muted text-muted-foreground',
};

function PlanHeader({ plan }: { plan: IUserLimitsPlan }) {
  const sub = plan.subscription;
  const status = sub?.status;
  const inGrace = sub?.ends_at != null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="size-5 text-primary" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{plan.name}</h2>
            {status && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  STATUS_TONE[status] ?? STATUS_TONE.expired
                )}
              >
                {STATUS_LABEL[status] ?? status}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground capitalize">
            {plan.interval} plan
          </p>
          {inGrace && sub?.ends_at && (
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
              Access ends on{' '}
              <span className="font-medium">{formatDate(sub.ends_at)}</span>
            </p>
          )}
          {!inGrace && sub?.next_payment_date && (
            <p className="mt-1 text-sm text-muted-foreground">
              Renews on{' '}
              <span className="font-medium text-foreground">
                {formatDate(sub.next_payment_date)}
              </span>
            </p>
          )}
        </div>
      </div>
      {plan.is_free && (
        <Button asChild>
          <Link href="/pricing">
            Upgrade
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

/******************************************************************************
                               AI messages hero card
******************************************************************************/

function AiMessagesCard({
  ai,
  paygBalance,
}: {
  ai: IAiMessagesLimit;
  paygBalance: number;
}) {
  const isUnlimited = ai.plan_limit === null;
  const total = ai.total_remaining;
  const planRemaining = ai.remaining ?? 0;
  const denominator = ai.used + planRemaining;
  const pct = denominator > 0 ? Math.min(100, Math.round((ai.used / denominator) * 100)) : 0;

  return (
    <div className="rounded-lg border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Total remaining
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            {isUnlimited ? (
              <span className="flex items-baseline gap-1.5 text-3xl font-semibold">
                <InfinityIcon className="size-7 self-center" />
                Unlimited
              </span>
            ) : (
              <>
                <span className="text-3xl font-semibold">{total ?? 0}</span>
                <span className="text-sm text-muted-foreground">
                  {(total ?? 0) === 1 ? 'message' : 'messages'}
                </span>
              </>
            )}
          </div>
          {!isUnlimited && paygBalance > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Includes {paygBalance} PAYG · {planRemaining} on plan
            </p>
          )}
        </div>
        {!isUnlimited && (
          <span className="text-sm text-muted-foreground">
            {ai.used} / {denominator} used ({pct}%)
          </span>
        )}
      </div>

      {!isUnlimited && (
        <div className="mt-4">
          <ProgressBar percent={pct} />
        </div>
      )}

      {ai.reset_message && (
        <p className="mt-3 text-xs text-muted-foreground">{ai.reset_message}</p>
      )}
    </div>
  );
}

/******************************************************************************
                               PAYG card
******************************************************************************/

function PaygCard({ balance }: { balance: number }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="size-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">
              {balance} {balance === 1 ? 'message' : 'messages'} in balance
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              PAYG messages never expire and are used after your plan runs out.
            </p>
          </div>
        </div>
        <Button onClick={() => setIsOpen(true)} size="sm" variant="outline">
          <Plus className="size-4" />
          Buy messages
        </Button>
      </div>
      <PurchaseDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}

/******************************************************************************
                               Generic limit row
******************************************************************************/

function LimitRow({
  label,
  icon: Icon,
  limit,
}: {
  label: string;
  icon: typeof Bookmark;
  limit: IGenericLimit;
}) {
  const isUnlimited = limit.plan_limit === null;
  const remaining = limit.remaining ?? 0;
  const denominator = limit.used + remaining;
  const pct = denominator > 0 ? Math.min(100, Math.round((limit.used / denominator) * 100)) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {isUnlimited ? 'Unlimited' : `${limit.used} / ${denominator}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="mt-2">
          <ProgressBar percent={pct} />
        </div>
      )}
      {limit.resets_at && !isUnlimited && (
        <p className="mt-1 text-xs text-muted-foreground">
          Resets {formatDate(limit.resets_at)}
        </p>
      )}
    </div>
  );
}

/******************************************************************************
                               Bits
******************************************************************************/

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">
      {children}
    </h3>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const tone =
    percent >= 90
      ? 'bg-rose-500'
      : percent >= 70
        ? 'bg-amber-500'
        : 'bg-primary';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all', tone)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/******************************************************************************
                               Skeleton
******************************************************************************/

function UsageSkeleton() {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Separator className="my-8" />
      <Skeleton className="h-4 w-24" />
      <div className="mt-4 rounded-lg border p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-8 w-32" />
        <Skeleton className="mt-4 h-1.5 w-full" />
      </div>
      <Separator className="my-8" />
      <Skeleton className="h-4 w-24" />
      <div className="mt-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
