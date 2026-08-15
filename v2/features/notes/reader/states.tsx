'use client';

import Link from 'next/link';
import { Lock, NotebookPen, WifiOff, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The `/notes/[slug]` reader states — the three-state contract every v2 query
 * region owns (standards §8iv), plus the two this surface needs that the case
 * and statute readers do not:
 *
 *  - NOT AVAILABLE. A note can resolve with `content: null` — the payload the
 *    API returns for a PAID note the viewer has not bought. v2 hides paid
 *    notes entirely (owner decision 1: "note selling is not a thing yet"), so
 *    there is no price to show and no purchase to offer; the honest answer is
 *    that this note is not available here, plus the way back to the library.
 *    v1 showed a price card whose buy button was never implemented.
 *  - EMPTY. A note that exists and is readable but has no body yet — a draft
 *    the author started and left. That is not an error and not a paywall, so
 *    it says so quietly and (for the owner) offers the editor.
 */

/** The reading column every note surface shares — heading, document, states. */
export const NOTE_COLUMN = 'mx-auto w-full max-w-3xl px-4 pb-24 pt-5 sm:pt-8';

/**
 * The reader skeleton at the document's real geometry: breadcrumb, byline
 * kicker, title, action row, then a few paragraphs of body.
 *
 * It pulses everywhere it is drawn, the route fallback included (standards
 * §8i). A wait is a wait: the reader cannot tell an RSC payload from a query,
 * so two appearances for one wait would only print a seam into the middle of
 * the load.
 */
export function NoteDocumentSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      {/* Header silhouette: kicker · title · actions. The back-link bar that
          opened this went with the chip itself (phase 7) — the way back is in
          the shell's bar now, which is already painted while this shows. */}
      <div className="flex flex-col gap-3 border-b border-border/60 pb-6">
        <Skeleton className="h-3 w-40 rounded" />
        <Skeleton className="h-8 w-3/4 rounded-lg md:h-9" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      {/* Body silhouette — two short paragraphs at the reading measure, which
          is the MEDIAN note, not the longest one (standards §8iv). */}
      <div className="space-y-6">
        {[0, 1].map((block) => (
          <div key={block} className="space-y-2.5">
            {[100, 96, 99, 62].map((width, line) => (
              <Skeleton
                key={line}
                className="h-4 rounded"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

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

/** Read one HTTP status off a rejected axios call, or `0`. */
function statusOf(error: unknown): number {
  return (
    (error as { response?: { status?: number } } | null)?.response?.status ?? 0
  );
}

/**
 * True when the API has SETTLED the question of whether this reader may see
 * this note: 404 (no such note, or soft-deleted) and 403 (someone else's
 * draft, or a private note) are both facts, not failures. They land on the
 * not-found state, never on an error state whose "Try again" can never
 * succeed.
 *
 * 403 AND 404 GET THE SAME ANSWER on purpose. Telling a stranger that a note
 * exists but is not theirs to read leaks the existence of private drafts;
 * "not found" is both the safer and the truer thing to say to someone who
 * cannot have it.
 */
export function isNoteUnavailable(error: unknown): boolean {
  const status = statusOf(error);
  return status === 403 || status === 404;
}

export function NoteErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageState
      icon={WifiOff}
      title="Couldn't load this note"
      description="Something went wrong while loading the note. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

export function NoteNotFoundState() {
  return (
    <PageState
      icon={NotebookPen}
      title="Note not found"
      description="This note does not exist, it has been removed, or it isn't shared with you."
      action={
        <Button asChild size="sm" variant="outline">
          <Link href="/notes">Browse notes</Link>
        </Button>
      }
    />
  );
}

/** Signed out — the query is gated off, so this replaces a 401 screen. */
export function NoteSignedOutState() {
  return (
    <PageState
      icon={NotebookPen}
      title="Sign in to read this note"
      description="Notes shared with the community are available once you're signed in."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}

/**
 * The note resolved but its body did not — the paid-note payload (`content:
 * null`). No price, no purchase button, no "coming soon": v2 has no concept of
 * buying a note, so the state says what is true and points at what the reader
 * CAN read.
 */
export function NoteUnavailableState() {
  return (
    <PageState
      icon={Lock}
      title="This note is not available"
      description="The author has not made the full text of this note available to read here."
      action={
        <Button asChild size="sm" variant="outline">
          <Link href="/notes">Browse notes</Link>
        </Button>
      }
    />
  );
}

/**
 * A readable note with nothing written in it yet — shown INSIDE the document,
 * under the heading block, because the note itself loaded fine and its title,
 * byline and actions are all still true.
 */
export function NoteEmptyBodyState({ editHref }: { editHref: string | null }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border px-4 py-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
      >
        <NotebookPen className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Nothing written yet</p>
        <p className="max-w-md text-sm text-muted-foreground">
          {editHref
            ? 'This note is empty. Open it in the editor to start writing.'
            : 'This note is empty.'}
        </p>
      </div>
      {editHref ? (
        <Button asChild size="sm" variant="outline">
          <Link href={editHref}>Open the editor</Link>
        </Button>
      ) : null}
    </div>
  );
}
