'use client';

import Link from 'next/link';
import { NotebookPen, Search, WifiOff, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { NotesTab } from './NoteTabs';

/**
 * The `/notes` library states — the three-state contract every v2 query region
 * owns (standards §8iv), plus the two this surface needs:
 *
 *  - SIGNED OUT. `GET /api/notes` answers **401 with no bearer token**
 *    (measured against production, August 4 2026 — unlike `GET /api/cases`,
 *    which is public). The query is gated on the session and a visitor with no
 *    session gets a designed sign-in state, not a network error.
 *  - CREATE AN ACCOUNT. A guest holds a real token and reads the library
 *    normally, but guests do not WRITE — a guest account is view-only
 *    pre-registration (standing owner principle, restated as decision 7 of
 *    this wave). So "My notes" is an authoring surface a guest can never have
 *    anything in, and the honest answer is a registration nudge rather than an
 *    empty list. The `QuizCreateAccountState` pattern, in the notes voice.
 *
 * Rebuilt v2-native rather than reusing v1's `NoteEmptyState` / `EmptyState`:
 * those live in `components/`, which the v2 import boundary blocks.
 */

function PageState({
  icon: Icon,
  title,
  description,
  tone = 'neutral',
  action,
  footnote,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** `accent` is an invitation the reader is meant to act on. */
  tone?: 'neutral' | 'accent';
  action?: React.ReactNode;
  footnote?: string;
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
      {footnote ? (
        <p className="max-w-sm text-xs text-muted-foreground/80">{footnote}</p>
      ) : null}
    </div>
  );
}

/**
 * One skeleton row, mirroring `NoteRow`'s geometry EXACTLY — the same nesting
 * (`gap-2` between the identity block and the star, `gap-3 px-2 py-3` inside
 * it), so the tile, the text column and the star land on the pixels the
 * resolved row will use and nothing reflows on hand-off.
 *
 * THREE TEXT LINES, which is the note row's MEDIAN and its maximum at once:
 * every note row is title + meta + a two-line preview clamp, so unlike the
 * bookmarks list there is no tall-vs-short trade to make here.
 *
 * The meta line mirrors the row's TWO ZONES: a lead bar on the left and a
 * short, right-anchored bar for the "updated N ago" trail.
 */
function NoteRowSkeleton({ still = false }: { still?: boolean }) {
  // Threaded explicitly rather than switched off by a `[&_*]` descendant
  // variant: an arbitrary variant that fails to generate fails SILENTLY.
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 items-start gap-3 px-2 py-3">
        <Skeleton className={cn('mt-0.5 size-9 shrink-0 rounded-lg', bar)} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className={cn('h-4 w-3/5 rounded', bar)} />
          <div className="flex items-center gap-2">
            <Skeleton className={cn('h-3 w-2/5 rounded', bar)} />
            <Skeleton className={cn('ml-auto h-3 w-20 shrink-0 rounded', bar)} />
          </div>
          <Skeleton className={cn('h-3.5 w-full rounded', bar)} />
        </div>
      </div>
      {/* `mt-3.5` matches the row's star exactly — see `NoteRow` for the
          arithmetic (review F6). */}
      <Skeleton className={cn('mt-3.5 size-9 shrink-0 rounded-full', bar)} />
    </div>
  );
}

/**
 * The initial-load skeleton — rows with progressive opacity down the stack,
 * the shared v2 list fade, so a reader moving between the library surfaces and
 * this one sees ONE loading language.
 *
 * `still` drops the pulse for a route fallback, where nothing is in flight
 * behind the shape (standards §8i: a pulse promises a request).
 */
export function NotesListSkeleton({
  rows = 5,
  still = false,
}: {
  rows?: number;
  still?: boolean;
}) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.16) }}>
          <NoteRowSkeleton still={still} />
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
      <NoteRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <NoteRowSkeleton />
      </div>
    </div>
  );
}

/**
 * Empty — tab-aware, and search-aware within each tab, because "no results for
 * mareva" and "you haven't written anything yet" are different facts that want
 * different ways forward.
 */
export function NotesEmptyState({
  tab,
  search,
  canWrite,
  onClearSearch,
}: {
  tab: NotesTab;
  /** The active search, or `''`. */
  search: string;
  /** Whether this viewer may author a note (signed in, not a guest). */
  canWrite: boolean;
  onClearSearch: () => void;
}) {
  if (search) {
    return (
      <PageState
        icon={Search}
        title="No notes match that search"
        description={
          tab === 'mine'
            ? `None of your notes mention “${search}”.`
            : `No shared note mentions “${search}”.`
        }
        action={
          <Button variant="outline" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        }
      />
    );
  }

  if (tab === 'mine') {
    return (
      <PageState
        icon={NotebookPen}
        tone="accent"
        title="You haven't written a note yet"
        // NO SHARING PROMISE (review F5). This used to end "…until you say
        // otherwise", which describes a publish control v2 does not ship —
        // notes are born drafts and this wave has no publish flow (plan §2
        // decision 8). Copy may not advertise a button that does not exist.
        description="Notes are your own space — case summaries, exam prep, anything you want to keep. They are private to you."
        action={
          canWrite ? (
            <Button asChild size="sm">
              <Link href="/notes/create">Write your first note</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <PageState
      icon={NotebookPen}
      title="No shared notes yet"
      // Same rule as the My-notes empty copy above (review F5): it says where
      // shared notes appear, and stops — v2 has no control that would let the
      // reader move one of their own into this list.
      description="Notes people choose to share appear here. Your own notes live in My notes."
      action={
        canWrite ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/notes/create">Write a note</Link>
          </Button>
        ) : undefined
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
export function NotesErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load notes"
      description={
        message?.trim() ||
        'Something went wrong while loading notes. Please try again.'
      }
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** Signed out — the queries are gated off, so this replaces a 401 screen. */
export function NotesSignedOutState() {
  return (
    <PageState
      icon={NotebookPen}
      title="Sign in to read notes"
      description="Notes shared by the Lawexa community — and your own — are available once you're signed in."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}

/**
 * CREATE AN ACCOUNT — what a GUEST sees on the My notes tab.
 *
 * A guest account is view-only pre-registration: guests read the library, hold
 * real bookmarks, and cannot write. So this tab can never hold anything for
 * them, and an empty list would read as "you have no notes" when the truth is
 * "this isn't yours yet". The quiz feature's `QuizCreateAccountState` pattern
 * — panel, two real doors, and a footnote that keeps the promise small — in
 * the notes voice.
 *
 * Honest about the boundary: this is a PRODUCT rule, not a claim about
 * security. The copy therefore describes what an account gets you rather than
 * what a guest is blocked from.
 */
export function NotesCreateAccountState() {
  return (
    <PageState
      icon={NotebookPen}
      tone="accent"
      title="Create a free account to write notes"
      description="Notes are your own space for case summaries, exam prep and anything else worth keeping — and they travel with your account across devices."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild size="sm">
            <Link href="/register">Create free account</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      }
      footnote="Everything you can already read stays free to read."
    />
  );
}
