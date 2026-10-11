'use client';

import { memo } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { SpaceFile } from '@/types/collab';
import { useOpenFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { FileMark } from '@/v2/features/channels/files/FileMark';
import { RelativeTime } from '@/v2/features/channels/ui/RelativeTime';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

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
 * ── READ-ONLY, EXCEPT FOR OPENING IT ───────────────────────────────────────
 * F2 lists; adding, moving and removing come in F3 and F4. Opening stays,
 * because a file row that cannot open its file is not a list of files.
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
 * The action is always visible rather than revealed on hover: it is the
 * row's only control, and a list where nothing looks pressable until the
 * pointer finds it does not read as a list of things you can open.
 */
export const SpaceFileRow = memo(function SpaceFileRow({
  file,
  index,
}: {
  file: SpaceFile;
  /** Staggers the entrance for the first screenful only. */
  index: number;
}) {
  // Per row, deliberately: one instance shared by the list would put every
  // row's spinner on at once the moment any row was opened.
  const { open, opening, failed, gone } = useOpenFileInNewTab();

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      // Capped at 14 so a deep page never staggers into a visible delay.
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-150 hover:bg-secondary/50 motion-reduce:transition-none">
        {/* `FileMark` reads a non-null `url`; a file whose url the server
            withheld wears its type glyph, which is what the mark does for an
            empty url anyway. */}
        <FileMark file={{ ...file, url: file.url ?? '' }} />

        <div className="min-w-0 flex-1">
          <p
            className="min-w-0 truncate text-sm font-medium text-foreground"
            title={file.original_name}
          >
            {file.original_name}
          </p>

          <MetaLine
            className="mt-0.5"
            lead={[formatBytes(file.size), file.uploader.name]}
            trail={[<RelativeTime key="age" iso={file.created_at} />]}
          />

          {/* The open's one visible failure, in the row. A file that is GONE
              says so and offers nothing, because trying again cannot help; a
              refused or blocked open offers a fresh gesture, which is exactly
              what an engine that refused the first one will honour. */}
          {gone ? (
            <p role="status" className="mt-1 text-[11px] text-muted-foreground">
              This file is no longer available.
            </p>
          ) : failed ? (
            <p
              role="status"
              className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground"
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
        </div>

        {gone ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => open(file.id)}
            disabled={opening}
            aria-label={`Open ${file.original_name}`}
            title="Open"
            className="v2-interactive size-8 shrink-0 text-muted-foreground hover:text-foreground"
          >
            {opening ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Download aria-hidden className="size-4" />
            )}
          </Button>
        )}
      </div>
    </li>
  );
});
