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
  /** Whether the user is on the free plan — currently unused but kept so callers can tag the user state for future per-plan CTA tweaks. */
  planIsFree?: boolean;
  /** ISO timestamp of when the limit resets — rendered as a precise date+time line under the message when present. The server's humanised message only carries the date. */
  resetsAt?: string | null;
  className?: string;
}

interface BlockedCta {
  label: string;
  href: string;
  variant?: 'default' | 'outline';
}

/**
 * Soft-toned banner shown when the backend gates AI message sending.
 * Used on the Usage page, home submit error, and inside conversations.
 */
export function MessageBlockBanner({
  message,
  reason = 'plan_exhausted',
  resetsAt,
  className,
}: MessageBlockBannerProps) {
  const heading = blockedHeading(reason);
  const ctas = blockedCtas(reason);
  const resetTimestamp = resetsAt ? formatResetTimestamp(resetsAt) : null;

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-300/50 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/30',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{heading}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{message}</p>
          {resetTimestamp && (
            <p className="mt-1 text-xs text-muted-foreground">
              Resets {resetTimestamp}
            </p>
          )}
        </div>
      </div>
      {ctas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
          {ctas.map((cta) => (
            <Button
              key={cta.href + cta.label}
              asChild
              variant={cta.variant ?? 'default'}
              size="sm"
            >
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          ))}
        </div>
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
    case 'hard_limit':
      return 'You’ve hit your usage limit';
    case 'cancelled_grace_exhausted':
      return 'Your plan access has ended';
    // 'account_flagged' is intentionally treated like a plain exhausted state —
    // flagged users get the same experience as anyone out of messages, with no
    // special "contact support" messaging.
    case 'free_no_subscription':
    case 'plan_exhausted':
    case 'account_flagged':
    default:
      return 'You’ve used your messages for now';
  }
}

const BUY_PACK_CTA: BlockedCta = {
  label: 'Buy message pack',
  href: '/settings/message-packs',
  variant: 'outline',
};
const UPGRADE_CTA: BlockedCta = {
  label: 'Upgrade plan',
  href: '/pricing',
};

function blockedCtas(reason: TBlockedReasonCode): BlockedCta[] {
  switch (reason) {
    // 'account_flagged' shares the exhausted CTAs — a paid subscription also
    // overrides the block, so Upgrade / Buy a pack is a valid path for them too.
    case 'free_no_subscription':
    case 'plan_exhausted':
    case 'account_flagged':
      return [UPGRADE_CTA, BUY_PACK_CTA];
    case 'cancelled_grace_exhausted':
      return [
        { label: 'Reactivate plan', href: '/pricing' },
        BUY_PACK_CTA,
      ];
    case 'hard_limit':
      return [];
    default:
      return [];
  }
}
