'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import { TabRow } from '@/v2/shell/TabRow';
import { NOTIFICATION_FILTERS, type NotificationFilter } from './filter';

/**
 * The inbox filter — All / Unread on the shared `TabRow` primitive, so this
 * strip keeps the APG tablist contract (roving tabindex following focus,
 * manual activation, arrow/Home/End keys, one focus ring) without a line of
 * keyboard logic here. The classes are the bookmarks `TypeTabs` call site's,
 * verbatim, so the two lists' filters are one control.
 *
 * Unread carries the live unread count, the same number as the bell's badge.
 */
export function FilterTabs({
  value,
  onChange,
  unreadCount,
  panelId,
}: {
  value: NotificationFilter;
  onChange: (next: NotificationFilter) => void;
  unreadCount: number;
  /** The host's single `role="tabpanel"` id — wires `aria-controls` back. */
  panelId: string;
}) {
  return (
    <TabRow
      tabs={NOTIFICATION_FILTERS}
      value={value}
      onChange={onChange}
      ariaLabel="Filter notifications"
      panelId={panelId}
      className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-full bg-secondary/60 p-0.5"
      tabClassName={(selected) =>
        cn(
          'v2-interactive inline-flex min-h-8 shrink-0 items-center rounded-full px-3.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
          selected
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {(tab) =>
        tab.id === 'unread' ? (
          <>
            {tab.label}
            <UnreadCount count={unreadCount} />
          </>
        ) : (
          tab.label
        )
      }
    </TabRow>
  );
}

/**
 * The count on the Unread tab — the house `CountBadge` look, but a PERSISTENT
 * node: `CountBadge` unmounts at zero, and on this strip that would snap the
 * tab narrower the moment the last row is read. Here the pill folds its width
 * and fades in both directions, and holds the last number it showed through
 * the fold so it never reads "0" on the way out (the `NewRowsPill` idiom:
 * state adjusted during render in React's guarded form).
 *
 * The number is drawn for the eye and said for the ear: the visual pill is
 * `aria-hidden`, and the tab's accessible name gets ", N unread".
 */
function UnreadCount({ count }: { count: number }) {
  const visible = count > 0;
  const [shown, setShown] = useState(count);
  if (visible && count !== shown) setShown(count);
  const display = shown > 99 ? '99+' : String(shown);

  return (
    <>
      <span
        aria-hidden
        className={cn(
          'inline-flex h-5 items-center justify-center overflow-hidden rounded-full bg-primary text-[11px] font-semibold tabular-nums text-primary-foreground transition-[max-width,opacity,margin,padding] duration-200 ease-out motion-reduce:transition-none',
          visible ? 'ml-1.5 max-w-10 min-w-5 px-1.5 opacity-100' : 'ml-0 max-w-0 min-w-0 px-0 opacity-0',
        )}
      >
        {display}
      </span>
      {visible ? <span className="sr-only">, {count} unread</span> : null}
    </>
  );
}
