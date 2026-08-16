'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { subscriptionQueries } from '@/v2/features/subscription/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import { initialsOf } from './identity';

/**
 * AccountCard — the block the settings screen opens with: who is signed in, and
 * on what plan.
 *
 * Both reference apps lead with this, and the owner asked for the equivalent
 * "honestly: show what we actually know, and do not invent a plan or a billing
 * state we cannot read". So:
 *
 *  - THE IDENTITY IS FREE. Name, email and avatar all come from the session
 *    snapshot the v2 layout already resolved (`session-context.tsx`), so the
 *    card is complete on the first paint with no request and no reflow.
 *  - THE PLAN IS ONE REQUEST, AND IT IS USUALLY ALREADY PAID. It is the same
 *    `subscriptionQueries.current()` the sidebar/drawer account row runs, so on
 *    desktop — where that row is always mounted — this reads the cache and asks
 *    nothing. It is the one fact on this screen that has to be fetched, and it
 *    is the one the owner named.
 *  - AND WHEN IT CANNOT BE READ, NOTHING IS SAID. The shell footer falls back
 *    to the word "Free" if the request fails, which states a billing fact this
 *    app did not learn. Here a failure simply leaves the pill out: the card
 *    still answers "which account am I in?", which is what it is for.
 *
 * A GUEST IS NOT AN ACCOUNT. Guest sessions are view-only until the person
 * registers — no profile, no plan, no invoices — so the card becomes the two
 * doors instead of an account row. Same bug, same fix, same reasoning as
 * `V2UserFooter`, where a guest was shown "Set a handle" and a plan they could
 * never have.
 */
export function AccountCard() {
  const { signedIn, name, email, avatarUrl, role } = useV2Session();
  const isGuest = role === 'guest';
  const hasAccount = signedIn && !isGuest;

  const planQuery = useQuery({
    ...subscriptionQueries.current(),
    enabled: hasAccount,
  });

  if (!hasAccount) {
    return (
      <div className="rounded-2xl bg-secondary px-4 py-4">
        <p className="text-sm text-muted-foreground">
          {isGuest
            ? 'You are browsing as a guest. Create an account to keep your work and your settings.'
            : 'Sign in to reach your profile, your plan and your organization.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/register">Create account</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  const planName = planQuery.data?.data?.plan?.name;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3.5">
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-snug font-medium text-foreground">
          {name ?? 'Your account'}
        </p>
        {email ? (
          <p className="truncate text-[13px] leading-snug text-muted-foreground">
            {email}
          </p>
        ) : null}
      </div>
      {/* Skeleton-first, then a cross-fade — never an empty gap that pops, and
          never a placeholder word standing in for a plan. */}
      {planQuery.isPending ? (
        <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
      ) : planName ? (
        <span className="inline-flex shrink-0 items-center rounded-full bg-background px-2.5 py-1 text-xs font-medium text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          {/* The pill alone would be read as a bare word. */}
          <span className="sr-only">Plan: </span>
          {planName}
        </span>
      ) : null}
    </div>
  );
}
