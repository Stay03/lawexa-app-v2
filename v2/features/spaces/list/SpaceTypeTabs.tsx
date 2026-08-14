'use client';

import { cn } from '@/lib/utils';
import { TabRow } from '@/v2/shell/TabRow';
import type { SpaceFilter } from '../model';

/**
 * SpaceTypeTabs — All / Work / Study, on the shared `TabRow` primitive so this
 * strip keeps the same APG tablist contract (roving tabindex following FOCUS,
 * manual activation, arrow/Home/End, one focus ring) as every other v2 tab
 * row. No keyboard or aria logic lives here — the primitive owns all of it.
 * v1 used its own `AnimatedTabs`; study A1 says rebuild on the shared
 * primitive, and this is that.
 *
 * The active state is a background cross-fade on the tab itself rather than a
 * sliding indicator pill: three labels of three different widths make a
 * translated pill land a few pixels off, while colour is exact at any width
 * (the cases `ViewTabs` reasoning). Phase-5 W4, 2026-08-04.
 */

const TABS: readonly { id: SpaceFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'work', label: 'Work' },
  { id: 'study', label: 'Study' },
];

export function SpaceTypeTabs({
  value,
  onChange,
  panelId,
}: {
  value: SpaceFilter;
  onChange: (next: SpaceFilter) => void;
  /** The host's single `role="tabpanel"` id — wires `aria-controls` back. */
  panelId: string;
}) {
  return (
    <TabRow
      tabs={TABS}
      value={value}
      onChange={onChange}
      ariaLabel="Filter spaces by type"
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
