'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, FileText, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { BookmarkButton } from '@/v2/features/bookmarks/BookmarkButton';

/** One shape for every action, so the row reads as a set rather than a jumble. */
const ACTION =
  'v2-interactive inline-flex min-h-9 items-center gap-2 rounded-full border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground';

/**
 * The case action row — save, share, and the full judgment when one exists.
 *
 * v1 put four buttons here (bookmark, share, feedback, add-to-folder) ABOVE the
 * case, so the first thing a reader met on a judgment was a toolbar. This row
 * sits UNDER the heading block, at the weight of metadata rather than of
 * controls: the case is the page, and the actions are things you do to it.
 *
 * Feedback and add-to-folder are NOT here. Both are whole v1 features behind the
 * v2 import boundary (folders in particular is its own phase-4 workstream), and
 * a button that opens nothing is worse than an absent one. Recorded as a gap
 * rather than stubbed.
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
      <ShareAction title={title} />
      {hasFullReport ? (
        <Link href={`/cases/${slug}/report`} className={cn(ACTION, FOCUS_RING)}>
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

  const share = async () => {
    const url = typeof window === 'undefined' ? '' : window.location.href;
    if (!url) return;

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
      className={cn(ACTION, FOCUS_RING)}
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
