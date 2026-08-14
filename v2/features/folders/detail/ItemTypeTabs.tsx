'use client';

import { cn } from '@/lib/utils';
import { TabRow } from '@/v2/shell/TabRow';
import {
  FOLDER_ITEM_TABS,
  type FolderItemTab,
} from './item-tabs';

/**
 * The folder page's type filter — All / Cases / Statutes / Notes / Files, on
 * the shared `TabRow` primitive so this strip keeps the same APG tablist
 * contract (roving tabindex following FOCUS, manual activation, arrow/Home/End
 * keys, one focus ring) as every other v2 tab row. No keyboard or aria logic
 * lives here; the primitive owns all of it.
 *
 * ── FIVE TABS, NOT v1's SIX ─────────────────────────────────────────────────
 * v1 offered All | Folders | Cases | Notes | Conversations | Files. Three of
 * those were wrong: "Folders" filtered the page CLIENT-side over a paginated
 * list (a fiction past page one), "Conversations" is the type v2 does not
 * render at all, and there was no Statutes tab even though statutes are
 * addable — so a folder full of statutes had no filter that could find them.
 * These five are server-filtered (`?type=`, measured) and the four content tabs
 * are exactly the four types v2 renders.
 *
 * SUBFOLDERS ARE NOT A TAB. They are the tree, not a content type, so they sit
 * above the items on the All view and step out of the way when a type is
 * chosen — the Drive model, and the reason there is nothing here to filter
 * client-side.
 */
export function ItemTypeTabs({
  value,
  onChange,
  panelId,
}: {
  value: FolderItemTab;
  onChange: (next: FolderItemTab) => void;
  /** The host's single `role="tabpanel"` id — wires `aria-controls` back. */
  panelId: string;
}) {
  return (
    <TabRow
      tabs={FOLDER_ITEM_TABS}
      value={value}
      onChange={onChange}
      ariaLabel="Filter this folder by type"
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
