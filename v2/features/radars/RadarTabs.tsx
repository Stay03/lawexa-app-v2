'use client';

import { cn } from '@/lib/utils';
import { TabRow } from '@/v2/shell/TabRow';

/**
 * RadarTabs — the radar feature's tab strip (list status tabs + detail
 * workflow tabs): the shared `TabRow` primitive, which owns the full APG
 * tablist contract (roving tabindex, arrows/Home/End, manual activation,
 * aria wiring — see its docblock), dressed in the v2 pill grammar the cases
 * list established. This wrapper exists because BOTH radar strips share one
 * item shape (label + optional count, shown only when positive) and one set
 * of classes — the two call sites stay a one-liner each.
 *
 * The active state is a background cross-fade on the tab itself, not a sliding
 * indicator — same reasoning as the cases `ViewTabs` (labels of different
 * widths make a translated pill land off by pixels).
 *
 * `panelId` wires `aria-controls` to the host's single `role="tabpanel"`
 * region (one panel whose CONTENT changes per tab — the list surface below).
 */

export interface RadarTab<Id extends string> {
  id: Id;
  label: string;
  /** Optional count rendered after the label in the quiet numeral voice. */
  count?: number;
}

export function RadarTabs<Id extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  panelId,
}: {
  tabs: readonly RadarTab<Id>[];
  value: Id;
  onChange: (next: Id) => void;
  ariaLabel: string;
  panelId: string;
}) {
  return (
    <TabRow
      tabs={tabs}
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      panelId={panelId}
      className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-full bg-secondary/60 p-0.5"
      tabClassName={(selected) =>
        cn(
          'v2-interactive inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
          selected
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {(tab, selected) => (
        <>
          {tab.label}
          {tab.count !== undefined && tab.count > 0 ? (
            <span
              className={cn(
                'tabular-nums',
                selected
                  ? 'text-muted-foreground'
                  : 'text-muted-foreground/60',
              )}
            >
              {tab.count}
            </span>
          ) : null}
        </>
      )}
    </TabRow>
  );
}
