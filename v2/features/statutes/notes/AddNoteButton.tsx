'use client';

import { NotebookPen } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

import { NOTE_BUTTON_WIDTH, noteButtonLeft } from '../reader/selection-buttons';

/**
 * "Print note", floating just under a researcher's selection in the statute:
 * a print note for the research team, named as the "Print notes" button at
 * the top of a statute names the list (Arthur picked it, 21 October 2026;
 * "Add print note" wrapped onto two lines at this width, and "Comment" would
 * clash with a later comments feature, Stay). Beside it, the reader's own
 * "Annotate" stays as it is.
 *
 * It sits where the selection ends, kept inside the screen with room for
 * "Annotate" on its left when that shows too (`besideAnnotate`), and takes the
 * press without taking the selection: `onMouseDown` is cancelled so a click
 * does not collapse the words it is about to note. It fades in, never pops.
 */

export function AddNoteButton({
  rect,
  besideAnnotate,
  onAdd,
}: {
  rect: DOMRect;
  besideAnnotate: boolean;
  onAdd: () => void;
}) {
  const left = noteButtonLeft(rect.right, window.innerWidth, besideAnnotate);
  const top = Math.min(rect.bottom + 8, window.innerHeight - 56);

  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onAdd}
      style={{ left, top, width: NOTE_BUTTON_WIDTH }}
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
