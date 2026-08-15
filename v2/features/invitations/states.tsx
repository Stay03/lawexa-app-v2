'use client';

import Link from 'next/link';
import { MailOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';

/**
 * The `/invitations` states. Same three-state contract as every other v2 list
 * surface, with the empty/failure split the kit introduced: an empty inbox is a
 * calm, teaching panel; a failed inbox is a one-line strip with a retry.
 *
 * The skeleton pulses everywhere it is used, route fallback included. One wait
 * gets one appearance, so nothing changes character halfway through the load.
 */

/**
 * One skeleton card at {@link import('./InvitationCard').InvitationCard}'s
 * real geometry — INCLUDING the way that card reflows on a phone, which a
 * flat skeleton gets wrong three times over at the route fallback.
 *
 * The card's own measurements, and what each one costs here:
 *  - The HEADLINE is a wrapping sentence ("Ada Nwosu invited you to ⬛ Firm HQ")
 *    with a 24px crest inline, so its line box is ~24px and it runs to TWO
 *    lines below `sm` and one at `sm` and up. Reserving a single 16px bar
 *    under-reserved it by ~30px on every phone.
 *  - The ACTION ROW is `flex-wrap` with a `w-full sm:w-auto` button wrapper, so
 *    below `sm` the buttons take a row of their own (32px) UNDER the role chip
 *    (~21px) plus the 8px `gap-y`. A single 32px line under-reserved it by
 *    another ~29px.
 *  - Every bar in the old action row was `shrink-0` with no wrap, so at 320px
 *    it demanded ~288px inside a ~256px box and pushed the card sideways.
 * This mirrors the card's actual flex rules instead of guessing their result,
 * which is why it cannot drift again: `flex-wrap`, `w-full sm:w-auto`, and the
 * Accept bar taking the remaining width exactly as the button does.
 */
function InvitationCardSkeleton() {
  return (
    <div className="mb-2 rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="mt-0.5 size-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          {/* Headline: two ~24px lines on a phone, one from `sm`. */}
          <div className="space-y-1">
            <Skeleton className="h-[22px] w-4/5 rounded" />
            <Skeleton className="h-[22px] w-2/5 rounded sm:hidden" />
          </div>
          {/* The facts meta line. */}
          <Skeleton className="mt-1.5 h-4 w-3/5 rounded" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 sm:ml-13">
        <Skeleton className="h-[21px] w-16 shrink-0 rounded-full" />
        <Skeleton className="h-3 w-6 shrink-0 rounded" />
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
          <Skeleton className="h-8 flex-1 rounded-md sm:w-20 sm:flex-none" />
        </div>
      </div>
    </div>
  );
}

/** The initial-load skeleton — three cards under one section heading bar, which
 *  is the median inbox (most people have one or two invitations, never ten).
 *  The 8px between cards is the card's own bottom margin, exactly as in the
 *  live list. */
export function InvitationsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      <Skeleton className="mb-2 h-4 w-24 rounded" />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.2) }}>
          <InvitationCardSkeleton />
        </div>
      ))}
    </div>
  );
}

/** The ghost the empty inbox carries — one silent card at the real geometry,
 *  so the panel shows the kind of thing that lands here rather than only
 *  naming it. Never pulses: nothing is loading. */
function InvitationCardGhost() {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 size-10 shrink-0 rounded-full bg-secondary" />
        <div className="min-w-0 flex-1">
          <div className="h-[22px] w-4/5 rounded bg-secondary" />
          <div className="mt-1.5 h-4 w-3/5 rounded bg-secondary/70" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-[21px] w-16 shrink-0 rounded-full bg-secondary/70" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="h-8 w-20 rounded-md bg-secondary/70" />
          <div className="h-8 w-20 rounded-md bg-secondary" />
        </div>
      </div>
    </div>
  );
}

/**
 * The designed empty inbox — it says the true thing (nothing is waiting) and
 * it says what to do about it, in the tone the brief asks for: an invitation
 * is something another person sends you, so the way onward is to ask them.
 */
export function InvitationsEmptyState() {
  return (
    <CollabEmpty
      icon={MailOpen}
      tone="neutral"
      title="No invitations"
      description="Nothing is waiting for you. Ask a colleague to invite you to their organization, space or channel — it lands here the moment they do."
      ghost={<InvitationCardGhost />}
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/spaces">Back to your spaces</Link>
        </Button>
      }
      footnote="You can also start a space of your own."
    />
  );
}

/**
 * All three inboxes failed, so the screen is otherwise blank — which is the
 * one case `CollabFailure` renders as a PANEL rather than a strip (its
 * docblock holds the rule). A partial failure is NOT this state: one inbox
 * failing leaves the other two rendered, and gets the quiet notice strip in
 * `InvitationsScreen` instead.
 */
export function InvitationsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <CollabFailure
      presentation="panel"
      title="Couldn’t load your invitations"
      message="Something went wrong while checking for invitations."
      onRetry={onRetry}
    />
  );
}
