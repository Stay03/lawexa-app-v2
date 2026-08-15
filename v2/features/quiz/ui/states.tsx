import Link from 'next/link';
import { GraduationCap, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { QuizMessage } from './QuizMessage';

/**
 * states.tsx — the quiz feature's SHARED loading shapes and the panels more than
 * one screen needs. Screen-specific states live beside their screen; anything
 * two surfaces both render lives here so the two cannot drift.
 *
 * The verify-email panel is the one exception: it needs `useRouter` for its
 * re-check affordance, so it lives in its own `'use client'` module
 * (`VerifyEmailState.tsx`) rather than pulling every skeleton in this file into
 * the client bundle behind it.
 *
 * Every skeleton here pulses, in each of its callers, the route fallback
 * included (standards §8i). A wait is a wait: the reader cannot tell an RSC
 * payload from a query, so giving each of those its own appearance would only
 * print a seam into the middle of the load.
 */

/* ── Session rows ───────────────────────────────────────────────────────── */

/**
 * One skeleton row, shaped exactly like `SessionRow` (dot + status / meta) —
 * including the meta line's TWO ZONES: the counts bar on the left and a short
 * bar right-anchored INSIDE the text block for the date, which is where the
 * resolved row puts it (the Resume/Review affordance is the separate bar
 * outside).
 */
function SessionRowSkeleton() {
  return (
    <div className="flex min-h-11 items-center gap-3 px-2 py-3">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-2 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-2/5 rounded" />
          <Skeleton className="ml-auto h-3 w-16 shrink-0 rounded" />
        </div>
      </div>
      <Skeleton className="h-3 w-12 shrink-0 rounded" />
    </div>
  );
}

/**
 * The session-list loading shape — progressive opacity down the stack, the one
 * loading language every v2 list surface speaks. `rows` defaults to a realistic
 * MEDIAN (standards §8iv: reserve near the middle, never at the page cap).
 */
export function SessionListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.16) }}>
          <SessionRowSkeleton />
        </div>
      ))}
    </div>
  );
}

/** The next-page skeleton shown at the infinite sentinel while a page loads. */
export function SessionNextPageSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <SessionRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <SessionRowSkeleton />
      </div>
    </div>
  );
}

/* ── Shared panels ──────────────────────────────────────────────────────── */

/** Load failure — visually distinct from empty, with a real in-place retry. */
export function QuizErrorState({
  title = "Couldn't load this",
  description = 'Something went wrong on our side. Please try again.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry: () => void;
}) {
  return (
    <QuizMessage
      icon={WifiOff}
      tone="alert"
      title={title}
      description={description}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/* ── The `/quiz` segment fallback ───────────────────────────────────────── */

/**
 * The `/quiz` SEGMENT boundary (`app/v2/quiz/loading.tsx`) — deliberately EMPTY.
 *
 * A segment's `loading.tsx` wraps its CHILD SLOT, so this one covers hub →
 * player, hub → history and hub → stats. Those three destinations do not share
 * a body shape (a question with four options, a row list, a card grid), and
 * `app/v2/loading.tsx` states the house rule for exactly that case: a
 * segment-level boundary whose children DON'T share a shape must be neutral,
 * and neutral means empty — the persistent shell already frames the wait, the
 * destination's own boundary takes over the moment its shell arrives, and any
 * silhouette here would be a lie about where the reader is going.
 *
 * Each child route carries its own precise, page-shaped `loading.tsx`; this is
 * only the quiet beat before one of them arrives.
 */
export function QuizSegmentFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading quiz
      </span>
      <div aria-hidden className="min-h-full" />
    </>
  );
}

/* ── Access panels ──────────────────────────────────────────────────────── */

/**
 * CREATE AN ACCOUNT — what a GUEST sees at any `/quiz/*` URL.
 *
 * Quiz is open to every registered account (owner decision, August 3 2026 —
 * this panel replaced the same-day "early access" one when the audience
 * widened). The only signed-in identity outside the audience is now a guest —
 * a view-only pre-registration account — so the honest answer is a
 * registration nudge, not a "not open yet" story that is no longer true.
 * v1 redirected these users home without a word; a silent bounce reads as a
 * broken link, so the panel says what quiz is and offers the two real doors.
 *
 * Honest about the boundary too: this is OUR gate. The backend does not block
 * guest tokens (verified live, 2026-08-03; the server-side block is a pending
 * backend ask), so the copy promises nothing about security — it describes a
 * product boundary, which is exactly what it is.
 */
export function QuizCreateAccountState() {
  return (
    <QuizMessage
      icon={GraduationCap}
      tone="accent"
      title="Create a free account to practise"
      description="Quiz turns your study conversations into multiple-choice practice and keeps your score history. It's part of the registered experience — create an account to play."
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
      footnote="Everything you can already browse stays free to browse."
    />
  );
}

/** Signed out — the queries are gated off, so this replaces a 401 screen. */
export function QuizSignedOutState() {
  return (
    <QuizMessage
      icon={GraduationCap}
      tone="accent"
      title="Sign in to practise"
      description="Quiz turns your study conversations into multiple-choice practice, and keeps your score history. Sign in to start a session."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}
