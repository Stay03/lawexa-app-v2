'use client';

import { NotebookPen } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ACTION_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { useStatuteNotes } from './context';

/**
 * "Notes · 372" in the statute header's action row, beside Share, Save and
 * Add to folder. Researchers and up only: for anyone else it renders
 * nothing, so the row is exactly what it was.
 */
export function NotesButton() {
  const { enabled, status, notes, open, openPanel } = useStatuteNotes();
  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={() => openPanel()}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={cn(ACTION_PILL, FOCUS_RING)}
    >
      <NotebookPen aria-hidden className="size-4" />
      <span>
        Notes
        {status === 'ready' ? <span className="text-muted-foreground"> · {notes.length}</span> : null}
      </span>
    </button>
  );
}
