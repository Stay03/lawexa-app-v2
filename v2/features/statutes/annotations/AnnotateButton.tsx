'use client';

import { Highlighter } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

import { ANNOTATE_BUTTON_WIDTH, annotateButtonLeft } from '../reader/selection-buttons';

/**
 * "Annotate", floating just under a reader's selection in the statute. It
 * sits where the researchers' "Print note" sits; when both show (a
 * researcher reading), this one stands one gap to its left (`besideNote`); both are placed by
 * `selection-buttons.ts`.
 *
 * Like that button, it takes the press without taking the selection:
 * `onMouseDown` is cancelled so a click does not collapse the words it is
 * about to mark. It fades in, never pops.
 */

export function AnnotateButton({
  rect,
  besideNote,
  onAnnotate,
}: {
  rect: DOMRect;
  besideNote: boolean;
  onAnnotate: () => void;
}) {
  const left = annotateButtonLeft(rect.right, window.innerWidth, besideNote);
  const top = Math.min(rect.bottom + 8, window.innerHeight - 56);

  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onAnnotate}
      style={{ left, top, width: ANNOTATE_BUTTON_WIDTH }}
      className={cn(
        'v2-interactive fixed z-40 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background/95 px-4 text-sm font-medium text-foreground shadow-lg backdrop-blur',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150',
        FOCUS_RING,
      )}
    >
      <Highlighter aria-hidden className="size-4" />
      Annotate
    </button>
  );
}
