'use client';

import { cn } from '@/lib/utils';
import { TabRow } from '@/v2/shell/TabRow';

/**
 * The notes library's two streams — All notes | My notes — on the shared
 * `TabRow` primitive, so this strip keeps the same APG tablist contract
 * (roving tabindex following FOCUS, manual activation, arrow/Home/End keys,
 * one focus ring) as every other v2 tab row. No keyboard or aria logic lives
 * here; the primitive owns all of it.
 *
 * ── WHY THESE TWO AND NOT v1's FIVE ─────────────────────────────────────────
 * v1 had a `NotesNavTabs` row (Library | My Notes | Published | Purchases)
 * over a SECOND row of sub-tabs (Recently Added | Trending). Three of those
 * five are the marketplace, which v2 does not have; Trending is a separate
 * ranking endpoint nobody asked for on a personal-notes surface. What is left
 * is the only distinction a reader actually makes here: everyone's notes, or
 * mine.
 *
 * ── `?tab=mine` IS THE URL, AND `/notes/mine` REDIRECTS INTO IT ─────────────
 * The tab is the query string so that a view of the library is a shareable
 * link and the tab strip is static chrome that never waits on data. v1's
 * separate `/notes/mine` PAGE is claimed by the v2 manifest and redirects here
 * (`app/v2/notes/mine/page.tsx`), so an old bookmark lands on the right tab
 * rather than on a second implementation of the same list.
 *
 * The active state is a background cross-fade on the tab itself, not a sliding
 * indicator pill — the reasoning the cases `ViewTabs` records: labels of
 * different widths make a translated pill land a few pixels off, while colour
 * is exact at any width.
 */

export type NotesTab = 'all' | 'mine';

const NOTE_TABS: readonly { id: NotesTab; label: string }[] = [
  { id: 'all', label: 'All notes' },
  { id: 'mine', label: 'My notes' },
];

/**
 * Read the tab out of `?tab=`. Anything unrecognised — including v1's `recent`
 * and `trending` values, which old links still carry — resolves to All, so a
 * stale URL shows the library instead of an error.
 */
export function parseNotesTab(raw: string | null): NotesTab {
  return raw === 'mine' ? 'mine' : 'all';
}

export function NoteTabs({
  value,
  onChange,
  panelId,
}: {
  value: NotesTab;
  onChange: (next: NotesTab) => void;
  /** The host's single `role="tabpanel"` id — wires `aria-controls` back. */
  panelId: string;
}) {
  return (
    <TabRow
      tabs={NOTE_TABS}
      value={value}
      onChange={onChange}
      ariaLabel="Choose which notes to show"
      panelId={panelId}
      className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-full bg-secondary/60 p-0.5"
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
