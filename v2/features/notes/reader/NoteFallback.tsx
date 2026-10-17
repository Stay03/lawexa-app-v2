'use client';

import { usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useNotePeek, type NotePeek } from '../note-peek';
import { NOTE_COLUMN, NoteDocumentSkeleton } from './states';
import './note-masthead.css';

/**
 * The note reader's loading shape — what `app/v2/notes/[slug]/loading.tsx` and
 * the `app/v2/notes` segment boundary render, so boundary → live document is
 * one continuous shape and nothing moves at the hand-off.
 *
 * ITS OWN FILE ON PURPOSE, for the reason `CaseFallback` gives: exported from
 * `NoteScreen.tsx`, this put the whole note reader behind the notes LIST's
 * loading screen. Nothing in this file may import a screen.
 *
 * THE TAPPED ROW'S NAME, AT ONCE (speed step 5, 17 October 2026). When the
 * reader came from a note row, the row left the note's name and author
 * (`note-peek.ts`), and the masthead draws them in its own type and place
 * while the rest stays skeleton.
 */
export function NoteFallback() {
  const peek = useNotePeek(slugOf(usePathname()));
  return (
    <>
      <span role="status" className="sr-only">
        Loading note
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a route fallback is
          DELETED, not reconciled, when content arrives, so anything focusable
          in here would lose focus mid-interaction. */}
      <div aria-hidden inert className={cn(peek && 'v2-note-doc', NOTE_COLUMN)}>
        <NoteDocumentSkeleton masthead={peek ? <PeekMasthead peek={peek} /> : undefined} />
      </div>
    </>
  );
}

/** The note's slug from `/notes/{slug}`, or undefined on any other path (the
 *  editor's `/notes/{slug}/edit` included). */
function slugOf(pathname: string | null): string | undefined {
  const match = pathname?.match(/\/notes\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** The kicker and the name as `NoteDocument`'s header sets them. "Updated"
 *  joins the end of the kicker when the note arrives; with no author the
 *  kicker keeps its bar, so the name does not move when the date lands. */
function PeekMasthead({ peek }: { peek: NotePeek }) {
  return (
    <>
      {peek.author ? (
        <p className="doc-kicker flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{peek.author}</span>
        </p>
      ) : (
        <Skeleton className="h-3 w-40 rounded" />
      )}
      <h1 className={cn('doc-title text-foreground', !peek.hasTitle && 'doc-title-untitled')}>
        {peek.title}
      </h1>
    </>
  );
}
