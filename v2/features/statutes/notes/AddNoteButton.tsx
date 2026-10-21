'use client';

import { NotebookPen } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * "Print note", floating just under a researcher's selection in the statute:
 * a print note for the research team, named as the "Print notes" button at
 * the top of a statute names the list (Arthur picked it, 21 October 2026;
 * "Add print note" wrapped onto two lines at this width, and "Comment" would
 * clash with a later comments feature, Stay). Beside it, the reader's own
 * "Annotate" stays as it is.
 *
 * It sits where the selection ends, kept inside the screen, and takes the
 * press without taking the selection: `onMouseDown` is cancelled so a click
 * does not collapse the words it is about to note. It fades in, never pops.
 */

const MARGIN = 12;
const WIDTH = 136;

export function AddNoteButton({ rect, onAdd }: { rect: DOMRect; onAdd: () => void }) {
  const left = Math.min(Math.max(MARGIN, rect.right - WIDTH), window.innerWidth - WIDTH - MARGIN);
  const top = Math.min(rect.bottom + 8, window.innerHeight - 56);

  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onAdd}
      style={{ left, top, width: WIDTH }}
      className={cn(
        'v2-interactive fixed z-40 inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-border bg-background/95 px-4 text-sm font-medium text-foreground shadow-lg backdrop-blur',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150',
        FOCUS_RING,
      )}
    >
      <NotebookPen aria-hidden className="size-4" />
      Print note
    </button>
  );
}
