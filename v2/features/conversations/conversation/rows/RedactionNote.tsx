'use client';

import { useId, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { RedactionSummary } from '@/types/chat';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { redactionNote } from './redaction-note-model';

/**
 * RedactionNote — the quiet line under a question in a redacted chat (Stay
 * chose option D, 22 October 2026): "Sent as redacted · 14 details hidden".
 * When redaction found something, the line opens to what it hid, by kind, and
 * says that the stand-ins in the message above are what the AI saw. (The
 * server receives the message and redacts it before the AI reads it.) The
 * bubble already shows the redacted text, so the line never repeats it.
 *
 * The opening is the house grid-rows fold, both ways, settling at once under
 * reduced motion. The press never reaches the row underneath (which shows the
 * time on a tap).
 */
export function RedactionNote({ summary, align }: { summary: RedactionSummary | undefined; align: 'start' | 'end' }) {
  const note = redactionNote(summary);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (note.breakdown === null) {
    return (
      <p className={cn('text-muted-foreground mt-1 flex items-center gap-1 text-xs', align === 'end' && 'justify-end')}>
        <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
        {note.line}
      </p>
    );
  }

  return (
    <div className={cn('mt-1 flex max-w-full flex-col', align === 'end' ? 'items-end' : 'items-start')}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={cn(
          'v2-interactive text-muted-foreground hover:text-foreground inline-flex min-h-8 items-center gap-1 rounded-full px-1.5 text-xs transition-colors',
          FOCUS_RING,
        )}
      >
        <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
        {note.line}
        <ChevronDown
          aria-hidden
          className={cn('size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')}
        />
      </button>
      <div
        id={panelId}
        className={cn(
          'grid w-full max-w-sm transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="border-border/60 bg-secondary/40 text-muted-foreground mt-1 rounded-xl border px-3 py-2 text-xs leading-relaxed">
            <p className="text-foreground font-medium">Hidden before the AI read it: {note.breakdown}.</p>
            <p className="mt-1">The stand-ins in your message above are what the AI saw in their place.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
