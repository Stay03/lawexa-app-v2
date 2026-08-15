'use client';

import { cn } from '@/lib/utils';
import type { NoteRecord } from '../types';
import { formatNoteDate, noteDisplayTitle, noteHasTitle } from '../note-text';
import { NoteActions } from './NoteActions';
import { NoteContent } from './NoteContent';
import { NoteEmptyBodyState } from './states';
import './note-document.css';

/**
 * NoteDocument — the note as a calm document, in the case page's TWO-VOICE
 * grammar: caps-tracked sans for structure (the back link, the byline kicker),
 * the reading serif for everything the author actually wrote.
 *
 * ── THE HEADING BLOCK CARRIES IDENTITY ONLY, EACH FACT ONCE ─────────────────
 *
 *   kicker      author · updated {date} — provenance before the name, the
 *               same order the case and statute headers use
 *   title       the note's name, or "Untitled" in a quieter ink
 *   draft mark  ONLY on the author's own unpublished note, and it says what
 *               being a draft actually means rather than just labelling it
 *   actions     save · copy link · export · edit
 *
 * v1's `NoteDetailHeader` put a thumbnail, a tag row, a price and a status
 * chip above the title. Three of those four are marketplace furniture v2 does
 * not have, and the fourth (status) is meaningless to anyone but the author —
 * so it is shown to the author and to nobody else.
 *
 * ── WHY THE BYLINE IS THE KICKER AND NOT A FOOTER CARD ──────────────────────
 * v1 closed every note with a `NoteAuthorCard` — avatar, name, role badge,
 * member-since date — which is a profile, and there is no profile page to send
 * anyone to. Who wrote a note matters BEFORE you read it (it is how you weigh
 * it), so the name moves up into the provenance line and the card is dropped.
 */
export function NoteDocument({
  note,
  editHref,
}: {
  note: NoteRecord;
  /** `/notes/{slug}/edit` when the viewer owns this note, else `null`. The
   *  ownership comparison lives in `NoteScreen`, against the server-verified
   *  session id — this component only renders the answer. */
  editHref: string | null;
}) {
  const title = noteDisplayTitle(note.title);
  const hasTitle = noteHasTitle(note.title);
  const author = note.user?.name?.trim() || null;
  const updated = formatNoteDate(note.updated_at);
  // `content` is `null` for a note the viewer may not read — the reader screen
  // catches that before this renders — so here an absent body can only mean an
  // empty one.
  const body = note.content?.trim() ?? '';
  const isOwn = editHref !== null;
  const isOwnDraft = isOwn && note.status !== 'published';

  // THE WAY BACK LEFT THIS BLOCK (phase 7). It was an "← Notes" chip at y76
  // under a bar that already showed this note's name and the hamburger. The
  // shell's bar owns it now, and it still KEEPS THE TAB (review F9): `NoteScreen`
  // publishes `/notes?tab=mine` for a note the reader owns, because a draft
  // appears on no other stream. That override lives with the ownership test that
  // decides it, one level up, rather than being re-derived here.

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 border-b border-border/60 pb-6">
        {author || updated ? (
          <p className="doc-kicker flex flex-wrap items-center gap-x-2 gap-y-1">
            {author ? <span>{author}</span> : null}
            {author && updated ? (
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
            ) : null}
            {updated ? (
              <span className="tabular-nums">Updated {updated}</span>
            ) : null}
          </p>
        ) : null}

        <h1
          className={cn(
            'doc-title text-foreground',
            !hasTitle && 'doc-title-untitled',
          )}
        >
          {title}
        </h1>

        {/* The draft mark says the CONSEQUENCE, not just the status: a draft is
            private to its author, and that is the fact an author needs while
            deciding whether to share the link they are looking at. */}
        {isOwnDraft ? (
          <p>
            <span className="inline-flex min-h-6 items-center rounded-full bg-amber-500/15 px-2.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              Draft · only you can see this
            </span>
          </p>
        ) : null}

        <NoteActions
          noteId={note.id}
          slug={note.slug}
          isBookmarked={note.is_bookmarked}
          bookmarksCount={note.bookmarks_count}
          canExport={body.length > 0}
          editHref={editHref}
        />
      </header>

      {body ? (
        <NoteContent html={body} />
      ) : (
        <NoteEmptyBodyState editHref={editHref} />
      )}
    </article>
  );
}
