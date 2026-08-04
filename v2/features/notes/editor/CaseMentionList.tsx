'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Scale } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMounted } from '@/v2/shell/use-mounted';
import type { CaseMentionStore, MentionAnchor } from './mention-store';

/**
 * CaseMentionList — the `@` picker, rendered as an ordinary component in the
 * editor's own React tree.
 *
 * ── WHAT REPLACED TIPPY ─────────────────────────────────────────────────────
 * v1 mounted a detached React root inside a tippy.js popup appended to `body`.
 * This version reads the plugin's state from `mention-store.ts` through
 * `useSyncExternalStore` and portals ONE positioned panel to `body` — a portal
 * rather than a nested element because the shell's scroll container would clip
 * a panel that overflows the paper's bounds, and because an ancestor with a
 * transform would break `position: fixed` from inside.
 *
 * Positioning is arithmetic on the caret rect the plugin hands us (kept current
 * by the store while the page scrolls), flipped above the line when there is not
 * enough room below. That is all Floating UI would do for this shape, without
 * the dependency.
 *
 * ── ACCESSIBILITY ───────────────────────────────────────────────────────────
 * The combobox lives on the CONTENTEDITABLE, not here — that is where focus
 * stays and where the keys are handled, so `aria-activedescendant` on the editor
 * points at the row this list marks. The list itself is a plain `listbox` whose
 * options carry stable ids; nothing here is focusable, because moving focus into
 * the popup would end the selection the mention is being typed into.
 */

/** Room the panel needs below the caret before it flips above it. */
const PANEL_MAX_HEIGHT = 280;

/** Kept in step with the panel's `w-*` class so the flip maths is honest. */
const PANEL_WIDTH = 320;

/** The id of one row — also what the editor's `aria-activedescendant` points at. */
export function mentionOptionId(index: number): string {
  return `v2-case-mention-option-${index}`;
}

/** The listbox's id, published on the editor via `aria-controls`. */
export const MENTION_LISTBOX_ID = 'v2-case-mention-listbox';

interface PanelPosition {
  top: number;
  left: number;
  maxHeight: number;
  above: boolean;
}

/** Pure: where the panel goes, given the caret and the viewport. */
function positionFor(anchor: MentionAnchor): PanelPosition {
  const spaceBelow = anchor.viewportHeight - anchor.bottom - 8;
  const spaceAbove = anchor.top - 8;
  const above = spaceBelow < Math.min(PANEL_MAX_HEIGHT, 160) && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    120,
    Math.min(PANEL_MAX_HEIGHT, above ? spaceAbove : spaceBelow),
  );
  const left = Math.max(
    8,
    Math.min(anchor.left, anchor.viewportWidth - PANEL_WIDTH - 8),
  );
  return {
    top: above ? anchor.top - maxHeight - 6 : anchor.bottom + 6,
    left,
    maxHeight,
    above,
  };
}

export function CaseMentionList({ store }: { store: CaseMentionStore }) {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  // The portal target only exists in the browser; `useMounted` is the house's
  // hydration-safe gate (no setState-in-effect).
  const mounted = useMounted();

  if (!mounted || !snapshot.open || snapshot.anchor === null) return null;

  const { top, left, maxHeight } = positionFor(snapshot.anchor);
  const hasItems = snapshot.items.length > 0;
  const searching = snapshot.query.trim().length >= 2;

  // Nothing to say yet — an empty panel under the caret would only be noise.
  if (!hasItems && !snapshot.loading && !snapshot.failed && !searching) return null;

  return createPortal(
    <div
      style={{ top, left, width: PANEL_WIDTH, maxHeight }}
      className="fixed z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150"
    >
      {snapshot.loading && !hasItems ? (
        <MentionNotice>Searching cases…</MentionNotice>
      ) : null}

      {snapshot.failed ? (
        <MentionNotice>Couldn&apos;t search cases just now.</MentionNotice>
      ) : null}

      {!snapshot.loading && !snapshot.failed && !hasItems && searching ? (
        <MentionNotice>
          No case matches &ldquo;{snapshot.query.trim()}&rdquo;.
        </MentionNotice>
      ) : null}

      {hasItems ? (
        <ul
          id={MENTION_LISTBOX_ID}
          role="listbox"
          aria-label="Cases"
          className="v2-quiet-scroll overflow-y-auto py-1"
          style={{ maxHeight }}
        >
          {snapshot.items.map((item, index) => {
            const active = index === snapshot.activeIndex;
            return (
              <li key={item.id} role="presentation">
                <button
                  id={mentionOptionId(index)}
                  type="button"
                  role="option"
                  aria-selected={active}
                  tabIndex={-1}
                  // Keep the caret (and therefore the suggestion range) alive —
                  // a blur here would tear the session down before the pick.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => store.setActive(index)}
                  onClick={() => store.choose(index)}
                  className={cn(
                    'v2-interactive flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors duration-100',
                    active ? 'bg-secondary' : 'hover:bg-secondary/60',
                  )}
                >
                  <Scale
                    aria-hidden
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      {item.label}
                    </span>
                    {item.meta ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.meta}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>,
    document.body,
  );
}

function MentionNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-2.5 text-sm text-muted-foreground" role="status">
      {children}
    </p>
  );
}
