'use client';

import { useState } from 'react';

import { useShareUrl } from '@/v2/features/sharing/useShareUrl';
import Link from 'next/link';
import { Check, FileText, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { ACTION_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { BookmarkButton } from '@/v2/features/bookmarks/BookmarkButton';
import { AddToFolderButton } from '@/v2/features/folders/picker/AddToFolderButton';

/**
 * The case action row — save, share, and the full judgment when one exists.
 *
 * v1 put four buttons here (bookmark, share, feedback, add-to-folder) ABOVE the
 * case, so the first thing a reader met on a judgment was a toolbar. This row
 * sits UNDER the heading block, at the weight of metadata rather than of
 * controls: the case is the page, and the actions are things you do to it.
 *
 * ADD TO FOLDER landed with the phase-4 folders wave and sits beside the
 * bookmark, which is its nearest relative: both file the case somewhere the
 * reader can find it again. FEEDBACK is still absent — a whole v1 feature
 * behind the v2 import boundary — and stays a recorded gap rather than a button
 * that opens nothing.
 */
export function CaseActions({
  caseId,
  slug,
  title,
  isBookmarked,
  bookmarksCount,
  hasFullReport,
}: {
  caseId: number;
  slug: string;
  title: string;
  isBookmarked: boolean;
  bookmarksCount: number;
  hasFullReport: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <BookmarkButton
        caseId={caseId}
        isBookmarked={isBookmarked}
        count={bookmarksCount}
        variant="full"
      />
      <AddToFolderButton target={{ type: 'case', contentId: caseId }} />
      <ShareAction title={title} />
      {hasFullReport ? (
        <Link href={`/cases/${slug}/report`} className={cn(ACTION_PILL, FOCUS_RING)}>
          <FileText aria-hidden className="size-4" />
          Full judgment
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Share — the native sheet where the platform has one (every phone), a clipboard
 * copy everywhere else.
 *
 * The confirmation is IN THE BUTTON for two seconds, not only a toast: feedback
 * belongs next to the thing that caused it (craft checklist). A cancelled native
 * share throws `AbortError`, which is a user decision and not an error, so it is
 * swallowed silently rather than reported.
 */
function ShareAction({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  /* An ambassador sharing a case gets their code on the link, so a signup from
     it credits them. Everybody else gets the address exactly as before. Never
     blocks or delays the share: no code, or an answer that has not arrived yet,
     both mean share the plain link. */
  const shareUrl = useShareUrl();

  const share = async () => {
    const here = typeof window === 'undefined' ? '' : window.location.href;
    if (!here) return;
    const url = shareUrl(here);

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // The user dismissed the sheet — not a failure, and not worth a toast.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Anything else falls through to the clipboard path below.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={cn(ACTION_PILL, FOCUS_RING)}
      aria-label="Share this case"
    >
      {copied ? (
        <Check aria-hidden className="size-4 text-primary" />
      ) : (
        <Share2 aria-hidden className="size-4" />
      )}
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
