'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TBlockedReasonCode } from '@/types/message-pack';

interface MessageBlockBannerProps {
  /** Server-provided message body — already humanized and includes the reset date. */
  message: string;
  /** Why the user is blocked. Defaults to plan_exhausted when unknown (e.g. in-stream errors that only carry an error code). */
  reason?: TBlockedReasonCode;
  /** Whether the user is on the free plan — switches the plan_exhausted CTA between Upgrade and Buy pack. */
  planIsFree?: boolean;
  /** ISO timestamp of when the limit resets — rendered as a precise date+time line under the message when present. The server's humanised message only carries the date. */
  resetsAt?: string | null;
  className?: string;
}

/**
 * Soft-toned banner shown when the backend gates AI message sending.
 * Used on the Usage page, home submit error, and inside conversations.
 */
export function MessageBlockBanner({
  message,
  reason = 'plan_exhausted',
  planIsFree = false,
  resetsAt,
  className,
}: MessageBlockBannerProps) {
  const heading = blockedHeading(reason);
  const cta = blockedCta(reason, planIsFree);
  const resetTimestamp = resetsAt ? formatResetTimestamp(resetsAt) : null;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-amber-300/50 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-medium">{heading}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{message}</p>
          {resetTimestamp && (
            <p className="mt-1 text-xs text-muted-foreground">
              Resets {resetTimestamp}
            </p>
          )}
        </div>
      </div>
      {cta && (
        <Button asChild variant={cta.variant ?? 'default'} size="sm">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      )}
    </div>
  );
}

function formatResetTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function blockedHeading(reason: TBlockedReasonCode): string {
  switch (reason) {
    case 'account_flagged':
      return 'Your account needs attention';
    case 'hard_limit':
      return 'You’ve hit your usage limit';
    case 'cancelled_grace_exhausted':
      return 'Your plan access has ended';
    case 'free_no_subscription':
    case 'plan_exhausted':
    default:
      return 'You’ve used your messages for now';
  }
}

function blockedCta(
  reason: TBlockedReasonCode,
  planIsFree: boolean,
): { label: string; href: string; variant?: 'default' | 'outline' } | null {
  switch (reason) {
    case 'free_no_subscription':
      return { label: 'Upgrade', href: '/pricing' };
    case 'plan_exhausted':
      return planIsFree
        ? { label: 'Upgrade', href: '/pricing' }
        : { label: 'Buy message pack', href: '/settings/message-packs' };
    case 'cancelled_grace_exhausted':
      return { label: 'Reactivate plan', href: '/pricing' };
    case 'hard_limit':
      return null;
    case 'account_flagged':
      return {
        label: 'Contact support',
        href: 'mailto:support@lawexa.com',
        variant: 'outline',
      };
    default:
      return null;
  }
}
