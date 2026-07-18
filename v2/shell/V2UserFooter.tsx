'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { subscriptionQueries } from '@/v2/features/subscription/queries';
import type { SessionUser } from '@/v2/runtime/session';

/**
 * V2UserFooter — the real account row for the sidebar + drawer footers,
 * replacing the hardcoded "AO / Adaeze Okafor / Premium" placeholder.
 *
 * Identity comes from the server-verified session (threaded as a prop from the
 * layout — clean server→client threading), so the name/avatar are correct on
 * first paint with no client auth round-trip. The plan line is the ONLY thing
 * fetched client-side: `subscriptionQueries.current()` gated to signed-in users,
 * mirroring v1's `plan?.name ?? 'Free'` semantics.
 *
 * Signed out → a tasteful sign-in affordance instead of the account row.
 */
export function V2UserFooter({
  user,
  className,
}: {
  user: SessionUser | null;
  className?: string;
}) {
  const planQuery = useQuery({
    ...subscriptionQueries.current(),
    enabled: !!user,
  });

  if (!user) {
    return (
      <Button asChild className={cn('w-full', className)}>
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }

  // Plan resolves after first paint — show a skeleton, then cross-fade to the
  // real plan name (skeleton-first rule #23; never a placeholder-string flash).
  const planName = planQuery.data?.data?.plan?.name;

  return (
    <div className={cn('flex items-center gap-2 rounded-lg px-1 py-1', className)}>
      <Avatar className="size-8">
        <AvatarImage src={user.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {initialsOf(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate text-sm font-medium text-foreground">
          {user.name}
        </span>
        {planQuery.isPending ? (
          <Skeleton className="mt-0.5 h-3 w-14 rounded" />
        ) : (
          <span className="truncate text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            {planName ?? 'Free'}
          </span>
        )}
      </div>
    </div>
  );
}

/** Up-to-two-letter initials from a display name (falls back to "?"). */
function initialsOf(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return initials || '?';
}
