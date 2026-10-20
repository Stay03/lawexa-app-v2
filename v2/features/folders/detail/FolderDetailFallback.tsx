'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { FOLDER_HEADING_TYPE } from '../folder-bits';
import { useFolderPeek } from '../folder-peek';
import { FolderDetailSkeleton } from './states';

/**
 * The folder page's loading shape — its own skeleton, pulsing exactly as it
 * does on the live screen (standards §8i), in the shared column. A wait is a
 * wait: the reader cannot tell an RSC payload from a query, so one wait gets
 * one appearance. `FolderScreen` renders it as its Suspense fallback, and
 * `app/v2/folders/[uuid]/loading.tsx` and the `app/v2/folders` segment boundary
 * (which covers every list → folder click) render it too, so they can never
 * drift.
 *
 * ITS OWN FILE ON PURPOSE, for the reason `CaseFallback` gives: exported from
 * `FolderScreen.tsx`, this put the whole folder page (its queries, mutations
 * and dialogs) behind the folders LIST's loading screen. Nothing in this file
 * may import a screen.
 *
 * THE TAPPED ROW'S NAME, AT ONCE (speed step 5, 17 October 2026). When the
 * reader came from a folder row, the row left its name (`folder-peek.ts`),
 * drawn where the header puts it, at every width: the
 * name is the page's heading on a phone too since item 7 (17 October 2026),
 * so the wait shows it there and the bar stays empty, as on the live page.
 */
export function FolderDetailFallback() {
  const peek = useFolderPeek(uuidOf(usePathname()));
  return (
    <>
      <span role="status" className="sr-only">
        Loading this folder
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a Suspense fallback is
          DELETED, not reconciled, when content arrives — so anything focusable
          in here would lose focus and caret mid-interaction. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <FolderDetailSkeleton
          name={
            peek ? (
              <p
                className={cn(
                  'line-clamp-2 break-words',
                  FOLDER_HEADING_TYPE,
                  peek.hasName ? 'text-foreground' : 'italic text-muted-foreground',
                )}
              >
                {peek.name}
              </p>
            ) : undefined
          }
        />
      </div>
    </>
  );
}

/** The folder's uuid from `/folders/{uuid}`, or undefined on any other path. */
function uuidOf(pathname: string | null): string | undefined {
  const match = pathname?.match(/\/folders\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}
