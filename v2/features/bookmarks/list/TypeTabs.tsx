'use client';

import { cn } from '@/lib/utils';
import type { BookmarkType } from '@/types/bookmark';
import { TabRow } from '@/v2/shell/TabRow';

/**
 * The bookmarks type filter — All / Cases / Statutes / Notes / Folders, on the
 * shared `TabRow` primitive so this strip keeps the same APG tablist contract
 * (roving tabindex following FOCUS, manual activation, arrow/Home/End keys,
 * one focus ring) as every other v2 tab row. No keyboard or aria logic lives
 * here; the primitive owns all of it.
 *
 * STATUTES IS THE POINT. v1's tab set was All / Cases / Notes / Folders — no
 * Statutes tab at all, which is half of why a saved statute rendered as a
 * folder there. The four bookmarkable types are live-verified (anything else
 * answers 422), so this strip is provably complete.
 *
 * The active state is a background cross-fade on the tab itself, not a sliding
 * indicator pill — the reasoning the cases `ViewTabs` records: five labels of
 * five different widths make a translated pill land a few pixels off, while
 * colour is exact at any width.
 *
 * The strip SCROLLS horizontally on a narrow phone (`max-w-full overflow-x-auto`
 * on the tablist itself, the radar-strip mechanic) rather than wrapping to two
 * rows: a filter row that changes height when the viewport narrows moves the
 * list under the reader's thumb.
 */

/** The tab ids: the four content types plus the unfiltered view. */
export type BookmarkTab = 'all' | BookmarkType;

interface TypeTab {
  id: BookmarkTab;
  label: string;
}

const TYPE_TABS: readonly TypeTab[] = [
  { id: 'all', label: 'All' },
  { id: 'case', label: 'Cases' },
  { id: 'statute', label: 'Statutes' },
  { id: 'note', label: 'Notes' },
  { id: 'folder', label: 'Folders' },
];

/**
 * Read the tab out of `?type=`. Anything unrecognised — including the `file`
 * value the API answers 422 for — resolves to All, so a hand-edited URL shows
 * the whole collection instead of an error.
 */
export function parseBookmarkTab(raw: string | null): BookmarkTab {
  switch (raw) {
    case 'case':
    case 'statute':
    case 'note':
    case 'folder':
      return raw;
    default:
      return 'all';
  }
}

export function TypeTabs({
  value,
  onChange,
  panelId,
}: {
  value: BookmarkTab;
  onChange: (next: BookmarkTab) => void;
  /** The host's single `role="tabpanel"` id — wires `aria-controls` back. */
  panelId: string;
}) {
  return (
    <TabRow
      tabs={TYPE_TABS}
      value={value}
      onChange={onChange}
      ariaLabel="Filter bookmarks by type"
      panelId={panelId}
      className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-secondary/60 p-0.5"
      tabClassName={(selected) =>
        cn(
          'v2-interactive min-h-8 shrink-0 rounded-full px-3.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
          selected
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {(tab) => tab.label}
    </TabRow>
  );
}
