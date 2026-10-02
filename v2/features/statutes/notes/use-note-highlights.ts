'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { StatuteAnnotation } from '@/types/statute';
import { noteElement, numberRange, quoteRange } from './note-ranges';

/**
 * The notes' underlines, painted with the CSS Custom Highlight API: no
 * element is added to the statute's text, so the renderer, the copy links,
 * find-in-page and text selection are all untouched, and a 700-part Act pays
 * nothing for notes it has not scrolled to. (The case reader's passage
 * highlight uses the same API for the same reason.)
 *
 * The document mounts progressively, so a note's part may not exist yet.
 * Each pass places only the notes whose parts have mounted since the last
 * one; `mountedCount` is what re-runs it. A placed note keeps its live Range,
 * which follows its text nodes for as long as they stay in the page.
 *
 * Two highlights: `statute-note` for every placed note, and
 * `statute-note-active` for the one a jump just landed on, briefly. A browser
 * without the API (older Safari and Firefox) paints nothing, and the notes
 * list still works in full.
 */

const NOTE = 'statute-note';
const ACTIVE = 'statute-note-active';
const FLASH_MS = 1800;

function highlightsSupported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

export function useNoteHighlights(notes: readonly StatuteAnnotation[], mountedCount: number) {
  // uuid → the range painted for it, or null when its part mounted and its
  // words were not found there (never retried until the notes change).
  const placed = useRef(new Map<string, Range | null>());
  const flashTimer = useRef<number | null>(null);

  // New notes (a refetch, another statute): start placing from scratch.
  useEffect(() => {
    placed.current = new Map();
    if (!highlightsSupported()) return;
    const all = new Highlight();
    CSS.highlights.set(NOTE, all);
    return () => {
      CSS.highlights.delete(NOTE);
      CSS.highlights.delete(ACTIVE);
    };
  }, [notes]);

  useEffect(() => {
    if (!highlightsSupported()) return;
    const all = CSS.highlights.get(NOTE);
    if (!all) return;
    for (const note of notes) {
      if (placed.current.has(note.uuid) || !note.node) continue;
      const element = noteElement(note);
      if (!element) continue; // not mounted yet: a later pass places it
      const range = note.quote ? quoteRange(note, element) : numberRange(element);
      placed.current.set(note.uuid, range);
      if (range) all.add(range);
    }
  }, [notes, mountedCount]);

  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  /** Every note whose painted range holds the point a reader tapped. */
  const notesAtPoint = useCallback((x: number, y: number): string[] => {
    const caret = caretAt(x, y);
    if (!caret) return [];
    const hits: string[] = [];
    for (const [uuid, range] of placed.current) {
      if (range && range.isPointInRange(caret.node, caret.offset)) hits.push(uuid);
    }
    return hits;
  }, []);

  /** Mark one note's words for a moment after a jump lands on them. */
  const flash = useCallback((note: StatuteAnnotation) => {
    if (!highlightsSupported()) return;
    let range = placed.current.get(note.uuid) ?? null;
    if (!range) {
      const element = noteElement(note);
      if (element) range = note.quote ? quoteRange(note, element) : numberRange(element);
    }
    if (!range) return;
    CSS.highlights.set(ACTIVE, new Highlight(range));
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      flashTimer.current = null;
      CSS.highlights.delete(ACTIVE);
    }, FLASH_MS);
  }, []);

  return { notesAtPoint, flash };
}

/** The text position under a point: the standard API where it exists,
 *  WebKit's older one otherwise. Shared with the reader's annotations. */
export function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    return position ? { node: position.offsetNode, offset: position.offset } : null;
  }
  const range = document.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}
