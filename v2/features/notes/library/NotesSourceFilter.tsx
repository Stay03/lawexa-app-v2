'use client';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { NOTES_SOURCES, type NotesSource } from './notes-source';

/**
 * My notes' source filter: All · Written by you · From chats (notes-source.ts).
 * A row of small pills, one pressed, under the tab row; the same quiet face
 * as the tabs, one step smaller, so it reads as part of the tab it filters.
 */
export function NotesSourceFilter({ value, onChange }: { value: NotesSource; onChange: (next: NotesSource) => void }) {
  return (
    <div role="group" aria-label="Show notes" className="flex flex-wrap items-center gap-1.5">
      {NOTES_SOURCES.map((source) => (
        <button
          key={source.id}
          type="button"
          aria-pressed={value === source.id}
          onClick={() => onChange(source.id)}
          className={cn(
            'v2-interactive min-h-8 rounded-full border px-3 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
            value === source.id
              ? 'border-transparent bg-secondary text-foreground'
              : 'border-border text-muted-foreground hover:text-foreground',
            FOCUS_RING,
          )}
        >
          {source.label}
        </button>
      ))}
    </div>
  );
}
