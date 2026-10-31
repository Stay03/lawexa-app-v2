'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/** Where a reader compares plans (the pricing screen, as Billing and Usage link it). */
export const PLANS_HREF = '/pricing';

/** The words of the way to the plans, on a link and on a toast's action. */
export const PLANS_LABEL = 'See plans';

/**
 * The way to the plans beside an upload the server refused at a plan limit,
 * shown only when a bigger plan allows more (`upgrade`, Backend eeceb2b2).
 */
export function PlansLink({ className }: { className?: string }) {
  return (
    <Link
      href={PLANS_HREF}
      className={cn('rounded-sm font-medium underline underline-offset-2 hover:no-underline', FOCUS_RING, className)}
    >
      {PLANS_LABEL}
    </Link>
  );
}

/**
 * A toast's way to the plans, for an upload refused at a plan limit a bigger
 * plan allows. `go` is the router's push, so the toast stays inside the app.
 */
export function plansToastAction(go: (href: string) => void): { label: string; onClick: () => void } {
  return { label: PLANS_LABEL, onClick: () => go(PLANS_HREF) };
}
