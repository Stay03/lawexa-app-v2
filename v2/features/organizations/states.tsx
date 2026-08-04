'use client';

import { Building2, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { LIST_COLUMN } from '@/v2/shell/page-columns';

/**
 * The `/organization` states. `GET /my-organization` answering `data: null` is
 * NOT one of them — that is a real answer with its own designed panel
 * ({@link NoOrganizationState}), not an empty collection and not an error.
 * Phase-5 W4, study A8, owner decision D7 — 2026-08-04.
 */

/**
 * The screen's silhouette — identity header, then the verification panel.
 * `app/v2/organization/loading.tsx` renders it `still` and inert; the live
 * screen renders it (pulsing) while `/my-organization` resolves, so the
 * hand-off is content resolving rather than a layout swap.
 */
export function OrganizationScreenFrame({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className={LIST_COLUMN}>
      <div className="flex items-start gap-3">
        <Skeleton className={cn('size-11 shrink-0 rounded-xl', bar)} />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className={cn('h-7 w-2/5 rounded', bar)} />
          <Skeleton className={cn('h-3.5 w-3/5 rounded', bar)} />
        </div>
        <Skeleton className={cn('h-8 w-24 shrink-0 rounded-md', bar)} />
      </div>
      <Skeleton className={cn('mt-5 h-20 w-full rounded-xl', bar)} />
    </div>
  );
}

/**
 * `data: null` — the caller has no organization. The designed panel that
 * teaches what one is FOR (owning shared spaces, earning a verified badge) and
 * offers the one action, plus the honest second path: you may not need to
 * create one at all if someone is about to invite you.
 */
export function NoOrganizationState({ onCreate }: { onCreate: () => void }) {
  return (
    <CollabMessage
      icon={Building2}
      tone="accent"
      title="You're not in an organization"
      description="An organization is your firm, school or company inside Lawexa. It can own shared spaces and earn a verified badge, so the people you work with can see who they're talking to."
      action={
        <Button size="sm" onClick={onCreate}>
          Create an organization
        </Button>
      }
      footnote="Expecting an invitation instead? It arrives on your Invitations page."
    />
  );
}

export function OrganizationErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <CollabMessage
      icon={WifiOff}
      tone="alert"
      title="Couldn't load your organization"
      description={
        message?.trim() || 'Something went wrong on our side. Please try again.'
      }
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}
