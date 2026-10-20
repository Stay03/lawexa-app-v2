import { Bookmark, FileText, FolderPlus, MessageSquarePlus, Share2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ACTION_PILL } from '@/v2/shell/designs/modules';

/**
 * The case page's actions row as a still picture, for the frame a tap paints
 * (`CaseFallback.tsx`). The same pills, icons, words and wrapping as
 * `CaseActions`, so the row sits and wraps exactly where the page's will
 * (Stay, 20 October 2026: "The loading is jumpy").
 *
 * ITS OWN FILE ON PURPOSE: the real buttons bring the folder picker and the
 * feedback form with them, which a loading boundary must not ship. These are
 * spans inside an inert frame; nothing here takes a tap.
 */
export function CaseActionsShape({
  fullReport,
  isBookmarked,
  bookmarksCount,
}: {
  /** Whether the page will draw "Full judgment". */
  fullReport: boolean;
  isBookmarked: boolean;
  bookmarksCount: number | null;
}) {
  const reportPill = cn(ACTION_PILL, 'border-primary/40 text-foreground');
  return (
    <div className="flex flex-wrap items-center gap-2">
      {fullReport ? (
        <span className={reportPill}>
          <FileText aria-hidden className="size-4 text-primary" />
          Full judgment
        </span>
      ) : null}
      {/* `BookmarkButton`'s full variant. */}
      <span
        className={cn(
          'inline-flex min-h-9 items-center gap-2 rounded-full border border-border px-3 text-sm text-muted-foreground',
          isBookmarked && 'border-primary/40 bg-primary/5 text-primary',
        )}
      >
        <Bookmark aria-hidden className={cn('size-4', isBookmarked && 'fill-current')} />
        <span>{isBookmarked ? 'Saved' : 'Save'}</span>
        {typeof bookmarksCount === 'number' && bookmarksCount > 0 ? (
          <span className="tabular-nums text-xs text-muted-foreground/70">{bookmarksCount}</span>
        ) : null}
      </span>
      <span className={ACTION_PILL}>
        <FolderPlus aria-hidden className="size-4" />
        <span>Add to folder</span>
      </span>
      <span className={ACTION_PILL}>
        <Share2 aria-hidden className="size-4" />
        <span>Share</span>
      </span>
      <span className={ACTION_PILL}>
        <MessageSquarePlus aria-hidden className="size-4" />
        Feedback
      </span>
    </div>
  );
}
