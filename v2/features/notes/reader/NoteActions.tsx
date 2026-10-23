'use client';

import Link from 'next/link';
import { Download, Loader2, Pencil } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ACTION_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { AddToFolderButton } from '@/v2/features/folders/picker/AddToFolderButton';
import { FeedbackButton } from '@/v2/features/feedback/FeedbackButton';
import { NoteBookmarkButton } from '../bookmark/NoteBookmarkButton';
import { NOTE_EXPORT_FORMAT_KEYS, NOTE_EXPORT_FORMATS, useNoteExport } from '../use-note-export';
import { ShareButton } from '@/v2/features/sharing/ShareButton';

/**
 * The note action row — save, copy link, export, and Edit for the author.
 *
 * It sits UNDER the heading block, at the weight of metadata rather than of
 * controls: the note is the page, and the actions are things you do to it.
 * v1 put six buttons ABOVE the note (bookmark, feedback, add-to-folder,
 * export, and a dropdown), so the first thing a reader met was a toolbar.
 *
 * ADD TO FOLDER landed with the phase-4 folders wave and sits beside the
 * bookmark, its nearest relative — both file the note where the reader can find
 * it again.
 *
 * WHAT IS STILL NOT HERE, and why each is an absence rather than a stub:
 * FEEDBACK is a whole v1 feature behind the v2 import boundary; PUBLISH and
 * PRICE are the marketplace, carved out of v2 entirely; DELETE belongs with the
 * editor, where the confirmation and the redirect live. A button that opens
 * nothing is worse than an absent one.
 *
 * EDIT IS OWNERSHIP-GATED IN THE CALLER (`NoteDocument` compares the
 * server-verified `session.userId` against `note.user.id`) and this component
 * simply renders what it is given. Not a security boundary — the editor route
 * and the API both refuse a stranger's save — but a link that leads to a
 * refusal is a link that should not have been drawn.
 */
export function NoteActions({
  noteId,
  slug,
  title,
  isBookmarked,
  bookmarksCount,
  canExport,
  editHref,
  canAddToFolder,
}: {
  noteId: number;
  slug: string;
  /** Shown by the share sheet above the link. */
  title: string | null;
  isBookmarked: boolean;
  bookmarksCount: number;
  /** Off when there is no readable body — the server would render an empty
   *  document, and offering the download would promise one. */
  canExport: boolean;
  /** `/notes/{slug}/edit` for the author, `null` for everyone else. */
  editHref: string | null;
  /** Off for a Space's copy: the server files a copy only in its own Space's
   *  folders (422 "A note from another Space cannot be added here."), so the
   *  picker would offer folders that refuse it. */
  canAddToFolder: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NoteBookmarkButton
        noteId={noteId}
        isBookmarked={isBookmarked}
        count={bookmarksCount}
        variant="full"
      />
      {canAddToFolder ? <AddToFolderButton target={{ type: 'note', contentId: noteId }} /> : null}
      <ShareButton path={`/notes/${slug}`} title={title} label="Share this note" />
      {canExport ? <ExportMenu slug={slug} /> : null}
      {editHref ? (
        <Link href={editHref} className={cn(ACTION_PILL, FOCUS_RING)}>
          <Pencil aria-hidden className="size-4" />
          Edit
        </Link>
      ) : null}
      <FeedbackButton type="note" contentId={noteId} />
    </div>
  );
}

/**
 * Download the note as a Word document or a PDF, from one Export menu. The
 * download itself is `useNoteExport`, shared with the notes list's row menu.
 */
export function ExportMenu({ slug }: { slug: string }) {
  const { download, exporting } = useNoteExport(slug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          // `aria-disabled`, not `disabled`: a real `disabled` would yank focus to
          // `<body>` the instant the press lands. The guard in the handler is what
          // actually stops a second request.
          aria-disabled={exporting}
          className={cn(ACTION_PILL, FOCUS_RING)}
        >
          {exporting ? (
            <Loader2
              aria-hidden
              className="size-4 motion-safe:animate-spin motion-reduce:opacity-60"
            />
          ) : (
            <Download aria-hidden className="size-4" />
          )}
          <span aria-live="polite">{exporting ? 'Exporting…' : 'Export'}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {NOTE_EXPORT_FORMAT_KEYS.map((format) => {
          const { label, icon: Icon } = NOTE_EXPORT_FORMATS[format];
          return (
            <DropdownMenuItem key={format} disabled={exporting} onSelect={() => void download(format)}>
              <Icon aria-hidden className="size-4" />
              {label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
