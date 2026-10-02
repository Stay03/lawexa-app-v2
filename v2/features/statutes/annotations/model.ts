/**
 * A reader's own annotations on a statute (Stay, 29 September 2026: signed-in
 * readers only, each visible to its owner only). The contract is backend's
 * design 814188e2 as agreed in 95093154, with the part named by its eId
 * (0ebede67): the page knows a part only as `akn-{eid}`.
 *
 *   GET    /statutes/{slug}/my-annotations   the caller's own, in reading order
 *   POST   /statutes/{slug}/my-annotations   create
 *   PATCH  /my-annotations/{uuid}            body and colour
 *   DELETE /my-annotations/{uuid}            soft delete
 */

export const ANNOTATION_COLOURS = ['yellow', 'green', 'blue', 'pink', 'purple'] as const;
export type AnnotationColour = (typeof ANNOTATION_COLOURS)[number];
export const DEFAULT_ANNOTATION_COLOUR: AnnotationColour = 'yellow';

/** The server's limit on an annotation's text. */
export const ANNOTATION_BODY_MAX = 5000;

export interface ReaderAnnotation {
  readonly uuid: string;
  /** The part it sits on; null for a whole-statute annotation or a detached one. */
  readonly node: { readonly eid: string } | null;
  /** The selected words; null for an annotation on the whole statute. */
  readonly quote: string | null;
  readonly prefix: string | null;
  readonly suffix: string | null;
  readonly start_offset: number | null;
  readonly end_offset: number | null;
  /** May be empty: a plain highlight. */
  readonly body: string | null;
  /** Null means the default colour. */
  readonly colour: AnnotationColour | null;
  /** The quote is no longer in its part's text. */
  readonly text_changed: boolean;
  /** Its part was deleted. */
  readonly detached: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ReaderAnnotationCreate {
  readonly eid: string;
  readonly quote: string;
  readonly prefix: string;
  readonly suffix: string;
  readonly start_offset: number;
  readonly end_offset: number;
  readonly body: string;
  readonly colour: AnnotationColour;
}

export interface ReaderAnnotationUpdate {
  readonly body?: string;
  readonly colour?: AnnotationColour;
}

export function colourOf(annotation: Pick<ReaderAnnotation, 'colour'>): AnnotationColour {
  return annotation.colour ?? DEFAULT_ANNOTATION_COLOUR;
}

/** The name of the page's highlight layer for one colour. */
export function highlightName(colour: AnnotationColour): string {
  return `reader-annotation-${colour}`;
}

/**
 * The server says this one cannot sit in the text any more: its words
 * changed, or its part is gone. The page lists these apart rather than guess
 * a new place (backend 814188e2, point 4).
 */
export function isUnplaceable(annotation: Pick<ReaderAnnotation, 'text_changed' | 'detached'>): boolean {
  return annotation.text_changed || annotation.detached;
}

/** A stand-in row shown the moment a reader saves, until the server answers. */
export const PENDING_PREFIX = 'pending-';

export function pendingAnnotation(draft: ReaderAnnotationCreate, now: string, id: string): ReaderAnnotation {
  return {
    uuid: `${PENDING_PREFIX}${id}`,
    node: { eid: draft.eid },
    quote: draft.quote,
    prefix: draft.prefix,
    suffix: draft.suffix,
    start_offset: draft.start_offset,
    end_offset: draft.end_offset,
    body: draft.body,
    colour: draft.colour,
    text_changed: false,
    detached: false,
    created_at: now,
    updated_at: now,
  };
}

export function isPending(annotation: Pick<ReaderAnnotation, 'uuid'>): boolean {
  return annotation.uuid.startsWith(PENDING_PREFIX);
}
