'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Download, Link2, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { ACTION_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { AddToFolderButton } from '@/v2/features/folders/picker/AddToFolderButton';
import { notesApi } from '../api';
import { NoteBookmarkButton } from '../bookmark/NoteBookmarkButton';
import { useShareUrl } from '@/v2/features/sharing/useShareUrl';

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
  isBookmarked,
  bookmarksCount,
  canExport,
  editHref,
}: {
  noteId: number;
  slug: string;
  isBookmarked: boolean;
  bookmarksCount: number;
  /** Off when there is no readable body — the server would render an empty
   *  document, and offering the download would promise one. */
  canExport: boolean;
  /** `/notes/{slug}/edit` for the author, `null` for everyone else. */
  editHref: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NoteBookmarkButton
        noteId={noteId}
        isBookmarked={isBookmarked}
        count={bookmarksCount}
        variant="full"
      />
      <AddToFolderButton target={{ type: 'note', contentId: noteId }} />
      <CopyLinkButton slug={slug} />
      {canExport ? <ExportDocxButton slug={slug} /> : null}
      {editHref ? (
        <Link href={editHref} className={cn(ACTION_PILL, FOCUS_RING)}>
          <Pencil aria-hidden className="size-4" />
          Edit
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Copy the note's clean canonical URL. The confirmation lives IN the control
 * (icon flips to a check for two seconds) — the house copy-action rule — and
 * the label swap is a POLITE live region, so a screen reader hears "Link
 * copied" without being interrupted. The reset timer is RE-ARMED on each click
 * (never stacked, so a rapid second copy still gets its full two seconds) and
 * cleared on unmount. Clipboard denial fails silent: the address bar still has
 * the link.
 */
function CopyLinkButton({ slug }: { slug: string }) {
  /* An ambassador's code rides the link they copy, so a signup from it credits
     them. Everybody else copies exactly what they copied before. */
  const shareUrl = useShareUrl();

  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        shareUrl(`${window.location.origin}/notes/${slug}`),
      );
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setCopied(false);
      }, 2000);
    } catch {
      // No clipboard permission — nothing to report.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={cn(ACTION_PILL, FOCUS_RING)}
    >
      {copied ? (
        <Check aria-hidden className="size-4 text-primary" />
      ) : (
        <Link2 aria-hidden className="size-4" />
      )}
      <span aria-live="polite">{copied ? 'Link copied' : 'Copy link'}</span>
    </button>
  );
}

/**
 * Download the note as DOCX.
 *
 * THE ROUTE IS GONE, THE BUTTON REMAINS. v1 had a whole PAGE at
 * `/notes/{slug}/export-docx` whose only job was to fire this request on mount
 * and bounce back — a navigation, a render and a history entry to perform a
 * download. v2 does it in place; the old path stays carved out of the v2
 * manifest so any link to it still resolves against v1.
 *
 * THE OBJECT URL IS REVOKED ON THE NEXT TASK, not immediately after `click()`.
 * The click is dispatched synchronously but the browser's download starts
 * asynchronously, and revoking in the same task cancels it in Firefox — the
 * defect v1's version carries. The timer is cleared on unmount so a reader who
 * navigates mid-export leaves nothing behind.
 *
 * ERRORS ARE NAMED WHERE THE SERVER NAMED THEM: a 403 is "you can't export
 * this one", which is a different sentence from "the download failed", and a
 * reader who sees the generic one will try again forever.
 */
function ExportDocxButton({ slug }: { slug: string }) {
  const [exporting, setExporting] = useState(false);
  const revokeRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (revokeRef.current !== null) window.clearTimeout(revokeRef.current);
    },
    [],
  );

  const download = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await notesApi.exportDocx(slug);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${slug}.docx`;
      anchor.rel = 'noreferrer noopener';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      if (revokeRef.current !== null) window.clearTimeout(revokeRef.current);
      revokeRef.current = window.setTimeout(() => {
        revokeRef.current = null;
        URL.revokeObjectURL(url);
      }, 0);
    } catch (error) {
      const status = (error as { response?: { status?: number } } | null)?.response
        ?.status;
      toast.error(
        status === 403
          ? "You don't have access to export this note."
          : "Couldn't export this note. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void download()}
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
  );
}
