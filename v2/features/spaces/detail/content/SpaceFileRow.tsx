'use client';

import { memo } from 'react';
import { Boxes, ExternalLink, FolderOutput, Loader2, MoreHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { SpaceFile } from '@/types/collab';
import { useOpenFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { FileMark } from '@/v2/features/channels/files/FileMark';
import { RelativeTime } from '@/v2/features/channels/ui/RelativeTime';
import { MetaLine, MetaSeparator } from '@/v2/features/collab/kit/MetaLine';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { fileTypeLabel } from '../../content-model';

/** The row's body, as a button or (for a file that is gone) as plain text.
 *  The 40px mark and `py-2.5` make it 60px tall, over the 44px floor. */
const IDENTITY_CLASS =
  'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left';

/**
 * SpaceFileRow — one file in a space's Files tab (Spaces F2, 11 October 2026).
 *
 * ── WHY NOT THE CHANNEL LIBRARY'S `FileRow` ────────────────────────────────
 * That row is the right LOOK, and this one copies its anatomy exactly: the
 * 40px `FileMark` (a thumbnail when the file is an image), the name, and the
 * two-zone meta line (size and uploader, then the age). It cannot be the same
 * component, because it is built around a CHANNEL: it takes the `Channel`,
 * decides delete rights off the channel's roles, and its delete mutation edits
 * the channel's file cache and the feed's attachments. A space file has none
 * of those, and `FilesTab.tsx`, which owns that row, says it must not be
 * mounted anywhere else.
 *
 * ── OPENING, AND THE SPACE ROWS (Spaces F3, 12 October 2026) ──────────────
 * Opening is always there, because a file row that cannot open its file is
 * not a list of files. Beside it, a menu when the host passes an action:
 * "Move to space" for the file's uploader (its owner), "Remove from space"
 * for the space's Owner. The meta line names the file's type, size and
 * uploader, then its age.
 *
 * IT OPENS THROUGH THE TAP-FIRST OPENER (`useOpenFileInNewTab`, fix after
 * review, 11 October 2026). The first cut reused the channel library's
 * download mutation, which calls `window.open(url, '_blank', 'noopener')`
 * after the round trip: with `noopener` that call returns `null` by spec even
 * when the tab opened, so every successful open was reported as "Couldn't
 * open it", and opening after the round trip is a popup an iPhone home-screen
 * app refuses. The shared opener opens the empty tab inside the tap, points it
 * at the freshly minted URL (`GET /files/{id}/download`, which backend B3 opens
 * to every active member, design 3 change 9), and reports only a real refusal
 * (`failed`) or a file that no longer exists (`gone`, a 404).
 *
 * THE ROW'S BODY IS THE OPEN CONTROL (design round 2, 12 October 2026). The
 * mark, the name and the meta are one button, the folder row's identity
 * pattern, so the target is the row and not the 32px icon it used to be. The
 * new-tab glyph stays at the button's end, always visible rather than
 * revealed on hover, so the row still looks like something you can open. The
 * menu is its sibling, never inside it. A file that is gone has nothing to
 * open, so its body is plain text.
 */
export const SpaceFileRow = memo(function SpaceFileRow({
  file,
  index,
  onMove,
  onRemoveFromSpace,
}: {
  file: SpaceFile;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** Opens the move-to-space dialog (the uploader). MUST be stable for `memo`. */
  onMove?: (file: SpaceFile) => void;
  /** Opens the Remove from Space confirm (the space's Owner). Stable, likewise. */
  onRemoveFromSpace?: (file: SpaceFile) => void;
}) {
  // Per row, deliberately: one instance shared by the list would put every
  // row's spinner on at once the moment any row was opened.
  const { open, opening, failed, gone } = useOpenFileInNewTab();

  // The mark, the name and the meta: the row's open control, so the whole
  // body is the target and not a 32px icon at its end (design round 2).
  const identity = (
    <>
      {/* `FileMark` reads a non-null `url`; a file whose url the server
          withheld wears its type glyph, which is what the mark does for an
          empty url anyway. */}
      <FileMark file={{ ...file, url: file.url ?? '' }} />

      <span className="block min-w-0 flex-1">
        <span
          className="block min-w-0 truncate text-sm font-medium text-foreground"
          title={file.original_name}
        >
          {gone ? null : <span className="sr-only">Open </span>}
          {file.original_name}
        </span>

        {/* The type and size are one fact that holds its width, so on a
            phone only the uploader's name truncates (design round 2). */}
        <MetaLine
          as="span"
          className="mt-0.5"
          lead={[
            <span key="kind" className="flex shrink-0 items-center gap-2">
              <span>{fileTypeLabel(file)}</span>
              <MetaSeparator />
              <span>{formatBytes(file.size)}</span>
            </span>,
            file.uploader.name,
          ]}
          trail={[<RelativeTime key="age" iso={file.created_at} />]}
        />
      </span>
    </>
  );

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      // Capped at 14 so a deep page never staggers into a visible delay.
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div className="flex items-center gap-1">
        {gone ? (
          <div className={IDENTITY_CLASS}>{identity}</div>
        ) : (
          <button
            type="button"
            onClick={() => open(file.id)}
            disabled={opening}
            className={cn(
              IDENTITY_CLASS,
              'v2-interactive transition-colors duration-150 hover:bg-secondary/50 disabled:cursor-progress motion-reduce:transition-none',
              FOCUS_RING,
            )}
          >
            {identity}
            {opening ? (
              <Loader2
                aria-hidden
                className="size-4 shrink-0 animate-spin text-muted-foreground"
              />
            ) : (
              // It opens the file in a new tab, so its glyph says that and not
              // "download" (design round 1).
              <ExternalLink aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        )}

        {onMove || onRemoveFromSpace ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'v2-interactive flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground',
                FOCUS_RING,
              )}
              aria-label={`Actions for ${file.original_name}`}
            >
              <MoreHorizontal aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onMove ? (
                <DropdownMenuItem onSelect={() => onMove(file)}>
                  <Boxes />
                  Move to space
                </DropdownMenuItem>
              ) : null}
              {onRemoveFromSpace ? (
                <DropdownMenuItem onSelect={() => onRemoveFromSpace(file)}>
                  <FolderOutput />
                  Remove from space
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* The open's one visible failure, under the row and outside its
          button. A file that is GONE says so and offers nothing, because
          trying again cannot help; a refused or blocked open offers a fresh
          gesture, which is exactly what an engine that refused the first one
          will honour. Indented to the name: the row's `px-2`, the 40px mark
          and its `gap-3`. */}
      {gone ? (
        <p role="status" className="pb-1 pl-15 text-[11px] text-muted-foreground">
          This file is no longer available.
        </p>
      ) : failed ? (
        <p
          role="status"
          className="flex items-center gap-2 pb-1 pl-15 text-[11px] text-muted-foreground"
        >
          <span>Couldn&rsquo;t open it.</span>
          <button
            type="button"
            onClick={() => open(file.id)}
            className={cn(
              'rounded font-medium text-foreground underline underline-offset-2',
              FOCUS_RING,
            )}
          >
            Try again
          </button>
        </p>
      ) : null}
    </li>
  );
});
