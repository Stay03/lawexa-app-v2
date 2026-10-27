'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useSidePanel } from '../side-panel/SidePanelContext';
import type { DraftVersion } from './draft-versions';

/**
 * DraftVersionSwitch — the strip at the top of the draft panel for a draft
 * Lawexa has written more than once (Stay, 27 October 2026, option B):
 *
 *   Version 2 of 3 · Latest                                    ‹  ›
 *
 * The arrows open the previous or the next version in the same panel. Each
 * version is its own `?side=draft:N`, so its edits, its note and its download
 * stay its own. Nothing is drawn for a draft with one version.
 *
 * The panel is drawn again for the version it opens (SidePanelSlot keys it by
 * ordinal), so the arrow pressed is gone with the old one. The new strip puts
 * focus back on the same arrow, or on the other one when it is now at an end,
 * so a keyboard reader can keep stepping. It can mount twice for one switch
 * (in the editor's frame while the version's note loads, then in the editor),
 * so the request holds for a moment instead of being used up by the first.
 */
export function DraftVersionSwitch({
  version,
  changes = null,
}: {
  version: DraftVersion | null;
  /**
   * "Show changes" (Stay, 27 October 2026), on version 2 and later only:
   * what changed since the version before, marked in the panel
   * (DraftChangesView). `null` where there is nothing to compare.
   */
  changes?: { on: boolean; onChange: (on: boolean) => void } | null;
}) {
  const panel = useSidePanel();
  const previousRef = useRef<HTMLButtonElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!refocus || Date.now() > refocus.until) return;
    const [first, second] = refocus.arrow === 'previous' ? [previousRef, nextRef] : [nextRef, previousRef];
    const target = first.current && !first.current.disabled ? first.current : second.current;
    target?.focus();
  }, []);

  if (!panel || !version || version.count < 2) return null;

  const at = version.version - 1;
  const previous = at > 0 ? version.ordinals[at - 1] : null;
  const next = at < version.count - 1 ? version.ordinals[at + 1] : null;
  const go = (ordinal: number | null, arrow: Arrow) => {
    if (ordinal === null) return;
    refocus = { arrow, until: Date.now() + REFOCUS_MS };
    panel.open({ kind: 'draft', ordinal });
  };

  return (
    <div
      role="group"
      aria-label="Versions of this draft"
      className="flex h-11 shrink-0 items-center gap-2 border-b border-border/70 pr-2 pl-5 xl:pl-4"
    >
      <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground tabular-nums">
        <span className="font-semibold text-foreground">
          Version {version.version} of {version.count}
        </span>
        {/* On a phone the switch needs the room. */}
        <span className={changes ? 'hidden sm:inline' : undefined}>
          {version.latest ? ' · Latest' : ' · An older version'}
        </span>
      </p>
      {changes ? (
        <label className="flex shrink-0 cursor-pointer items-center gap-2 pr-1 text-xs font-medium text-foreground">
          <Switch checked={changes.on} onCheckedChange={changes.onChange} />
          Show changes
        </label>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        ref={previousRef}
        aria-label="Previous version"
        disabled={previous === null}
        onClick={() => go(previous, 'previous')}
      >
        <ChevronLeft aria-hidden className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        ref={nextRef}
        aria-label="Next version"
        disabled={next === null}
        onClick={() => go(next, 'next')}
      >
        <ChevronRight aria-hidden className="size-4" />
      </Button>
    </div>
  );
}

type Arrow = 'previous' | 'next';

/** How long after a press the new strip takes focus back (ms). */
const REFOCUS_MS = 2000;

/** The arrow pressed to open the version now showing, for the strip drawn next. */
let refocus: { arrow: Arrow; until: number } | null = null;
