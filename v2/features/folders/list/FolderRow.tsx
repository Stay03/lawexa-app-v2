'use client';

import { memo } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { FolderPublicMark, FolderTile } from '../folder-bits';
import { FolderActionsMenu } from '../FolderActionsMenu';
import { folderCountsLabel, type FolderRowModel } from '../folder-row-model';
import { rememberFolderPeek } from '../folder-peek';

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
 *
 * A SPACE'S HOME (Spaces F2, 11 October 2026; one list since B4, 17 October
 * 2026) draws the same row with no `onRename`: those folders may belong to
 * other members, and renaming and deleting stay with each folder's owner. A
 * tap opens the folder's page, as everywhere else. The menu carries the space
 * rows its host passes: `onMove` (the folder's owner) and `onRemoveFromSpace`
 * (the space's Owner). No actions, no menu.
 */
export const FolderRow = memo(function FolderRow({
  row,
  index,
  now,
  onRename,
  onMove,
  onRemoveFromSpace,
  layout = 'list',
  menuColumn = false,
}: {
  row: FolderRowModel;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** Frozen clock for the relative trail — threaded from the browser's lazy
   *  `useState` so no `Date.now()` runs in render (React Compiler lint). */
  now: number;
  /** Opens the list's rename dialog for this folder. MUST be stable, or the
   *  `memo` above stops holding. Present = Rename and Delete in the menu. */
  onRename?: (row: FolderRowModel) => void;
  /** Opens the move-to-space dialog for this folder. Stable, like `onRename`. */
  onMove?: (row: FolderRowModel) => void;
  /** Opens the Remove from Space confirm. Stable, like `onRename`. */
  onRemoveFromSpace?: (row: FolderRowModel) => void;
  /** `feed`: the row in a space's one list (B4, 17 October 2026), in the
   *  conversation row's box (`ConversationRow`: `px-3`, `py-2.5`, `min-h-14`,
   *  the 36px tile centred, a 14px name), so the folder's tile and name line
   *  up with the conversations and files around it. `list`: the folders
   *  lists' own row. */
  layout?: 'list' | 'feed';
  /** Some other row in the list has a menu: keep its column when this one
   *  has none, so the rows' right edges line up (`ConversationRow`'s prop). */
  menuColumn?: boolean;
}) {
  const feed = layout === 'feed';
  const trail = formatRelativeTime(row.trailAt, now);
  const hasMenu =
    onRename !== undefined || onMove !== undefined || onRemoveFromSpace !== undefined;
  const identityClass = cn(
    'v2-interactive flex min-w-0 flex-1 gap-3 text-left transition-colors hover:bg-secondary/50',
    feed
      ? 'min-h-14 items-center rounded-xl px-3 py-2.5'
      : 'items-start rounded-lg px-2 py-3',
    FOCUS_RING,
  );
  const identity = (
    <>
      <FolderTile tint={row.tint} className={feed ? 'mt-0' : undefined} />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate font-medium transition-colors group-hover:text-primary',
            feed ? 'text-sm' : 'text-[15px]',
            // An unnamed folder wears its fallback in a quieter voice: the
            // word is the absence of a name, not a name.
            row.hasName ? 'text-foreground' : 'italic text-muted-foreground',
          )}
          title={row.name}
        >
          {row.name}
        </span>

        <span
          className={cn(
            'flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground',
            !feed && 'mt-1',
          )}
        >
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
    </>
  );

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      // Capped at 14 so a deep page never staggers into a visible delay.
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div
        className={cn(
          'group relative flex min-w-0',
          feed ? 'items-center gap-1' : 'items-start gap-2',
        )}
      >
        {/* The folder page draws this row's tile and name at once, before any
            request answers (`folder-peek.ts`, speed step 5). */}
        <Link href={row.href} onClick={() => rememberFolderPeek(row)} className={identityClass}>
          {identity}
        </Link>

        {/* Outside the link. In a list, `mt-3.5` = the link's `py-3` plus the
            tile's `mt-0.5`, so the trigger and the tile sit on the same
            baseline and the row reads as one bar between two anchors (the
            arithmetic `BookmarkRow` and `NoteRow` both document); in the feed
            the row centres them. */}
        {hasMenu ? (
          <FolderActionsMenu
            folder={{
              uuid: row.uuid,
              name: row.name,
              itemsCount: row.itemsCount,
              childrenCount: row.childrenCount,
            }}
            onRename={onRename ? () => onRename(row) : undefined}
            onMove={onMove ? () => onMove(row) : undefined}
            onRemoveFromSpace={onRemoveFromSpace ? () => onRemoveFromSpace(row) : undefined}
            className={feed ? undefined : 'mt-3.5'}
          />
        ) : menuColumn ? (
          <span aria-hidden className="size-9 shrink-0" />
        ) : null}
      </div>
    </li>
  );
});
