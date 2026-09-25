'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ACTION_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { BookmarkButton } from '@/v2/features/bookmarks/BookmarkButton';
import { AddToFolderButton } from '@/v2/features/folders/picker/AddToFolderButton';
import { ShareButton } from '@/v2/features/sharing/ShareButton';

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
      <ShareButton title={title} label="Share this case" />
      {hasFullReport ? (
        <Link href={`/cases/${slug}/report`} className={cn(ACTION_PILL, FOCUS_RING)}>
          <FileText aria-hidden className="size-4" />
          Full judgment
        </Link>
      ) : null}
    </div>
  );
}

