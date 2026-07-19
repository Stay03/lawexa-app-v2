'use client';

import Link from 'next/link';
import { MessageSquare, SearchX, WifiOff, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * The `/conversations` page states, v2-native. v1's `components/common/EmptyState`
 * + `ErrorState` are boundary-blocked (v1 `components/`), so these are rebuilt on
 * the module design language: a quiet icon tile, one legible title, one line of
 * description, and — only where recovery is possible — a single action. Empty is
 * visually distinct from error (§ standing rule: error ≠ empty), and the empty
 * state is SEARCH-AWARE (a "Clear search" action when a query produced nothing).
 */

/** Shared page-scale state shell — one layout for empty / error / guest. */
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
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

/** One skeleton row shaped like `ConversationRow` (tile + title bar + time stub). */
function ConversationRowSkeleton() {
  return (
    <div className="flex min-h-14 items-center gap-3 px-3 py-2.5">
      <Skeleton className="size-9 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-3.5 w-1/2 rounded" />
      </div>
      <Skeleton className="h-3 w-10 shrink-0 rounded" />
    </div>
  );
}

/**
 * The initial-load skeleton — a stack of row skeletons that CROSS-FADES to the
 * resolved list (the list mounts with the module `REVEAL`, this fades out on
 * unmount is instant; the swap reads as content rising into the vacated rows).
 * Progressive opacity down the stack echoes the sidebar recents skeleton.
 */
export function ConversationsListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.12) }}>
          <ConversationRowSkeleton />
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
      <ConversationRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <ConversationRowSkeleton />
      </div>
    </div>
  );
}

/** Search-aware empty state: distinct copy + a Clear action when filtering. */
export function ConversationsEmptyState({
  search,
  onClear,
}: {
  /** The active (trimmed) search, or '' when unfiltered. */
  search: string;
  onClear: () => void;
}) {
  if (search) {
    return (
      <PageState
        icon={SearchX}
        title="No conversations found"
        description={`No conversations match “${search}”. Try a different search term.`}
        action={
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear search
          </Button>
        }
      />
    );
  }
  return (
    <PageState
      icon={MessageSquare}
      title="No conversations yet"
      description="Start a new conversation and it will show up here."
      action={
        <Button asChild size="sm">
          <Link href="/">New chat</Link>
        </Button>
      }
    />
  );
}

/** Error state — visually distinct from empty, with a real retry. */
export function ConversationsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load conversations"
      description="Something went wrong while loading your conversations. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** Guest state — the query is gated off, so this replaces a perpetual skeleton. */
export function ConversationsGuestState() {
  return (
    <PageState
      icon={MessageSquare}
      title="Sign in to see your conversations"
      description="Your saved conversations live here once you're signed in."
      action={
        <Link
          href="/"
          className={cn(
            'v2-interactive rounded-md px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-secondary',
            FOCUS_RING,
          )}
        >
          Go to Lawexa
        </Link>
      }
    />
  );
}
