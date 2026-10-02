'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { buildTextIndex, locateQuote } from '../notes/match';
import { noteAnchorId, pieceWalk } from '../notes/note-ranges';
import { caretAt } from '../notes/use-note-highlights';
import { ANNOTATION_COLOURS, colourOf, highlightName, isUnplaceable, type ReaderAnnotation } from './model';

/**
 * The reader's annotations painted over the statute with the CSS Custom
 * Highlight API, one layer per colour, exactly as the print notes' underlines
 * are painted (`notes/use-note-highlights.ts`): no element is added to the
 * text, and a part not mounted yet is placed when it mounts.
 *
 * Placing follows the print notes' rule: the quote is found in its part's
 * text by the server's text rule, and among repeats the one whose prefix and
 * suffix fit, then the one nearest the stored offset (`notes/match.ts`).
 *
 * Returns what the document needs: which annotations sit under a tapped
 * point, where one is on screen (for its card), and which could not be
 * placed, by the server's word (`text_changed`, `detached`) or because the
 * words were not found in a mounted part.
 */

function highlightsSupported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

function rangeFor(annotation: ReaderAnnotation): Range | null | undefined {
  if (!annotation.node || !annotation.quote) return null;
  const element = document.getElementById(noteAnchorId(annotation.node.eid));
  if (!element) return undefined; // not mounted yet
  const found = locateQuote(buildTextIndex(pieceWalk(element)), annotation.quote, {
    prefix: annotation.prefix,
    suffix: annotation.suffix,
    startOffset: annotation.start_offset,
  });
  if (!found) return null;
  const range = document.createRange();
  range.setStart(found.start.handle, found.start.offset);
  range.setEnd(found.end.handle, found.end.offset);
  return range;
}

export function useAnnotationHighlights(annotations: readonly ReaderAnnotation[], mountedCount: number) {
  // uuid → its painted range, or null when its part mounted without its words.
  const placed = useRef(new Map<string, Range | null>());
  const [notFound, setNotFound] = useState<readonly string[]>([]);

  useEffect(() => {
    placed.current = new Map();
    if (!highlightsSupported()) return;
    for (const colour of ANNOTATION_COLOURS) CSS.highlights.set(highlightName(colour), new Highlight());
    return () => {
      for (const colour of ANNOTATION_COLOURS) CSS.highlights.delete(highlightName(colour));
    };
  }, [annotations]);

  useEffect(() => {
    if (!highlightsSupported()) return;
    const missing: string[] = [];
    for (const annotation of annotations) {
      if (placed.current.has(annotation.uuid) || isUnplaceable(annotation)) continue;
      const range = rangeFor(annotation);
      if (range === undefined) continue; // a later pass places it
      placed.current.set(annotation.uuid, range);
      if (range) CSS.highlights.get(highlightName(colourOf(annotation)))?.add(range);
      else if (annotation.quote) missing.push(annotation.uuid);
    }
    // A timer, not a direct set: the React Compiler rule keeps setState out
    // of an effect's body.
    if (missing.length === 0) return;
    const timer = window.setTimeout(() => setNotFound((prev) => [...new Set([...prev, ...missing])]), 0);
    return () => window.clearTimeout(timer);
  }, [annotations, mountedCount]);

  /** The annotations whose words hold the point a reader tapped, newest first. */
  const annotationsAtPoint = useCallback((x: number, y: number): string[] => {
    const caret = caretAt(x, y);
    if (!caret) return [];
    const hits: string[] = [];
    for (const [uuid, range] of placed.current) {
      if (range && range.isPointInRange(caret.node, caret.offset)) hits.push(uuid);
    }
    return hits.reverse();
  }, []);

  /** Where an annotation's words are on screen now, for its card. */
  const rectOf = useCallback((uuid: string): DOMRect | null => {
    const range = placed.current.get(uuid);
    return range ? range.getBoundingClientRect() : null;
  }, []);

  return { annotationsAtPoint, rectOf, notFound };
}
