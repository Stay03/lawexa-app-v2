'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { TabRow } from '@/v2/shell/TabRow';
import { SPACE_TAB_LABELS, spaceTabs, type SpaceTab } from '../model';

/**
 * SpaceTabs — Channels / Chats / Folders / Files on a space's page (Spaces F2,
 * 11 October 2026), on the shared `TabRow` so the strip keeps the one APG
 * tablist contract every v2 tab row keeps (roving tabindex, manual activation,
 * arrows, Home/End). No keyboard or aria logic lives here.
 *
 * The look is the `/spaces` list's own type filter (`SpaceTypeTabs`): a pill
 * row whose selected tab takes the page's ground. Same height, so the
 * silhouette's reserved bar (`SpaceTabsSkeleton`) is exactly this tall.
 *
 * The tab SET is the model's (`spaceTabs`): the contents for every member,
 * and Channels first only where the space shows its channels to this viewer.
 */
export function SpaceTabs({
  showsChannels,
  value,
  onChange,
  panelId,
}: {
  showsChannels: boolean;
  value: SpaceTab;
  onChange: (next: SpaceTab) => void;
  /** The host's single `role="tabpanel"` id; wires `aria-controls` back. */
  panelId: string;
}) {
  const tabs = spaceTabs(showsChannels).map((id) => ({
    id,
    label: SPACE_TAB_LABELS[id],
  }));

  return (
    <TabRow
      tabs={tabs}
      value={value}
      onChange={onChange}
      ariaLabel="What is in this space"
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

/**
 * The strip's reserved shape: the pill row at its live height (a 32px tab
 * inside 2px of padding), and about as wide as the tabs it stands for.
 */
export function SpaceTabsSkeleton({ showsChannels }: { showsChannels: boolean }) {
  return (
    <Skeleton
      aria-hidden
      className={cn('h-9 rounded-full', showsChannels ? 'w-72' : 'w-52')}
    />
  );
}
