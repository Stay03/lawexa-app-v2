'use client';

import Link from 'next/link';
import {
  Bookmark,
  BookText,
  FolderOpen,
  MailCheck,
  NotebookPen,
  Scale,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { BookmarkTab } from './TypeTabs';

/**
 * The `/bookmarks` page states — the three-state contract every v2 query region
 * owns (standards §8iv), plus two this surface needs that the other library
 * lists do not:
 *
 *  - SIGNED OUT. `GET /bookmarks` answers 401 with no token (measured August 3,
 *    2026). A guest holds a real token and reads AND writes bookmarks normally,
 *    so this state is for a visitor with no session at all.
 *  - EMAIL UNVERIFIED. Measured the same day: a registered account whose email
 *    is unverified gets **403 on both the read and the write**, with the API's
 *    own sentence as the message. That is not a network failure and it is not
 *    an empty collection — it is a door with a key the reader already has, so
 *    it gets its own designed state and the API's message is the honest copy.
 *
 * Rebuilt v2-native rather than reusing v1's `EmptyState` / `ErrorState`: those
 * live in `components/`, which the v2 import boundary blocks.
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

/**
 * One skeleton row, mirroring `BookmarkRow`'s geometry EXACTLY — the same
 * nesting (`gap-2` between the identity block and the star, `gap-3 px-2 py-3`
 * inside it), so the tile, the text column and the star land on the same
 * pixels the resolved row will use and nothing reflows on hand-off.
 *
 * TWO TEXT LINES, which is the row's MEDIAN, not its maximum: cases, statutes
 * and folders are two lines and only notes add a preview. Reserving at the tall
 * end would defend against a settle that rarely happens while making the common
 * one — collapsing onto a two-line row — worse (standards §8iv).
 */
function BookmarkRowSkeleton({ still = false }: { still?: boolean }) {
  // Threaded explicitly rather than switched off by a `[&_*]` descendant
  // variant: an arbitrary variant that fails to generate fails SILENTLY, and
  // "the fallback stopped pulsing" is exactly the kind of regression nobody
  // notices.
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 items-start gap-3 px-2 py-3">
        <Skeleton className={cn('mt-0.5 size-9 shrink-0 rounded-lg', bar)} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className={cn('h-4 w-3/5 rounded', bar)} />
          <Skeleton className={cn('h-3 w-2/5 rounded', bar)} />
        </div>
      </div>
      <Skeleton className={cn('mt-3.5 size-9 shrink-0 rounded-full', bar)} />
    </div>
  );
}

/**
 * The initial-load skeleton — six rows with progressive opacity down the stack,
 * the shared v2 list fade, so a reader moving between the library surfaces and
 * this one sees ONE loading language.
 *
 * `still` drops the pulse for a route fallback, where nothing is in flight
 * behind the shape (standards §8i: a pulse promises a request).
 */
export function BookmarksListSkeleton({
  rows = 6,
  still = false,
}: {
  rows?: number;
  still?: boolean;
}) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.14) }}>
          <BookmarkRowSkeleton still={still} />
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
      <BookmarkRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <BookmarkRowSkeleton />
      </div>
    </div>
  );
}

/** Per-tab empty copy. One entry per tab, so no tab can fall through to a
 *  generic sentence that names the wrong thing (v1's did — it had no statute
 *  tab at all, and its "cases, notes, and folders" copy said so out loud). */
const EMPTY_COPY: Record<
  BookmarkTab,
  { icon: LucideIcon; title: string; description: string; browse?: { href: string; label: string } }
> = {
  all: {
    icon: Bookmark,
    title: 'Nothing saved yet',
    description:
      'Press the star on a case, statute, note or folder and it lands here — ready for the next time you need it.',
    browse: { href: '/cases', label: 'Browse cases' },
  },
  case: {
    icon: Scale,
    title: 'No saved cases',
    description: 'Cases you star anywhere in Lawexa appear here.',
    browse: { href: '/cases', label: 'Browse cases' },
  },
  statute: {
    icon: BookText,
    title: 'No saved statutes',
    description: 'Statutes you star appear here, ready to re-open.',
    browse: { href: '/statutes', label: 'Browse statutes' },
  },
  note: {
    icon: NotebookPen,
    title: 'No saved notes',
    description: 'Notes you star appear here.',
    browse: { href: '/notes', label: 'Browse notes' },
  },
  folder: {
    icon: FolderOpen,
    title: 'No saved folders',
    description: 'Folders you star appear here.',
    browse: { href: '/folders', label: 'Browse folders' },
  },
};

/**
 * Tab-aware empty state. Every state prompts an action (standards §8iv) — and
 * the copy is deliberately audience-neutral: guests hold real tokens and have
 * real bookmarks, so nothing here tells anyone to sign up for something they
 * are already doing.
 */
export function BookmarksEmptyState({
  tab,
  onShowAll,
}: {
  tab: BookmarkTab;
  /** Offered on a filtered tab only — the way back to the whole collection. */
  onShowAll?: () => void;
}) {
  const copy = EMPTY_COPY[tab];
  return (
    <PageState
      icon={copy.icon}
      title={copy.title}
      description={copy.description}
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          {copy.browse ? (
            <Button asChild variant="outline" size="sm">
              <Link href={copy.browse.href}>{copy.browse.label}</Link>
            </Button>
          ) : null}
          {onShowAll ? (
            <Button variant="ghost" size="sm" onClick={onShowAll}>
              View all bookmarks
            </Button>
          ) : null}
        </div>
      }
    />
  );
}

/**
 * Signed-out state — the query is gated off, so this replaces a 401 error.
 * MEASURED August 3, 2026: `GET /api/bookmarks` answers 401 with no bearer
 * token. Same contract as the cases and statutes lists.
 */
export function BookmarksSignedOutState() {
  return (
    <PageState
      icon={Bookmark}
      title="Sign in to see your bookmarks"
      description="Your saved cases, statutes, notes and folders travel with your account."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}

/**
 * Email-unverified state — the 403 both the read and the write return until the
 * address is confirmed. Shown ONLY when the server's message actually names
 * verification (review F4); any other 403 falls through to the error state.
 *
 * THE API'S OWN SENTENCE IS THE COPY. It already says the true thing ("Your
 * email address is not verified. Please verify your email to continue."), and
 * paraphrasing a server-authored reason is how a screen ends up explaining a
 * rule it does not own. The fallback is used only if the message is empty.
 *
 * THE CTA LABEL PROMISES WHAT IT ACTUALLY DOES (review F11b). It lands on v1's
 * `/check-email`, which OPENS claiming a link has just been sent — it has not;
 * sending is a button on that page. That page is v1 and outside this feature's
 * boundary, so the honest fix available here is to stop the label from making
 * the same promise: this offers to open the page, and the page offers the link.
 */
export function BookmarksVerifyEmailState({ message }: { message: string }) {
  return (
    <PageState
      icon={MailCheck}
      title="Verify your email to use bookmarks"
      description={
        message.trim() ||
        'Your email address is not verified. Please verify your email to continue.'
      }
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/check-email">Open the verification page</Link>
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
export function BookmarksErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load your bookmarks"
      description={
        message?.trim() ||
        'Something went wrong while loading your saved items. Please try again.'
      }
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}
