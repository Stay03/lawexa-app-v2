'use client';

import Link from 'next/link';
import {
  Bell,
  BellOff,
  CheckCheck,
  ExternalLink,
  SearchX,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { NotificationFilter } from './filter';

/**
 * The `/notifications` states — the three-state contract every v2 query region
 * owns (standards §8iv), the signed-out state, and the two answers the
 * `/notifications/{id}` resolver can give instead of a redirect.
 *
 * Rebuilt v2-native rather than reusing v1's `EmptyState` / `ErrorState`: those
 * live in `components/`, which the v2 import boundary blocks. `PageState` is the
 * bookmarks one (`bookmarks/list/states.tsx`), the same centred tile, title and
 * sentence, so a reader moving between the two lists meets one grammar.
 */

function PageState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <Icon className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/* ── Skeletons ────────────────────────────────────────────────────────────── */

/**
 * One skeleton row at `NotificationRow`'s page geometry EXACTLY: the body's
 * `px-2 py-3`, the tile's `mt-0.5`, each text line at its real line box (a
 * 20px title, two 16px preview lines, the 16px time line), the delete button's
 * circle at `pt-3.5`, and the row's own `pb-0.5`. So the resolved row lands on
 * the same pixels and nothing reflows at the hand-off.
 *
 * TWO PREVIEW LINES, the median: 33 of 46 live rows measured on 2026-10-05
 * carry the full 140-character preview, which fills both clamped lines at
 * every width this column has.
 */
function NotificationRowSkeleton() {
  return (
    <div className="flex items-start pb-0.5">
      <div className="flex min-w-0 flex-1 items-start gap-3 px-2 py-3">
        <Skeleton className="mt-0.5 size-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex h-5 items-center">
            <Skeleton className="h-4 w-3/5 rounded" />
          </div>
          <div className="mt-0.5 flex h-4 items-center">
            <Skeleton className="h-3 w-full rounded" />
          </div>
          <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-3/5 rounded" />
          </div>
          <div className="mt-1 flex h-4 items-center">
            <Skeleton className="h-3 w-10 rounded" />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-start pt-3.5 pl-1">
        <Skeleton className="size-9 rounded-full" />
      </div>
    </div>
  );
}

/**
 * The first-load skeleton: one day header at the real header's line box, and
 * eight rows with opacity falling down the stack (the shared v2 list fade). It
 * pulses in every caller, route fallback included (standards §8i): a wait is a
 * wait, and two appearances for one wait would only print a seam into the
 * middle of the load.
 */
export function NotificationsListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="mb-1.5 flex h-4 items-center px-2">
        <Skeleton className="h-3 w-16 rounded" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.11) }}>
          <NotificationRowSkeleton />
        </div>
      ))}
    </div>
  );
}

/** The next-page skeleton shown at the sentinel while a page is in flight. */
export function NextPageSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <NotificationRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <NotificationRowSkeleton />
      </div>
    </div>
  );
}

/* ── The inbox ────────────────────────────────────────────────────────────── */

/**
 * Per-filter empty copy. Every state offers a next step (standards §8iv): an
 * empty inbox points at the delivery settings, an empty Unread tab back to All.
 */
export function NotificationsEmptyState({
  filter,
  onShowAll,
}: {
  filter: NotificationFilter;
  onShowAll: () => void;
}) {
  if (filter === 'unread') {
    return (
      <PageState
        icon={CheckCheck}
        title="Nothing unread"
        description="Everything here has been read."
        action={
          <Button variant="outline" size="sm" onClick={onShowAll}>
            View all
          </Button>
        }
      />
    );
  }
  return (
    <PageState
      icon={BellOff}
      title="You’re all caught up"
      description="New notifications land here the moment they arrive."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/settings/notifications">Notification settings</Link>
        </Button>
      }
    />
  );
}

/**
 * Error state, visually distinct from empty, with a real retry. `message` is
 * the SERVER's own sentence when it refused (a 4xx); the designed line is for
 * the cases with nothing to relay (5xx, network).
 */
export function NotificationsErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn’t load notifications"
      description={
        message?.trim() ||
        'Something went wrong while loading your notifications. Please try again.'
      }
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** Signed out: the queries are gated off, so this replaces a 401. */
export function NotificationsSignedOutState() {
  return (
    <PageState
      icon={Bell}
      title="Sign in to see your notifications"
      description="Mentions, invitations and quiz lobbies that are waiting for you land here."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}

/* ── The resolver ─────────────────────────────────────────────────────────── */

/** The way back to the inbox, the one action every resolver state offers. */
function BackToInbox() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href="/notifications">Back to notifications</Link>
    </Button>
  );
}

/** A 404: deleted, or never this account's. The API answers both the same
 *  way, so the copy names both. */
export function NotificationGoneState() {
  return (
    <PageState
      icon={SearchX}
      title="This notification is gone"
      description="It was deleted, or it belongs to another account."
      action={<BackToInbox />}
    />
  );
}

/**
 * The row links outside Lawexa. The resolver does not open it by itself: a new
 * tab needs the reader's own gesture, and replacing the app with someone
 * else's page is not something a link into the app should do.
 */
export function NotificationExternalState({
  title,
  href,
}: {
  title: string;
  href: string;
}) {
  return (
    <PageState
      icon={ExternalLink}
      title="This notification links outside Lawexa"
      description={title}
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild size="sm">
            <a href={href} target="_blank" rel="noopener noreferrer">
              Open link
            </a>
          </Button>
          <BackToInbox />
        </div>
      }
    />
  );
}

/** Any other failure on the resolver, with a retry. */
export function NotificationResolveErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn’t open this notification"
      description="Something went wrong while loading it. Please try again."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
          <BackToInbox />
        </div>
      }
    />
  );
}
