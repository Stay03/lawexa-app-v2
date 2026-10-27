'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
 * so a keyboard reader can keep stepping.
 */
export function DraftVersionSwitch({ version }: { version: DraftVersion | null }) {
  const panel = useSidePanel();
  const previousRef = useRef<HTMLButtonElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const pressed = refocus;
    refocus = null;
    if (!pressed) return;
    const [first, second] = pressed === 'previous' ? [previousRef, nextRef] : [nextRef, previousRef];
    const target = first.current && !first.current.disabled ? first.current : second.current;
    target?.focus();
  }, []);

  if (!panel || !version || version.count < 2) return null;

  const at = version.version - 1;
  const previous = at > 0 ? version.ordinals[at - 1] : null;
  const next = at < version.count - 1 ? version.ordinals[at + 1] : null;
  const go = (ordinal: number | null, arrow: Arrow) => {
    if (ordinal === null) return;
    refocus = arrow;
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
        {version.latest ? ' · Latest' : ' · An older version'}
      </p>
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

/** The arrow pressed to open the version now showing, read once by the new strip. */
let refocus: Arrow | null = null;
