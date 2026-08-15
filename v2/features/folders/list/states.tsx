'use client';

import Link from 'next/link';
import { FolderOpen, Plus, Search, WifiOff, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The `/folders` states — the three-state contract every v2 query region owns
 * (standards §8iv), plus the one this surface needs:
 *
 *  - SIGNED OUT. Every folder endpoint answers 401 without a bearer token
 *    (probed, August 4 2026), so the query is gated on the session and a
 *    visitor with no session gets a designed sign-in state rather than an
 *    error screen.
 *
 * THERE IS NO GUEST STATE HERE, and that is a deliberate correction. v1 bounced
 * guests to an auth modal from the sidebar; the API gives a guest token FULL
 * folder access — create, nest, fill, rename, delete were all probed on a guest
 * — so guests own real folders and see exactly what everyone else sees.
 */

function PageState({
  icon: Icon,
  title,
  description,
  tone = 'neutral',
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** `accent` is an invitation the reader is meant to act on. */
  tone?: 'neutral' | 'accent';
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <span
        aria-hidden
        className={cn(
          'flex size-12 items-center justify-center rounded-2xl',
          tone === 'accent'
            ? 'bg-primary/10 text-primary'
            : 'bg-secondary text-muted-foreground',
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

/**
 * One skeleton row, mirroring `FolderRow`'s geometry EXACTLY — the same nesting
 * (`gap-2` between the identity block and the menu, `gap-3 px-2 py-3` inside
 * it), so the tile, the text column and the trigger land on the pixels the
 * resolved row will use and nothing reflows on hand-off.
 *
 * TWO TEXT LINES, which is the folder row's median AND its maximum: a folder is
 * a name and a meta line, never a preview.
 */
function FolderRowSkeleton() {
  return (
    <div className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 items-start gap-3 px-2 py-3">
        <Skeleton className="mt-0.5 size-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-2/5 rounded" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="ml-auto h-3 w-16 shrink-0 rounded" />
          </div>
        </div>
      </div>
      <Skeleton className="mt-3.5 size-9 shrink-0 rounded-full" />
    </div>
  );
}

/**
 * The initial-load skeleton — rows with progressive opacity down the stack, the
 * shared v2 list fade, so a reader moving between the library surfaces and this
 * one sees ONE loading language.
 *
 * It pulses everywhere it is drawn, the route fallback included (standards
 * §8i). A wait is a wait: the reader cannot tell an RSC payload from a query,
 * so two appearances for one wait would only print a seam into the middle of
 * the load.
 */
export function FoldersListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.14) }}>
          <FolderRowSkeleton />
        </div>
      ))}
    </div>
  );
}

/** The next-page skeleton shown at the sentinel while a page is in flight. */
export function FoldersNextPageSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <FolderRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <FolderRowSkeleton />
      </div>
    </div>
  );
}

/**
 * Empty — search-aware, because "no folder matches mareva" and "you have not
 * made one yet" are different facts that want different ways forward.
 *
 * The first-folder copy says what a folder is FOR rather than what it is: the
 * legal profession's own container is the matter file, and that is the sentence
 * that makes someone create one.
 */
export function FoldersEmptyState({
  search,
  onClearSearch,
  onNewFolder,
}: {
  /** The active search, or `''`. */
  search: string;
  onClearSearch: () => void;
  onNewFolder: () => void;
}) {
  if (search) {
    return (
      <PageState
        icon={Search}
        title="No folders match that search"
        description={`None of your folders are named “${search}”.`}
        action={
          <Button variant="outline" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        }
      />
    );
  }

  return (
    <PageState
      icon={FolderOpen}
      tone="accent"
      title="No folders yet"
      description="Group the cases, statutes and notes for one matter in one place. Folders are private to you."
      action={
        <Button size="sm" onClick={onNewFolder}>
          <Plus aria-hidden className="size-4" />
          New folder
        </Button>
      }
    />
  );
}

/**
 * Error state — visually distinct from empty, with a real retry.
 *
 * `message` carries the SERVER's own explanation when it gave one (a 4xx
 * refusal). A generic "something went wrong" over a server that said exactly
 * what was wrong is the screen editorialising; the designed sentence is kept
 * for the cases where there is genuinely nothing to relay (5xx, network).
 */
export function FoldersErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load your folders"
      description={
        message?.trim() ||
        'Something went wrong while loading your folders. Please try again.'
      }
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** Signed out — the query is gated off, so this replaces a 401 screen. */
export function FoldersSignedOutState() {
  return (
    <PageState
      icon={FolderOpen}
      title="Sign in to see your folders"
      description="Folders keep the cases, statutes and notes for one matter together, and they travel with your account."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}
