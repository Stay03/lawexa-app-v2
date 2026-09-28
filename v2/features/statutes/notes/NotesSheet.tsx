'use client';

import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { StatuteAnnotation, StatuteAnnotationType } from '@/types/statute';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useStatuteNotes } from './context';
import { NoteRow } from './NoteRow';

/**
 * The notes panel: every researcher's note on this statute, in reading order,
 * from the right edge (the Contents sheet opens from the left, so the two
 * never share a side). Tapping a note with a place closes the panel, jumps
 * the document there and flashes its words.
 *
 * Opened from a tapped underline, it shows only the notes at that place,
 * with a way back to all of them.
 */

type StatusFilter = 'all' | 'open' | 'decided';
type TypeFilter = 'all' | StatuteAnnotationType;

const TYPE_ORDER: readonly StatuteAnnotationType[] = ['print_error', 'typo', 'doubt', 'note'];
const TYPE_LABEL: Record<StatuteAnnotationType, string> = {
  print_error: 'Printing error',
  typo: 'Typo',
  doubt: 'Doubt',
  note: 'Note',
};

export function NotesSheet() {
  const { slug, open, closePanel, notes, status, retry, focus, clearFocus, jumpTo } = useStatuteNotes();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const typeCounts = useMemo(() => {
    const counts = new Map<StatuteAnnotationType, number>();
    for (const note of notes) counts.set(note.type, (counts.get(note.type) ?? 0) + 1);
    return counts;
  }, [notes]);

  const shown = useMemo(() => {
    if (focus) {
      const wanted = new Set(focus);
      return notes.filter((note) => wanted.has(note.uuid));
    }
    return notes.filter(
      (note) =>
        (statusFilter === 'all' || note.status === statusFilter) &&
        (typeFilter === 'all' || note.type === typeFilter),
    );
  }, [notes, focus, statusFilter, typeFilter]);

  const wholeStatute = shown.filter((note) => !note.node && !note.quote);
  const placed = shown.filter((note) => note.node);
  const detached = shown.filter((note) => !note.node && note.quote);

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : closePanel())}>
      <SheetContent side="right" className="w-[92vw] max-w-md gap-0">
        <SheetHeader className="border-b border-border px-5 pb-3">
          <SheetTitle>
            Notes{status === 'ready' ? <span className="text-muted-foreground"> · {notes.length}</span> : null}
          </SheetTitle>
          <SheetDescription>
            Printing errors, typos and doubts recorded by researchers. Only researchers see them.
          </SheetDescription>
        </SheetHeader>

        {status === 'ready' && notes.length > 0 ? (
          focus ? (
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-2.5 text-sm">
              <span className="text-muted-foreground">
                {shown.length === 1 ? 'The note at this place' : `${shown.length} notes at this place`}
              </span>
              <button type="button" onClick={clearFocus} className={cn('font-medium text-primary hover:underline', FOCUS_RING)}>
                Show all notes
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 border-b border-border px-5 py-3">
              <FilterRow
                label="Status"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'open', label: 'Open' },
                  { value: 'decided', label: 'Decided' },
                ]}
              />
              <FilterRow
                label="Type"
                value={typeFilter}
                onChange={(value) => setTypeFilter(value as TypeFilter)}
                options={[
                  { value: 'all', label: 'All' },
                  ...TYPE_ORDER.filter((type) => typeCounts.has(type)).map((type) => ({
                    value: type,
                    label: `${TYPE_LABEL[type]} ${typeCounts.get(type)}`,
                  })),
                ]}
              />
            </div>
          )
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-3">
          {status === 'pending' ? (
            <NotesSkeleton />
          ) : status === 'error' ? (
            <div className="flex flex-col items-start gap-3 py-6 text-sm">
              <p className="text-muted-foreground">The notes could not be loaded.</p>
              <Button variant="outline" size="sm" onClick={retry}>
                <RotateCcw aria-hidden className="size-4" />
                Try again
              </Button>
            </div>
          ) : notes.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No notes on this statute yet.</p>
          ) : shown.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No notes match these filters.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {wholeStatute.length > 0 ? (
                <NoteGroup title="The whole statute" notes={wholeStatute} slug={slug} />
              ) : null}
              {placed.length > 0 ? (
                <NoteGroup
                  title={wholeStatute.length > 0 || detached.length > 0 ? 'In the text' : null}
                  notes={placed}
                  slug={slug}
                  onSelect={jumpTo}
                />
              ) : null}
              {detached.length > 0 ? (
                <NoteGroup title="Part no longer in the statute" notes={detached} slug={slug} />
              ) : null}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilterRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs transition-colors',
            value === option.value
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
            FOCUS_RING,
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function NoteGroup({
  title,
  notes,
  slug,
  onSelect,
}: {
  title: string | null;
  notes: readonly StatuteAnnotation[];
  slug: string;
  onSelect?: (note: StatuteAnnotation) => void;
}) {
  return (
    <section className="flex flex-col gap-1">
      {title ? (
        <h3 className="pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      ) : null}
      <ul className="flex flex-col divide-y divide-border">
        {notes.map((note) => (
          <li key={note.uuid}>
            <NoteRow note={note} slug={slug} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotesSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading notes
      </span>
      <div aria-hidden className="flex flex-col gap-5 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 rounded" style={{ width: `${[80, 64, 90, 72][i]}%` }} />
          </div>
        ))}
      </div>
    </>
  );
}
