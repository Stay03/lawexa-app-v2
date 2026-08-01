'use client';

import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * TabRow — the ONE tablist primitive behind every v2 tab strip: the radar
 * status/workflow tabs, the cases Library|Trending switch, the case report's
 * law-type filter, the statute library's country filter. Announcing
 * `role="tablist"` is a promise of a keyboard model, and this is the single
 * place that promise is kept — no keyboard or aria tablist logic may live
 * anywhere else. (The home's Chat|Work|Study switcher is a radiogroup, not a
 * tablist, and deliberately not this.)
 *
 * THE PRIMITIVE OWNS the full APG tabs contract:
 *
 *  - roving tabindex that follows FOCUS, not selection (the APG contract):
 *    arrow to an unselected tab, Tab away, Shift+Tab back — focus returns to
 *    the tab you LEFT, not the selected one. Exactly one tab is ever in the
 *    Tab order: the last-focused tab, falling back to the selected one;
 *  - Left/Right arrows move focus between tabs (wrapping), Home/End jump.
 *    Focusing an off-screen tab scrolls it into view natively, so rows in a
 *    horizontal scroller stay fully arrow-reachable;
 *  - MANUAL activation (the W3C APG recommendation when panels are not
 *    instantly displayable): arrows move focus only; Enter/Space — the
 *    button's native activation — or a click selects. Every adopter's panel
 *    is a server-filtered query or a refiltered list, exactly the "panels
 *    not instantly displayable" case the APG names, so automatic activation
 *    would fire a fetch per arrow press;
 *  - aria wiring: `aria-label` on the list and `aria-selected` per tab,
 *    always; when the host renders a single `role="tabpanel"` region (one
 *    panel whose CONTENT changes per tab), `panelId` adds per-tab ids
 *    (`{panelId}-tab-{id}`) for the panel's `aria-labelledby` and wires
 *    `aria-controls` back. Without `panelId`, no ids are minted;
 *  - the focus ring convention: `FOCUS_RING` is appended after the call
 *    site's tab classes, so every strip focuses identically.
 *
 * THE CALL SITE OWNS every visual class. `className` is the container's full
 * class list — including any horizontal-scroll affordance, which cannot be
 * baked in here: the radar strip scrolls the tablist itself (`max-w-full
 * overflow-x-auto`), while the statute country row scrolls an edge-bleed
 * wrapper OUTSIDE the tablist, and an unconditional inner scroller would
 * defeat that bleed and clip focus rings on rows that never overflow.
 * `tabClassName(selected)` styles each tab button, and the children render
 * function fills it (label, flag, count — whatever the surface's grammar
 * says). Selection state stays with the host, which is how the URL keeps
 * being the state on the surfaces that put it there.
 */

export function TabRow<Item extends { id: string }>({
  tabs,
  value,
  onChange,
  ariaLabel,
  panelId,
  className,
  tabClassName,
  children,
}: {
  tabs: readonly Item[];
  /** The selected tab id. Selection lives with the host, often in the URL. */
  value: Item['id'];
  onChange: (next: Item['id']) => void;
  ariaLabel: string;
  /** The host's single `role="tabpanel"` id — mints per-tab ids + `aria-controls`. */
  panelId?: string;
  /** The tablist container's FULL class list — the primitive adds nothing. */
  className: string;
  /** The FULL per-tab class list; the primitive appends only `FOCUS_RING`. */
  tabClassName: (selected: boolean) => string;
  /** Renders a tab's content inside the button the primitive provides. */
  children: (tab: Item, selected: boolean) => React.ReactNode;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  // The roving-tabindex position — where FOCUS last was, which may differ
  // from the selection under manual activation. Updated by each tab's own
  // focus event, so click, arrow keys, and programmatic focus all agree.
  // A remembered tab that has since left the row (facets can reload) falls
  // back to the selection, so exactly one tab is always in the Tab order.
  const [focusedId, setFocusedId] = useState<Item['id'] | null>(null);
  // Fallback chain keeps EXACTLY one tab in the Tab order even if the host
  // passes a `value` that matches no tab (every current host guards against
  // that, but a strip that silently leaves the Tab order would be an
  // accessibility regression too quiet to notice).
  const rovingId =
    focusedId !== null && tabs.some((tab) => tab.id === focusedId)
      ? focusedId
      : tabs.some((tab) => tab.id === value)
        ? value
        : tabs[0]?.id;

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
    <div role="tablist" aria-label={ariaLabel} className={className}>
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
            id={panelId ? `${panelId}-tab-${tab.id}` : undefined}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={rovingId === tab.id ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onFocus={() => setFocusedId(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(tabClassName(selected), FOCUS_RING)}
          >
            {children(tab, selected)}
          </button>
        );
      })}
    </div>
  );
}
