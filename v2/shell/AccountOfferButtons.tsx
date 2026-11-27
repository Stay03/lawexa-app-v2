'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { signInHref } from '@/v2/runtime/sign-in-href';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

const PRIMARY =
  'v2-interactive inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90';
const SECONDARY =
  'v2-interactive inline-flex min-h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary';

/**
 * The two ways in for a guest, the same on every lock (a case, a note, a
 * statute, a refused action): make an account, or sign in to one. Signing in
 * comes back to this page; signing up goes through the email check and
 * onboarding first, so it has nothing to come back to.
 */
export function AccountOfferButtons({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Link href="/register" className={cn(PRIMARY, FOCUS_RING)}>
        Create an account
        <ArrowUpRight aria-hidden className="size-4" />
      </Link>
      <Link href={signInHref(pathname)} className={cn(SECONDARY, FOCUS_RING)}>
        Sign in
      </Link>
    </div>
  );
}

/** A member's one way on: the plans. */
export function SeePlansButton() {
  return (
    <Link href="/pricing" className={cn(PRIMARY, FOCUS_RING)}>
      See plans
      <ArrowUpRight aria-hidden className="size-4" />
    </Link>
  );
}
