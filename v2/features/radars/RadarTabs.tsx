'use client';

import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * RadarTabs — the radar feature's tab strip (list status tabs + detail
 * workflow tabs), in the v2 pill grammar the cases list established, with the
 * FULL APG tabs keyboard contract the study asked for ("real tablist"):
 *
 *  - roving tabindex that follows FOCUS, not selection (the APG contract):
 *    arrow to an unselected tab, Tab away, Shift+Tab back — focus returns to
 *    the tab you LEFT, not the selected one. Exactly one tab is ever in the
 *    Tab order: the last-focused tab, falling back to the selected one;
 *  - Left/Right arrows move focus between tabs (wrapping), Home/End jump;
 *  - MANUAL activation (W3C APG recommendation when panels fetch on select):
 *    arrows move focus only; Enter/Space — the button's native activation —
 *    selects. Switching a radar tab starts a server-filtered query, which is
 *    exactly the "panels not instantly displayable" case the APG names.
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
  const refs = useRef(new Map<Id, HTMLButtonElement>());
  // The roving-tabindex position — where FOCUS last was, which may differ
  // from the selection under manual activation. Updated by each tab's own
  // focus event, so click, arrow keys, and programmatic focus all agree.
  const [focusedId, setFocusedId] = useState<Id | null>(null);
  const rovingId = focusedId ?? value;

  const focusTab = (index: number) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    refs.current.get(tab.id)?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusTab(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusTab(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(0);
        break;
      case 'End':
        event.preventDefault();
        focusTab(tabs.length - 1);
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-secondary/60 p-0.5"
    >
      {tabs.map((tab, index) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) refs.current.set(tab.id, node);
              else refs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`${panelId}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={rovingId === tab.id ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onFocus={() => setFocusedId(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'v2-interactive inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              FOCUS_RING,
            )}
          >
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
          </button>
        );
      })}
    </div>
  );
}
