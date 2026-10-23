'use client';

import { Fragment, memo } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { NoteRowModel } from '../note-row-model';
import { rememberNotePeek } from '../note-peek';
import type { NotesTab } from './NoteTabs';
import { noteRowMeta } from './note-row-meta';
import { NoteRowMenu } from './NoteRowMenu';

/**
 * NoteRow — one note in the library list, as the owner's take A (23 October
 * 2026): a list with no reading pane, each row three lines between hairlines.
 *
 *   TITLE     one line, semibold, with the "⋮" menu at the right of it
 *   SUMMARY   two lines of what the note says, clamped
 *   META      one grey line: "23 Oct · Land law, Property" on My notes,
 *             "Ada Okafor · 23 Oct · Land law" on All notes
 *             (`note-row-meta.ts` holds that rule)
 *
 * A tap on the row opens the note's page. The link wraps the three lines only;
 * the menu is a SIBLING of it, never a `<button>` inside an `<a>`. There is no
 * bookmark icon in the row: Save is the first item in the menu
 * (`NoteRowMenu`), beside Add to folder, Share, Export, and Edit and Delete on
 * the reader's own notes.
 *
 * WHAT v1's `NoteCard` DID: a card in a grid with a thumbnail, a price badge
 * and a bookmark count, and the whole card was the link. A note is a document
 * and the v2 library is a reading list; `NoteRowModel` cannot express a price.
 *
 * `memo` matters for the same reason as `CaseRow`: the bookmark mutation fans
 * out across every cached notes surface, so an unmemoised row would re-render
 * the whole visible list on each Save.
 */
export const NoteRow = memo(function NoteRow({
  row,
  index,
  now,
  tab,
  onAddToFolder,
  onDelete,
  selected,
  onToggleSelect,
}: {
  row: NoteRowModel;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** Frozen clock for the date — threaded from the browser's lazy `useState`
   *  so no `Date.now()` runs in render (React Compiler lint). */
  now: number;
  /** Which list the row is in: it decides the meta line. */
  tab: NotesTab;
  /** The list's dialogs (`useNoteRowDialogs`); both must be stable. */
  onAddToFolder: (row: NoteRowModel) => void;
  onDelete: (row: NoteRowModel) => void;
  /**
   * Bulk select on My notes: the row is its tick box, a tap ticks it instead
   * of opening the note, and the menu steps aside for the bar's actions.
   * `onToggleSelect` must be stable, like the row itself.
   */
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  const meta = noteRowMeta(row, tab, now);
  const selecting = onToggleSelect !== undefined;

  const lines = (
    <span className="block min-w-0 flex-1">
      <span
        className={cn(
          'block truncate text-base font-semibold leading-6 transition-colors group-hover:text-primary',
          // An untitled note wears its fallback in a quieter voice: the
          // word "Untitled" is the absence of a name, not a name.
          row.hasTitle ? 'text-foreground' : 'italic text-muted-foreground',
        )}
        title={row.title}
      >
        {row.title}
      </span>

      {row.preview ? (
        <span className="mt-1 line-clamp-2 max-w-[640px] text-sm leading-[22px] text-foreground/70">
          {row.preview}
        </span>
      ) : null}

      {meta.length > 0 ? (
        <span className="mt-2 block truncate text-[13px] leading-5 text-muted-foreground">
          {meta.map((part, position) => (
            <Fragment key={position}>
              {position > 0 ? (
                <>
                  <span aria-hidden className="mx-1.5 text-muted-foreground/50">
                    ·
                  </span>
                  <span className="sr-only">, </span>
                </>
              ) : null}
              {part}
            </Fragment>
          ))}
        </span>
      ) : null}
    </span>
  );

  const rowClass = 'v2-interactive group flex min-w-0 flex-1 items-start gap-3 rounded-lg pb-[15px] pt-4';

  return (
    <li
      className="border-b border-border/60 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      // Capped at 14 so a deep page never staggers into a visible delay.
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div className="relative flex items-start gap-2">
        {selecting ? (
          <label className={cn(rowClass, 'cursor-pointer', selected && 'bg-secondary/60')}>
            <Checkbox
              checked={selected === true}
              onCheckedChange={() => onToggleSelect(row.id)}
              aria-label={`Select ${row.title}`}
              className="mt-1 shrink-0"
            />
            {lines}
          </label>
        ) : (
          <Link
            href={row.href}
            // The reader draws this row's name at once on a first open, before any
            // request answers (`note-peek.ts`, speed step 5).
            onClick={() => rememberNotePeek(row)}
            className={cn(rowClass, FOCUS_RING)}
          >
            {lines}
          </Link>
        )}

        {/* On the title's line: `mt-2.5` (10px) centres the 36px target on
            the link's `pt-4` (16px) plus half the 24px title line, and
            `-mr-1.5` puts the glyph where the mock draws it, 12px in from
            the column's edge.

            While ticking, the menu's place stays empty, so the rows keep
            their width and the bar holds the actions. */}
        {selecting ? (
          <span aria-hidden className="-mr-1.5 mt-2.5 size-9 shrink-0" />
        ) : (
          <div className="-mr-1.5 mt-2.5 shrink-0">
            <NoteRowMenu row={row} onAddToFolder={onAddToFolder} onDelete={onDelete} />
          </div>
        )}
      </div>
    </li>
  );
});
