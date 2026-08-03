'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Settings,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RadarListItem } from '@/types/radar';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { usePauseRadar, useResumeRadar, useScanNow } from '../actions';
import { ArchiveRadarDialog } from '../ArchiveRadarDialog';
import { RADAR_STATUS, radarMetaZones } from '../model';

/**
 * RadarRow — one radar in the list.
 *
 * ── WHAT v1's CARD DID WRONG, and what changed ──────────────────────────────
 *  1. FULL-BLEED LINK OVERLAY. The card was an `absolute inset-0` link with
 *     the menu button z-indexed above it — clicks near the menu were a coin
 *     toss and screen readers met a nameless overlay. Here the NAME is the
 *     link and the menu is a real sibling; nothing overlays anything.
 *  2. STATUS WAS COLOUR-ONLY (a dot with a tooltip). The dot stays for
 *     scanability but the label rides with it for assistive tech, and the
 *     paused state is also written out in the meta line.
 *  3. A BORDERED CARD. Rows separate with a hairline, per the v2 list grammar.
 *
 * The unread badge is the row's one loud element — a gold "N new" pill — and
 * it sits at the row's right edge where every v2 list puts its signal.
 *
 * THE META LINE IS TWO ZONES (owner, August 3, the cross-list alignment pass):
 * the schedule leads and truncates; the clock facts — last scan, next scan, or
 * the paused sentence — are right-anchored, so they read down a column rather
 * than starting wherever each row's schedule text happened to end. The line
 * never wraps.
 *
 * `memo`: the triage mutation patches unread counts across cached lists, so
 * an unmemoised row would re-render the whole list per patch.
 */
export const RadarRow = memo(function RadarRow({
  radar,
  index,
  now,
}: {
  radar: RadarListItem;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** Frozen clock from the screen root (no `Date.now()` in render). */
  now: number;
}) {
  const status = RADAR_STATUS[radar.status];
  const meta = radarMetaZones(radar, now);

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div className="group relative flex items-start gap-2">
        <Link
          href={`/radars/${radar.uuid}`}
          className={cn(
            'v2-interactive min-w-0 flex-1 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/50',
            FOCUS_RING,
          )}
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn('size-2 shrink-0 rounded-full', status.dotClass)}
            />
            <span className="sr-only">{status.label} radar:</span>
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[15px] text-foreground transition-colors group-hover:text-primary',
                radar.unread_reports_count > 0 ? 'font-semibold' : 'font-medium',
              )}
              title={radar.name}
            >
              {radar.name}
            </span>
            {radar.unread_reports_count > 0 ? (
              <span className="inline-flex min-h-5 shrink-0 items-center rounded-full bg-primary/10 px-2 text-[11px] font-medium tabular-nums text-primary">
                {radar.unread_reports_count} new
              </span>
            ) : null}
          </span>

          {radar.description ? (
            <span className="mt-1 block truncate text-sm text-muted-foreground">
              {radar.description}
            </span>
          ) : null}

          <span className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
            {/* LEAD — the schedule. */}
            <span className="min-w-0 flex-1 truncate">{meta.lead}</span>

            {/* TRAIL — the clock facts, right-anchored. */}
            <span className="flex shrink-0 items-center gap-2">
              {meta.trail.map((part, partIndex) => (
                <span key={part} className="inline-flex items-center gap-2">
                  {partIndex > 0 ? (
                    <span aria-hidden className="text-muted-foreground/40">
                      ·
                    </span>
                  ) : null}
                  {part}
                </span>
              ))}
            </span>
          </span>
        </Link>

        {/* Real sibling controls — never inside the link. */}
        {radar.status !== 'archived' ? (
          <RadarRowMenu radar={radar} />
        ) : null}
      </div>
    </li>
  );
});

/** The per-row actions menu — every action delegates to the shared layer.
 *  While one of the row's actions is in flight the trigger becomes a live
 *  spinner (the menu itself closed on click, so the trigger is the one
 *  element left to carry the pending truth). */
function RadarRowMenu({ radar }: { radar: RadarListItem }) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const scanNow = useScanNow();
  const pauseRadar = usePauseRadar();
  const resumeRadar = useResumeRadar();
  const busy =
    scanNow.isPending || pauseRadar.isPending || resumeRadar.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="mt-2 size-8 shrink-0 text-muted-foreground"
            aria-label={`Actions for ${radar.name}`}
            aria-busy={busy || undefined}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {radar.status === 'active' ? (
            <>
              <DropdownMenuItem
                onClick={() => scanNow.mutate(radar.uuid)}
                disabled={scanNow.isPending}
              >
                <Zap />
                Scan now
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => pauseRadar.mutate(radar.uuid)}
                disabled={pauseRadar.isPending}
              >
                <Pause />
                Pause
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onClick={() => resumeRadar.mutate(radar.uuid)}
              disabled={resumeRadar.isPending}
            >
              <Play />
              Resume
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/radars/${radar.uuid}?settings=1`}>
              <Settings />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ArchiveRadarDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        radar={radar}
      />
    </>
  );
}
