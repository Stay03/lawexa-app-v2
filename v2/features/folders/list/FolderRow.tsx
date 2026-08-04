'use client';

import { memo } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { FolderPublicMark, FolderTile } from '../folder-bits';
import { FolderActionsMenu } from '../FolderActionsMenu';
import { folderCountsLabel, type FolderRowModel } from '../folder-row-model';

/**
 * FolderRow — one folder, in the house two-zone grammar.
 *
 * ── WHAT v1's `FolderCard` DID, AND WHAT CHANGED ────────────────────────────
 *  1. IT WAS A CARD IN A GRID. Every legal-research incumbent — Westlaw,
 *     Lexis+, vLex, Bloomberg — lists folders as ROWS, and so does every
 *     folder-mature product outside law (Drive, Zotero, Raindrop). A card grid
 *     puts three folders on a screen where a list puts twelve, and a folder is
 *     not a thing you look at, it is a thing you go through.
 *  2. THE WHOLE CARD WAS THE LINK, with the actions menu nested inside it. Here
 *     the link wraps the identity block only and the menu is its SIBLING, so it
 *     is a control with its own accessible name rather than a click the row has
 *     to swallow.
 *  3. IT SHOWED VIEWS AND BOOKMARK COUNTS. A private shelf has no audience;
 *     the counts that matter are what is in it.
 *
 * ── THE META LINE IS TWO ZONES ──────────────────────────────────────────────
 *   LEAD   "3 items · 1 subfolder", plus the Public mark on the legacy folders
 *          that are still listed to strangers. This is what the folder HOLDS.
 *   TRAIL  "updated 3d" — or "created 3d" on payloads that carry no
 *          `updated_at` (the nested shapes do not). Right-anchored and tabular,
 *          so the times read straight down the column; NEVER blank, and never a
 *          bare number whose meaning depends on which endpoint it came from.
 *
 * `memo` holds because every prop is either a value or a callback the browser
 * memoises at the list level.
 */
export const FolderRow = memo(function FolderRow({
  row,
  index,
  now,
  onRename,
}: {
  row: FolderRowModel;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** Frozen clock for the relative trail — threaded from the browser's lazy
   *  `useState` so no `Date.now()` runs in render (React Compiler lint). */
  now: number;
  /** Opens the list's rename dialog for this folder. MUST be stable, or the
   *  `memo` above stops holding. */
  onRename: (row: FolderRowModel) => void;
}) {
  const trail = formatRelativeTime(row.trailAt, now);

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      // Capped at 14 so a deep page never staggers into a visible delay.
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div className="group relative flex min-w-0 items-start gap-2">
        <Link
          href={row.href}
          className={cn(
            'v2-interactive flex min-w-0 flex-1 items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/50',
            FOCUS_RING,
          )}
        >
          <FolderTile tint={row.tint} />

          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate text-[15px] font-medium transition-colors group-hover:text-primary',
                // An unnamed folder wears its fallback in a quieter voice: the
                // word is the absence of a name, not a name.
                row.hasName ? 'text-foreground' : 'italic text-muted-foreground',
              )}
              title={row.name}
            >
              {row.name}
            </span>

            <span className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              {/* LEAD — what the folder holds. */}
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="min-w-0 truncate tabular-nums">
                  {folderCountsLabel(row.itemsCount, row.childrenCount)}
                </span>
                {row.isPublic ? (
                  <>
                    <span aria-hidden className="shrink-0 text-muted-foreground/40">
                      ·
                    </span>
                    <FolderPublicMark />
                  </>
                ) : null}
              </span>

              {/* TRAIL — right-anchored, and honest about which time it is. */}
              {trail ? (
                <span className="shrink-0 tabular-nums">
                  {row.trailKind} {trail}
                </span>
              ) : null}
            </span>
          </span>
        </Link>

        {/* Outside the link. `mt-3.5` = the link's `py-3` plus the tile's
            `mt-0.5`, so the trigger and the tile sit on the same baseline and
            the row reads as one bar between two anchors (the arithmetic
            `BookmarkRow` and `NoteRow` both document). */}
        <FolderActionsMenu
          folder={{
            uuid: row.uuid,
            name: row.name,
            itemsCount: row.itemsCount,
            childrenCount: row.childrenCount,
          }}
          onRename={() => onRename(row)}
          className="mt-3.5"
        />
      </div>
    </li>
  );
});
