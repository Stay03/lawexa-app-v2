'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import type { NoteRecord } from '../types';
import { noteSpace } from '../note-copy';
import { noteOwnerMark } from '../note-privacy';
import { noteTags } from '../note-row-model';
import { formatNoteDate, noteDisplayTitle, noteHasTitle } from '../note-text';
import { NoteTagList } from '../note-tag-list';
import { notesQueries } from '../queries';
import { NoteActions } from './NoteActions';
import { NoteContent } from './NoteContent';
import { NoteEmptyBodyState } from './states';
import './note-masthead.css';
import './note-document.css';

// The history dialog brings the note editor's schema to compare versions: it
// loads on the first open, not with the page.
const DraftHistoryDialog = dynamic(
  () => import('@/v2/features/conversations/conversation/draft/DraftHistoryDialog').then((m) => m.DraftHistoryDialog),
  { ssr: false },
);

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
 *   owner mark  ONLY on the author's own note that only they can open: a draft,
 *               or a published private note (`note-privacy.ts`); it says what
 *               that means rather than just labelling the status
 *   actions     save · copy link · export · edit · version history
 *
 * v1's `NoteDetailHeader` put a thumbnail, a tag row, a price and a status
 * chip above the title. The thumbnail and the price are marketplace furniture
 * v2 does not have. Status is meaningless to anyone but the author, so it is
 * shown to the author and to nobody else.
 *
 * ── THE TAGS CLOSE THE NOTE ─────────────────────────────────────────────────
 * Every tag as a small grey pill, the computer list row's look, at the end of
 * the note under a hairline (Stay, 25 October 2026: "put the tags at the
 * bottom of the view page"), not v1's coloured pills above the title. A phone
 * row shows no tags, so this is where a phone reader sees them.
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
  history = false,
}: {
  note: NoteRecord;
  /** `/notes/{slug}/edit` when the viewer owns this note, else `null`. The
   *  ownership comparison lives in `NoteScreen`, against the server-verified
   *  session id — this component only renders the answer. */
  editHref: string | null;
  /** The viewer wrote this note and may edit it (`offersNoteHistory`), so the
   *  page offers its version history. */
  history?: boolean;
}) {
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const title = noteDisplayTitle(note.title);
  const hasTitle = noteHasTitle(note.title);
  const author = note.user?.name?.trim() || null;
  const updated = formatNoteDate(note.updated_at);
  const tags = noteTags(note.tags);
  // `content` is `null` for a note the viewer may not read — the reader screen
  // catches that before this renders — so here an absent body can only mean an
  // empty one.
  const body = note.content?.trim() ?? '';
  const isOwn = editHref !== null;
  const ownerMark = noteOwnerMark(note, isOwn);
  // A Space's copy reads as a plain note (Stay, 19 October 2026: "No need
  // for all that", like a copied file in a file explorer): no Space label,
  // no link to the original. It only offers no "Add to folder", since the
  // server files a copy in its own Space's folders alone.
  const isSpaceCopy = noteSpace(note) !== null;

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

        {/* The owner mark says the CONSEQUENCE, not just the status: only the
            author can open this note, and that is the fact an author needs
            while deciding whether to share the link they are looking at. */}
        {ownerMark ? (
          <p>
            <span className="inline-flex min-h-6 items-center rounded-full bg-amber-500/15 px-2.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              {ownerMark}
            </span>
          </p>
        ) : null}

        <NoteActions
          noteId={note.id}
          slug={note.slug}
          title={note.title}
          isBookmarked={note.is_bookmarked}
          bookmarksCount={note.bookmarks_count}
          canExport={body.length > 0}
          editHref={editHref}
          canAddToFolder={!isSpaceCopy}
          onHistory={
            history
              ? () => {
                  setHistoryLoaded(true);
                  setHistoryOpen(true);
                }
              : null
          }
        />
      </header>

      {body ? (
        <NoteContent html={body} />
      ) : (
        <NoteEmptyBodyState editHref={editHref} />
      )}

      {history && historyLoaded ? (
        <DraftHistoryDialog
          of="note"
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          noteId={note.id}
          canRestore
          current={() => note.content ?? ''}
          // A restore saves a new text: the page reads the note again.
          onRestored={() => void queryClient.invalidateQueries({ queryKey: notesQueries.details() })}
        />
      ) : null}

      {/* Every tag as a grey pill, wrapping on a narrow screen. Not links,
          since the notes list has no tag filter to link to. */}
      {tags.length > 0 ? (
        <footer className="border-t border-border/60 pt-6">
          <NoteTagList tags={tags} wrap />
        </footer>
      ) : null}
    </article>
  );
}
