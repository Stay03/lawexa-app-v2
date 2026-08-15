import Link from 'next/link';
import {
  FileLock2,
  FileQuestion,
  NotebookPen,
  PenLine,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * states — every non-editing answer the authoring routes can give, plus the
 * editor's loading silhouette.
 *
 * Hook-free and free of `'use client'` on purpose: `loading.tsx` is a server
 * component and renders {@link NoteEditorSkeleton} directly, so the route
 * fallback and the in-page pending state are the SAME shape rather than two
 * drawings of it.
 */

/**
 * The paper's measure. Matches `CASE_COLUMN` deliberately — a note and a case
 * are both documents, and reading one after writing the other should not change
 * line length. Wider bottom padding than a list column because the touch
 * formatting bar sits under the fold.
 */
export const NOTE_PAPER_COLUMN = 'mx-auto w-full max-w-3xl px-4 pb-24 pt-5 sm:pt-8';

const TONE_TILE = {
  neutral: 'bg-secondary text-muted-foreground',
  accent: 'bg-primary/10 text-primary',
  alert: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
} as const;

/**
 * The one full-surface panel every note-authoring state renders through.
 *
 * Same geometry as the quiz feature's `QuizMessage` — three visually distinct
 * tones, an icon that never carries the meaning alone, and a way forward on
 * every state that can offer one. Restated here rather than imported: the quiz
 * panel is a quiz-feature internal, and a cross-feature dependency between two
 * unrelated surfaces is a worse cost than forty lines of shared shape.
 */
function NoteMessage({
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
  tone?: keyof typeof TONE_TILE;
  action?: React.ReactNode;
  footnote?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <span
        aria-hidden
        className={cn(
          'flex size-12 items-center justify-center rounded-2xl',
          TONE_TILE[tone],
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
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

/** Signed out at an authoring URL — the door opens once you are in. */
export function NoteEditorSignedOutState() {
  return (
    <NoteMessage
      icon={PenLine}
      tone="accent"
      title="Sign in to write"
      description="Notes are yours: private drafts you can write, edit and keep. Sign in to start one."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}

/**
 * A GUEST at an authoring URL. Guest accounts are view-only pre-registration —
 * a standing product boundary, not a bug — so the honest answer is the door
 * that actually opens, not a silent bounce home.
 */
export function NoteEditorGuestState() {
  return (
    <NoteMessage
      icon={NotebookPen}
      tone="accent"
      title="Create a free account to write notes"
      description="Guest access is for reading. Create an account and your notes are saved as you type, on every device you sign in from."
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

/** Someone else's note at `/edit`. Reading it is still offered — that is the honest way on. */
export function NoteNotYoursState({ slug }: { slug: string }) {
  return (
    <NoteMessage
      icon={FileLock2}
      title="This note isn't yours to edit"
      description="Only the author can edit a note. You can still read it if it has been published."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href={`/notes/${slug}`}>Read the note</Link>
        </Button>
      }
    />
  );
}

/** Gone, private, or never existed — the three answers a reader cannot tell apart. */
export function NoteEditorNotFoundState() {
  return (
    <NoteMessage
      icon={FileQuestion}
      title="This note isn't available"
      description="It may have been deleted, or it belongs to someone else. Your own notes are on the My notes tab."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/notes?tab=mine">Go to my notes</Link>
        </Button>
      }
    />
  );
}

/** The note could not be loaded — distinct from "not available", with a real retry. */
export function NoteEditorErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <NoteMessage
      icon={WifiOff}
      tone="alert"
      title="Couldn't open this note"
      description="Something went wrong on our side. Your note is safe — try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/**
 * The editor's resting silhouette — a title line and the first few lines of a
 * body, in the paper's own measure.
 *
 * It pulses wherever it is drawn, `loading.tsx` included (standards §8i). A
 * wait is a wait: the reader cannot tell an RSC payload from a query, so two
 * appearances for one wait would only print a seam into the middle of the load.
 * These bars are plain divs rather than the `Skeleton` primitive, so the pulse
 * is spelled out on each of them.
 */
export function NoteEditorSkeleton() {
  return (
    // 24px between the title and the body — the same `mt-6` the real editor puts
    // between its title box and `EditorContent`, so the hand-off from fallback to
    // screen moves nothing.
    <div aria-hidden className="space-y-6">
      <div className="h-10 w-3/5 rounded-lg bg-secondary/60 motion-safe:animate-pulse sm:h-12" />
      <div className="space-y-3">
        {[
          'w-full',
          'w-11/12',
          'w-full',
          'w-4/5',
          'w-full',
          'w-2/3',
        ].map((width, index) => (
          <div
            key={index}
            style={{ opacity: Math.max(0.25, 1 - index * 0.13) }}
            className={cn('h-4 rounded bg-secondary/50 motion-safe:animate-pulse', width)}
          />
        ))}
      </div>
    </div>
  );
}
